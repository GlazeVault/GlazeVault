// Data service layer for GlazeVault.
//
// This is the single boundary between the app's domain types (camelCase, defined
// in the context providers) and Supabase (snake_case rows + Storage). Every
// function is a no-op-safe guard around `isSupabaseConfigured`: when Supabase is
// not set up these throw `SupabaseNotConfiguredError`, and callers fall back to
// the AsyncStorage cache. When it IS set up, Supabase is the source of truth.
//
// Tables (see supabase/schema.sql): pieces, collections, profiles.
// Storage bucket: `images` (public).

import {
  IMAGE_BUCKET,
  isSupabaseConfigured,
  supabase,
} from "./supabase";

import { coalesceImages } from "@/constants/imageStorage";
import type { Collection } from "@/context/CollectionsContext";
import type { ArtistProfile } from "@/context/ProfileContext";
import type { PotteryPiece } from "@/context/PotteryContext";

/** Thrown when a remote call is attempted with no Supabase config. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured");
    this.name = "SupabaseNotConfiguredError";
  }
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new SupabaseNotConfiguredError();
  }
  return supabase;
}

// ── Image upload ────────────────────────────────────────────────────────────

/**
 * Uploads a locally-stored image to Supabase Storage and returns its public
 * URL. Already-remote (`http(s)`) URLs and the bundled `@seed/...` refs are
 * returned untouched so we never re-upload. Accepts the URI shapes GlazeVault
 * persists locally: web `data:` URIs and native relative `pieces/...` paths
 * (resolved via `resolveImageSource`), plus raw `file://`/`content://` picker
 * URIs as a fallback.
 */
