import { confirm } from "@/lib/confirm";
import { notice } from "@/lib/notice";

// ── Save outcome model ───────────────────────────────────────────────────────
//
// GlazeVault is local-first: every save writes the AsyncStorage cache BEFORE it
// touches Supabase, so the artist's work is never lost when the cloud write
// fails. These helpers let each save path diagnose *why* a remote write failed
// and tell the artist plainly, instead of either hanging on "Saving…" forever or
// silently reporting success when the cloud copy never landed.

export type SaveErrorKind =
  | "offline" // Supabase not configured / no session — local-only by design
  | "timeout" // the network call exceeded our budget
  | "network" // fetch failed / no connectivity
  | "auth" // session expired / not authenticated (JWT)
  | "permission" // row-level security / forbidden
  | "upload" // image upload to Storage failed
  | "server" // generic Supabase / Postgres error
  | "unknown";

export interface ClassifiedSaveError {
  kind: SaveErrorKind;
  /** Short, plain-language headline, e.g. "Session expired". */
  title: string;
  /** One or two sentences the artist can act on. */
  message: string;
}

/**
 * The result of a save. `ok` is true when the change is safely on Supabase (or
 * there is no server configured, which is a valid local-only state). When false,
 * `error` carries the diagnosed reason. The local cache is always written first,
 * so a failure never means lost work.
 */
export interface SaveOutcome {
  ok: boolean;
  error?: ClassifiedSaveError;
}

export const SAVE_OK: SaveOutcome = { ok: true };

/** Rejected by `withTimeout` when a remote call outruns its budget. */
export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = "TimeoutError";
  }
}

/** Default network budget for a single remote write before we give up. */
export const SAVE_TIMEOUT_MS = 20000;

/**
 * Races a promise against a timeout so a stalled network can never leave a save
 * hanging forever (which is what strands the UI on "Saving…"). Always clears its
 * timer so it doesn't leak.
 */
export function withTimeout<T>(
  p: Promise<T>,
  ms: number = SAVE_TIMEOUT_MS,
  label = "Request",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

interface ErrLike {
  name?: string;
  message?: string;
  code?: string | number;
  status?: number;
  statusCode?: number | string;
  error_description?: string;
}

/** Flattens the useful text out of the many error shapes Supabase throws. */
function errText(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  const o = e as ErrLike;
  return [
    o.message,
    o.error_description,
    o.code != null ? String(o.code) : "",
    o.name,
    o.status != null ? String(o.status) : "",
    o.statusCode != null ? String(o.statusCode) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Inspects a thrown error / Supabase response and maps it to a plain-language
 * reason. Order matters: more specific signals (auth, permission, upload) are
 * checked before the broad network/server buckets.
 */
export function classifySaveError(
  e: unknown,
  opts?: { duringUpload?: boolean },
): ClassifiedSaveError {
  const o = e as ErrLike;
  const name = o?.name ?? "";
  const status = Number(o?.status ?? o?.statusCode ?? NaN);
  const t = errText(e).toLowerCase();

  // Supabase simply isn't wired up — saving locally is the expected behaviour.
  if (name === "SupabaseNotConfiguredError" || t.includes("not configured")) {
    return {
      kind: "offline",
      title: "Saved on this device",
      message:
        "Cloud sync isn't set up, so your changes are stored on this device only.",
    };
  }

  // Our own timeout wrapper, or an upstream timeout.
  if (name === "TimeoutError" || t.includes("timed out") || t.includes("timeout")) {
    return {
      kind: "timeout",
      title: "Network timeout",
      message:
        "Saving to the cloud took too long. Your changes are kept on this device — check your connection and try again.",
    };
  }

  // Expired / missing session. The artist must re-authenticate.
  if (
    status === 401 ||
    t.includes("jwt") ||
    t.includes("expired") ||
    t.includes("not authenticated") ||
    t.includes("invalid token") ||
    t.includes("refresh token") ||
    t.includes("unauthorized") ||
    t.includes("pgrst301")
  ) {
    return {
      kind: "auth",
      title: "Session expired",
      message:
        "Your session has expired. Sign in again to sync to the cloud — your changes are kept on this device.",
    };
  }

  // Row-level security / forbidden.
  if (
    status === 403 ||
    t.includes("row-level security") ||
    t.includes("row level security") ||
    (t.includes("violates") && t.includes("policy")) ||
    t.includes("permission denied") ||
    t.includes("forbidden") ||
    t.includes("not allowed")
  ) {
    return {
      kind: "permission",
      title: "Permission denied",
      message:
        "The server rejected this change due to a permissions rule. Your changes are kept on this device.",
    };
  }

  // Storage / image upload.
  if (
    opts?.duringUpload ||
    status === 413 ||
    t.includes("storage") ||
    t.includes("bucket") ||
    t.includes("object too large") ||
    t.includes("payload too large")
  ) {
    return {
      kind: "upload",
      title: "Image upload failed",
      message:
        "We couldn't upload the image to the cloud. Your changes are kept on this device — check your connection and try again.",
    };
  }

  // Connectivity.
  if (
    t.includes("network request failed") ||
    t.includes("failed to fetch") ||
    t.includes("networkerror") ||
    t.includes("network error") ||
    t.includes("econn") ||
    t.includes("enotfound") ||
    t.includes("offline") ||
    t.includes("fetch")
  ) {
    return {
      kind: "network",
      title: "No connection",
      message:
        "We couldn't reach the cloud. Your changes are kept on this device — reconnect and try again.",
    };
  }

  // Generic server / database trouble.
  if (status >= 500 || t.includes("pgrst") || t.includes("postgres") || t.includes("database")) {
    return {
      kind: "server",
      title: "Couldn't save to cloud",
      message:
        "The server had a problem saving your changes. They're kept on this device — please try again.",
    };
  }

  return {
    kind: "unknown",
    title: "Couldn't save to cloud",
    message:
      "Something went wrong saving to the cloud. Your changes are kept on this device — please try again.",
  };
}

/**
 * Shows a classified failure as an in-app notice (toast on web, alert on
 * native). The benign local-only case uses the calmer "info" styling.
 */
export function notifySaveError(error: ClassifiedSaveError) {
  notice({
    title: error.title,
    message: error.message,
    variant: error.kind === "offline" ? "info" : "error",
  });
}

/**
 * Shows the diagnosed failure and offers a single retry. Resolves true when the
 * artist chooses to try the cloud save again. The copy stays honest: the work is
 * always preserved on the device either way.
 */
export function offerRetry(error: ClassifiedSaveError): Promise<boolean> {
  return confirm({
    title: error.title,
    message: error.message,
    confirmText: "Try again",
    cancelText: "Keep on device",
  });
}
