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

import type { Collection } from "@/context/CollectionsContext";
import type { ArtistProfile } from "@/context/ProfileContext";
import type { PotteryPiece } from "@/context/PotteryContext";
import {
  DEFAULT_PUBLIC_DATA_SETTINGS,
  type PublicDataSettings,
  type Visibility,
} from "@/constants/privacy";

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
  image_url: string;
  created_at: string;
  is_favorite: boolean;
  visibility: string;
  public_data_settings: PublicDataSettings | null;
  collection_id: string | null;
};

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
    image_url: p.imageUri,
    created_at: p.createdAt,
    is_favorite: p.isFavorite,
    visibility: p.visibility,
    public_data_settings: p.publicDataSettings,
    collection_id: p.collectionId ?? null,
  };
}

function rowToPiece(r: PieceRow): PotteryPiece {
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
    imageUri: r.image_url ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
    isFavorite: r.is_favorite ?? false,
    visibility: (r.visibility as Visibility) ?? "private",
    publicDataSettings: {
      ...DEFAULT_PUBLIC_DATA_SETTINGS,
      ...(r.public_data_settings ?? {}),
    },
    collectionId: r.collection_id ?? undefined,
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
  const imageUrl = await uploadImage(piece.imageUri, "pieces");
  const toSave: PotteryPiece = { ...piece, imageUri: imageUrl ?? piece.imageUri };
  const { error } = await client.from("pieces").upsert(pieceToRow(toSave));
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
  visibility: string;
  featured_on_site: boolean;
  cover_image_url: string | null;
};

function collectionToRow(c: Collection): CollectionRow {
  return {
    id: c.id,
    title: c.title,
    intro: c.intro,
    created_at: c.createdAt,
    visibility: c.visibility,
    featured_on_site: c.featuredOnSite,
    cover_image_url: c.coverImageUri ?? null,
  };
}

function rowToCollection(r: CollectionRow): Collection {
  return {
    id: r.id,
    title: r.title ?? "",
    intro: r.intro ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
    visibility: (r.visibility as Visibility) ?? "private",
    featuredOnSite: r.featured_on_site ?? false,
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
