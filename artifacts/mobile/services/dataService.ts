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
import { isPubliclyVisiblePiece } from "@/constants/privacy";
import { publicSiteSlug } from "@/constants/slug";
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
  // Owner. Always set for rows written by the authenticated app; legacy rows
  // (pre-auth) may be null until claimed by the first account.
  user_id: string | null;
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

// Columns added by later schema.sql migrations that a deployed database may not
// have yet. `savePiece` strips any that are reported missing (one per upsert
// attempt) so the core piece still persists; the dropped values stay in the
// local cache until supabase/schema.sql is applied. Core columns (image_url,
// is_public, featured_in_portfolio, collection_ids, user_id) are NOT listed —
// their absence is a real error that must surface.
const OPTIONAL_PIECE_COLUMNS: (keyof PieceRow)[] = [
  "image_urls",
  "show_glaze_details",
  "show_studio_notes",
];

function pieceToRow(p: PotteryPiece, userId: string): PieceRow {
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
    user_id: userId,
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

/**
 * Loads the signed-in artist's OWN pieces. Filtered by `user_id` so the public
 * pieces of OTHER artists (also visible to this role under RLS) never leak into
 * the owner's private archive.
 */
export async function loadPieces(userId: string): Promise<PotteryPiece[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("pieces")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PieceRow[]).map(rowToPiece);
}

/**
 * Upserts a piece. Any local image URI is uploaded to Storage first and the
 * returned record carries the public URL, so callers can keep their cache in
 * sync with what now lives remotely.
 */