export async function uploadImage(
  uri: string | undefined | null,
  folder: "pieces" | "collections" | "avatars",
): Promise<string | undefined> {
  if (!uri) return uri ?? undefined;
  if (uri.startsWith("@seed")) return uri;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;

  const client = requireClient();

  const { bytes, contentType, ext } = await readImageBytes(uri);
  const path = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${ext}`;

  const { error } = await client.storage
    .from(IMAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;

  const { data } = client.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  console.log("[supabase] uploaded image", path);
  return data.publicUrl;
}

/** Reads any supported local image URI into raw bytes + a content type. */
async function readImageBytes(
  uri: string,
): Promise<{ bytes: ArrayBuffer; contentType: string; ext: string }> {
  // Resolve native relative paths (e.g. "pieces/123.jpg") to a file:// URI.
  let fetchUri = uri;
  if (!uri.includes("://") && !uri.startsWith("data:")) {
    const { resolveImageSource } = await import("@/constants/seedImages");
    fetchUri = resolveImageSource(uri).uri ?? uri;
  }

  const res = await fetch(fetchUri);
  const blob = await res.blob();
  const bytes = await blobToArrayBuffer(blob);
  const contentType = blob.type || guessContentType(uri);
  const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
  return { bytes, contentType, ext };
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  // Blob.arrayBuffer() is not available on all RN runtimes; FileReader is.
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read image bytes"));
    reader.readAsArrayBuffer(blob);
  });
}

function guessContentType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

// ── Pieces ──────────────────────────────────────────────────────────────────

// A piece's organization + curation state lives in explicit, typed columns:
// `collection_ids` (multi-collection membership) plus the `featured_in_portfolio`
// / `is_public` / `archived` booleans. These replaced an opaque JSON meta blob
// (`public_data_settings`) and the singular `collection_id` fallback column —
// the data is now legible, queryable, and indexable. See supabase/schema.sql for
// the migration that backfilled these from the retired blob.
type PieceRow = {
  id: string;
  title: string;
  notes: string;
  clay: string;
  glaze: string;
  firing: string;
  cone: string;
  firing_environment: string;
  dimensions: string;
  year: string;
  image_url: string;
  // Ordered set of all photo URLs. `image_url` (the cover) is always a member.
  // Older rows predate this column; `rowToPiece` reconciles via `coalesceImages`.
  image_urls: string[] | null;
  created_at: string;
  is_favorite: boolean;
  collection_ids: string[] | null;
  featured_in_portfolio: boolean | null;
  is_public: boolean | null;
  archived: boolean | null;
  // Per-piece public field exposure. Newer columns; a database that predates the
  // migration in supabase/schema.sql lacks them, so `savePiece` retries without
  // them and `rowToPiece` default-coerces (`!!`). Default false everywhere.
  show_glaze_details: boolean | null;
  show_studio_notes: boolean | null;
};

/**
 * True when a Supabase write failed because the table is missing one of the
 * given columns (an older schema). PostgREST reports a missing column as
 * PGRST204 and names it in the message; we also match the column names so the
 * caller can safely retry without those keys.
 */
function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  columns: string[],
): boolean {
  if (!error) return false;
  // PostgREST's missing-column / schema-cache errors (PGRST204, and Postgres'
  // 42703 "column does not exist") always name the offending column in the
  // message. We require one of OUR columns to be named — regardless of code — so
  // an unrelated schema-cache error never silently triggers the strip-and-retry
  // fallback (and a future PostgREST error code is still handled if it names the
  // column).
  const message = error.message ?? "";
  return columns.some((c) => message.includes(c));
}

function pieceToRow(p: PotteryPiece): PieceRow {
  return {
    id: p.id,
    title: p.title,
    notes: p.notes,
    clay: p.clay,
    glaze: p.glaze,
    firing: p.firing,
    cone: p.cone,
    firing_environment: p.firingEnvironment,
    dimensions: p.dimensions,
    year: p.year,
    image_url: p.imageUri,
    image_urls: p.images,
    created_at: p.createdAt,
    is_favorite: p.isFavorite,
    collection_ids: p.collectionIds,
    featured_in_portfolio: p.featuredInPortfolio,
    is_public: p.isPublic,
    archived: p.archived,
    show_glaze_details: p.showGlazeDetails,
    show_studio_notes: p.showStudioNotes,
  };
}

function rowToPiece(r: PieceRow): PotteryPiece {
  const collectionIds = Array.isArray(r.collection_ids)
    ? r.collection_ids.filter((id): id is string => typeof id === "string")
    : [];
  // Reconcile the cover (`image_url`) with the full photo set so older rows
  // (which only had `image_url`) seed `images`, and the cover is always present.
  const { imageUri, images } = coalesceImages(r.image_url, r.image_urls);
  return {
    id: r.id,
    title: r.title ?? "",
    notes: r.notes ?? "",
    clay: r.clay ?? "",
    glaze: r.glaze ?? "",
    firing: r.firing ?? "",
    cone: r.cone ?? "",
    firingEnvironment: r.firing_environment ?? r.firing ?? "",
    dimensions: r.dimensions ?? "",
    year: r.year ?? "",
    imageUri,
    images,
    createdAt: r.created_at ?? new Date().toISOString(),
    isFavorite: r.is_favorite ?? false,
    collectionIds,
    featuredInPortfolio: !!r.featured_in_portfolio,
    isPublic: !!r.is_public,
    archived: !!r.archived,
    showGlazeDetails: !!r.show_glaze_details,
    showStudioNotes: !!r.show_studio_notes,
  };
}

export async function loadPieces(): Promise<PotteryPiece[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("pieces")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PieceRow[]).map(rowToPiece);
}

/**
 * Upserts a piece. Any local image URI is uploaded to Storage first and the
 * returned record carries the public URL, so callers can keep their cache in
 * sync with what now lives remotely.
 */
export async function savePiece(piece: PotteryPiece): Promise<PotteryPiece> {
  const client = requireClient();
  // Normalize first so the cover is guaranteed to be a member of the photo set,
  // then upload every photo (uploadImage is idempotent for already-remote URLs)
  // and remap the cover to its uploaded URL by position.
  const { imageUri, images } = coalesceImages(piece.imageUri, piece.images);
  const coverIndex = Math.max(0, images.indexOf(imageUri));
  const uploaded = await Promise.all(
    images.map((uri) => uploadImage(uri, "pieces")),
  );
  const uploadedImages = uploaded.map((url, i) => url ?? images[i]);
  const uploadedCover = uploadedImages[coverIndex] ?? imageUri;
  const toSave: PotteryPiece = {
    ...piece,
    imageUri: uploadedCover,
    images: uploadedImages,
  };
  // Persist. The per-piece public-exposure flags (show_glaze_details /
  // show_studio_notes) are newer columns; if a database predates the migration
  // the upsert fails with a missing-column error. We retry once without those
  // keys so saving never breaks — the flags then live only in the local cache
  // until supabase/schema.sql is applied.
  const row = pieceToRow(toSave);
  let { error } = await client.from("pieces").upsert(row);
  if (error && isMissingColumnError(error, ["show_glaze_details", "show_studio_notes"])) {
    // Degraded mode: the database predates the migration. We retry without the
    // two flag columns so the rest of the piece still saves, but warn loudly —
    // the flags now live ONLY in the local cache and a remote-wins reload will
    // revert them to false. Applying supabase/schema.sql clears this path.
    console.warn(
      "[supabase] pieces table is missing show_glaze_details/show_studio_notes; " +
        "saved without per-piece public-visibility flags. Apply supabase/schema.sql " +
        "to persist them.",
    );
    const legacyRow = { ...row };
    delete (legacyRow as Partial<PieceRow>).show_glaze_details;
    delete (legacyRow as Partial<PieceRow>).show_studio_notes;
    ({ error } = await client.from("pieces").upsert(legacyRow));
  }
  if (error) throw error;
  return toSave;
}

export async function deletePiece(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("pieces").delete().eq("id", id);
  if (error) throw error;
}

// ── Collections ───────────────────────────────────────────────────────────--

type CollectionRow = {
  id: string;
  title: string;
  intro: string;
  created_at: string;
  // The collection's public/private state maps to the existing `visibility`
  // text column. The legacy `featured_on_site` column is no longer read or
  // written — "Show in Portfolio" moved to the piece level. It is left in place
  // (defaults to false) so omitting it from upserts is safe.
  visibility: "public" | "private";
  cover_image_url: string | null;
};

function collectionToRow(c: Collection): CollectionRow {
  return {
    id: c.id,
    title: c.title,
    intro: c.intro,
    created_at: c.createdAt,
    visibility: c.visibility,
    cover_image_url: c.coverImageUri ?? null,
  };
}

function rowToCollection(r: CollectionRow): Collection {
  return {
    id: r.id,
    title: r.title ?? "",
    intro: r.intro ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
    visibility: r.visibility === "public" ? "public" : "private",
    coverImageUri: r.cover_image_url ?? undefined,
  };
}

export async function loadCollections(): Promise<Collection[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("collections")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CollectionRow[]).map(rowToCollection);
}

export async function saveCollection(c: Collection): Promise<Collection> {
  const client = requireClient();
  const coverUrl = await uploadImage(c.coverImageUri, "collections");
  const toSave: Collection = { ...c, coverImageUri: coverUrl ?? c.coverImageUri };
  const { error } = await client.from("collections").upsert(collectionToRow(toSave));
  if (error) throw error;
  return toSave;
}

export async function deleteCollection(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("collections").delete().eq("id", id);
  if (error) throw error;
}

// ── Profile (singleton) ─────────────────────────────────────────────────────

// GlazeVault has no auth yet, so the profile is a single row keyed by a fixed
// id. When auth lands, swap this for the authenticated user's id.
const PROFILE_ID = "default";

type ProfileRow = {
  id: string;
  name: string;
  bio: string;
  statement: string;
  website: string;
  instagram: string;
  avatar_url: string | null;
  public_site: ArtistProfile["publicSite"] | null;
};

function profileToRow(p: ArtistProfile): ProfileRow {
  return {
    id: PROFILE_ID,
    name: p.name,
    bio: p.bio,
    statement: p.statement,
    website: p.website,
    instagram: p.instagram,
    avatar_url: p.avatarUri ?? null,
    public_site: p.publicSite,
  };
}

function rowToProfile(r: ProfileRow): Partial<ArtistProfile> {
  return {
    name: r.name ?? "",
    bio: r.bio ?? "",
    statement: r.statement ?? "",
    website: r.website ?? "",
    instagram: r.instagram ?? "",
    avatarUri: r.avatar_url ?? undefined,
    publicSite: r.public_site ?? undefined,
  };
}

/** Returns the stored profile, or `null` when none has been saved yet. */
export async function loadProfile(): Promise<Partial<ArtistProfile> | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", PROFILE_ID)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function saveProfile(p: ArtistProfile): Promise<ArtistProfile> {
  const client = requireClient();
  const avatarUrl = await uploadImage(p.avatarUri, "avatars");
  const toSave: ArtistProfile = { ...p, avatarUri: avatarUrl ?? p.avatarUri };
  const { error } = await client.from("profiles").upsert(profileToRow(toSave));
  if (error) throw error;
  return toSave;
}
