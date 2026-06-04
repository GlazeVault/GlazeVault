import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

const IMAGES_DIR = "pieces";

/**
 * Reads a web image URI (blob: / http:) into a base64 data URI. Picked images
 * on web are `blob:` URLs that are revoked the moment the page reloads, so the
 * raw URI must never be persisted — we inline the bytes instead so the image
 * survives reloads.
 */
async function webImageToDataUri(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read picked image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Copies a picked image into permanent app storage and returns a stable URI to
 * persist.
 *
 * Image picker / camera results live in a temporary cache that the OS can purge
 * at any time, so the raw picker URI must never be stored in piece data.
 *
 * - Web: returns a base64 `data:` URI (survives page reloads).
 * - Native: copies the file into `documentDirectory/pieces/` and returns a
 *   RELATIVE path (e.g. `pieces/123-abc.jpg`). Storing the relative path — not
 *   the absolute `file://` URI — is important because iOS changes the app
 *   container path between builds/installs, which would otherwise orphan every
 *   saved photo. Use `resolveImageSource` to turn it back into a usable URI.
 *
 * Idempotent: seed refs, data URIs, already-uploaded remote (`http(s)://`) URLs,
 * and already-persisted relative paths are returned untouched. This matters for
 * metadata-only edits: once a piece has synced to Supabase its `imageUri` is a
 * remote Storage URL, and trying to re-store that (copying it as a local file on
 * native, or re-fetching it on web) would throw and abort the whole save.
 */
export async function persistPieceImage(uri: string): Promise<string> {
  if (!uri) return uri;
  if (uri.startsWith("@seed")) return uri;
  if (uri.startsWith("data:")) return uri;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;

  if (Platform.OS === "web") {
    return await webImageToDataUri(uri);
  }

  // Already a persisted relative path (no scheme) — nothing to copy.
  if (!uri.includes("://")) return uri;

  const dir = new Directory(Paths.document, IMAGES_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const source = new File(uri);
  const ext = source.extension || ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
  const dest = new File(dir, filename);
  source.copy(dest);
  return `${IMAGES_DIR}/${filename}`;
}

/**
 * Reconciles a piece's cover (`imageUri`) with its ordered photo set (`images`)
 * so the two are always consistent. This is the single normalizer used wherever
 * a piece is read in (cache load, remote row, addPiece):
 *
 * - Drops empty/non-string entries from `images`.
 * - If `images` is empty, seeds it from the cover (back-compat: older rows only
 *   had `imageUri`).
 * - If the cover is empty, adopts the first image.
 * - Guarantees the cover is a member of `images` (prepends it if missing).
 *
 * The returned `imageUri` is always the cover and is always present in `images`
 * (unless the piece genuinely has no photos, in which case both are empty).
 */
export function coalesceImages(
  imageUri: string | undefined | null,
  images: readonly (string | undefined | null)[] | undefined | null,
): { imageUri: string; images: string[] } {
  const list = Array.isArray(images)
    ? images.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  let cover = typeof imageUri === "string" ? imageUri : "";
  let result = list;
  if (result.length === 0) {
    result = cover ? [cover] : [];
  } else if (!cover) {
    cover = result[0];
  } else if (!result.includes(cover)) {
    result = [cover, ...result];
  }
  return { imageUri: cover, images: result };
}