export async function savePiece(
  piece: PotteryPiece,
  userId: string,
): Promise<PotteryPiece> {
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
  // Persist. Some columns are newer than the deployed schema may be
  // (OPTIONAL_PIECE_COLUMNS); the strip-and-retry loop below keeps saving working
  // on a database that predates a migration — see its comment for details.
  const row = pieceToRow(toSave, userId);
  const attempt = { ...row };
  let { error } = await client.from("pieces").upsert(attempt);
  // Degraded mode: a database that predates a column migration rejects the
  // upsert with a missing-column error (PGRST204 / 42703) naming ONE column at a
  // time. We strip exactly the column named, then retry — looping so multiple
  // missing columns are handled, and only dropping what is actually absent (a DB
  // that has `show_*` but lacks `image_urls` keeps its flags). The piece's core
  // fields — including the cover `image_url`, `is_public`, and
  // `featured_in_portfolio` — still save, so the write reaches Supabase and the
  // public link works; the dropped columns live only in the local cache until
  // supabase/schema.sql is applied.
  const dropped: (keyof PieceRow)[] = [];
  while (error) {
    const missing = OPTIONAL_PIECE_COLUMNS.find(
      (c) => !dropped.includes(c) && isMissingColumnError(error, [c]),
    );
    if (!missing) break;
    delete (attempt as Partial<PieceRow>)[missing];
    dropped.push(missing);
    ({ error } = await client.from("pieces").upsert(attempt));
  }
  if (dropped.length) {
    console.warn(
      `[supabase] pieces table is missing column(s) ${dropped.join(", ")}; ` +
        "saved without them (kept in local cache only). Apply supabase/schema.sql " +
        "to persist them.",
    );
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
  user_id: string | null;
};

function collectionToRow(c: Collection, userId: string): CollectionRow {
  return {
    id: c.id,
    title: c.title,
    intro: c.intro,
    created_at: c.createdAt,
    visibility: c.visibility,
    cover_image_url: c.coverImageUri ?? null,
    user_id: userId,
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

/** Loads the signed-in artist's OWN collections (filtered by `user_id`). */
export async function loadCollections(userId: string): Promise<Collection[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("collections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CollectionRow[]).map(rowToCollection);
}

export async function saveCollection(
  c: Collection,
  userId: string,
): Promise<Collection> {
  const client = requireClient();
  const coverUrl = await uploadImage(c.coverImageUri, "collections");
  const toSave: Collection = { ...c, coverImageUri: coverUrl ?? c.coverImageUri };
  const { error } = await client.from("collections").upsert(collectionToRow(toSave, userId));
  if (error) throw error;
  return toSave;
}

export async function deleteCollection(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("collections").delete().eq("id", id);
  if (error) throw error;
}

// ── Profile (singleton) ─────────────────────────────────────────────────────

// One profile row per authenticated user, keyed by the user id (text) with a
// matching `user_id` for RLS.
type ProfileRow = {
  id: string;
  name: string;
  tagline: string;
  bio: string;
  statement: string;
  website: string;
  instagram: string;
  avatar_url: string | null;
  hero_image_url: string | null;
  hero_focal_y: number | null;
  public_site: ArtistProfile["publicSite"] | null;
  user_id: string | null;
};

function profileToRow(p: ArtistProfile, userId: string): ProfileRow {
  return {
    // One profile row per user; the primary key is the user id (text). This
    // replaces the legacy single-row id = 'default' from the pre-auth schema.
    id: userId,
    name: p.name,
    tagline: p.tagline,
    bio: p.bio,
    statement: p.statement,
    website: p.website,
    instagram: p.instagram,
    avatar_url: p.avatarUri ?? null,
    hero_image_url: p.heroImageUri ?? null,
    hero_focal_y: p.heroFocalY ?? 0.5,
    public_site: p.publicSite,
    user_id: userId,
  };
}

function rowToProfile(r: ProfileRow): Partial<ArtistProfile> {
  return {
    name: r.name ?? "",
    tagline: r.tagline ?? "",
    bio: r.bio ?? "",
    statement: r.statement ?? "",
    website: r.website ?? "",
    instagram: r.instagram ?? "",
    avatarUri: r.avatar_url ?? undefined,
    heroImageUri: r.hero_image_url ?? undefined,
    heroFocalY: r.hero_focal_y ?? 0.5,
    publicSite: r.public_site ?? undefined,
  };
}

/** Returns the signed-in artist's profile, or `null` when none saved yet. */
export async function loadProfile(
  userId: string,
): Promise<Partial<ArtistProfile> | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function saveProfile(
  p: ArtistProfile,
  userId: string,
): Promise<ArtistProfile> {
  const client = requireClient();
  const avatarUrl = await uploadImage(p.avatarUri, "avatars");
  // The hero image is uploaded independently of the avatar so the two never
  // share storage or overwrite each other.
  const heroUrl = await uploadImage(p.heroImageUri, "avatars");
  const toSave: ArtistProfile = {
    ...p,
    avatarUri: avatarUrl ?? p.avatarUri,
    heroImageUri: heroUrl ?? p.heroImageUri,
  };
  const { error } = await client.from("profiles").upsert(profileToRow(toSave, userId));
  if (error) throw error;
  return toSave;
}

/**
 * Seed fields captured at sign-up. All optional except — practically — the
 * display name, which the UI requires.
 */
export type ProfileSeed = {
  name?: string;
  website?: string;
  instagram?: string;
  avatarUri?: string;
};

/**
 * Ensures the signed-in artist has a profile row, creating a minimal one from
 * the sign-up `seed` if absent. Never overwrites an existing profile, so it is
 * safe to call on every login. Returns the (possibly newly created) profile.
 */
export async function ensureProfile(
  userId: string,
  seed: ProfileSeed = {},
): Promise<Partial<ArtistProfile> | null> {
  const client = requireClient();
  const existing = await loadProfile(userId);
  if (existing) return existing;
  const avatarUrl = await uploadImage(seed.avatarUri, "avatars");
  const row: ProfileRow = {
    id: userId,
    name: seed.name ?? "",
    tagline: "",
    bio: "",
    statement: "",
    website: seed.website ?? "",
    instagram: seed.instagram ?? "",
    avatar_url: avatarUrl ?? null,
    hero_image_url: null,
    hero_focal_y: 0.5,
    public_site: null,
    user_id: userId,
  };
  const { error } = await client.from("profiles").upsert(row);
  if (error) throw error;
  return rowToProfile(row);
}

/**
 * One-time claim of the pre-auth archive (rows with `user_id` null + the
 * legacy 'default' profile) for the first account. Server-side function is
 * latched, so only the very first authenticated caller actually inherits the
 * data; everyone else gets `false`. Safe to call on any first session.
 */
export async function claimLegacyArchive(): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client.rpc("claim_legacy_archive");
  if (error) throw error;
  return data === true;
}

// ── Public (by slug, cross-account) ─────────────────────────────────────────

// These power the LIVE public exhibition pages, which a visitor (a *different*
// signed-in artist, or a fully anonymous viewer) reaches by link. They read
// strictly through the public projection — only an artist's publicly-visible
// pieces and public collections are returned — and rely on RLS allowing anon /
// authenticated SELECT of public rows. The owner-scoped loaders above are NOT
// reused here: those filter to the *signed-in* user, whereas a public visitor
// must be able to load *another* artist's public archive.

/**
 * Resolves a public artist by their URL slug. There is no slug column — the slug
 * is derived from the artist name — so we fetch the (RLS-restricted) profiles
 * whose public site is enabled and match the derived slug in memory. Returns the
 * owner `userId` plus the public-safe profile, or null when nothing matches.
 */
export async function loadPublicProfileBySlug(
  slug: string,
): Promise<{ userId: string; profile: Partial<ArtistProfile> } | null> {
  const client = requireClient();
  // Slug is derived from the display name (no persisted unique slug column yet),
  // so two enabled profiles could in principle normalize to the same slug.
  // The profiles table has NO `created_at` column, so we must NOT order by it
  // server-side — doing so makes PostgREST return a 400 that bubbles up as a
  // failed public fetch ("Not on view") for every anonymous visitor. Instead we
  // fetch the (RLS-restricted) rows and sort DETERMINISTICALLY in memory by the
  // stable `user_id`, so a given public link always lands on the same artist
  // rather than whichever row the backend happened to return first.
  const { data, error } = await client.from("profiles").select("*");
  if (error) throw error;
  const rows = [...((data as ProfileRow[]) ?? [])].sort((a, b) =>
    (a.user_id ?? "").localeCompare(b.user_id ?? ""),
  );
  const match = rows.find(
    (r) =>
      !!r.user_id &&
      !!r.public_site?.enabled &&
      publicSiteSlug(r.name ?? "") === slug,
  );
  if (!match || !match.user_id) return null;
  return { userId: match.user_id, profile: rowToProfile(match) };
}

/** A public artist's publicly-visible pieces (public, has a photo, not archived). */
export async function loadPublicPiecesForUser(
  userId: string,
): Promise<PotteryPiece[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("pieces")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PieceRow[]).map(rowToPiece).filter(isPubliclyVisiblePiece);
}

/** A public artist's public collections. */
export async function loadPublicCollectionsForUser(
  userId: string,
): Promise<Collection[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("collections")
    .select("*")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CollectionRow[]).map(rowToCollection);
}
