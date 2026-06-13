/** Normalizes a user-facing public handle/path segment. */
export function normalizePublicHandle(raw: string): string {
  const handle = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const reserved = new Set([
    "archive",
    "auth",
    "collection",
    "piece",
    "public-site",
  ]);
  return reserved.has(handle) ? "" : handle;
}

/**
 * Derives a legacy public-facing URL slug from an artist name. Falls back to a
 * neutral placeholder so a URL preview is never empty. Kept in its own
 * dependency-free module so both the profile context (which owns the artist
 * name) and the data service (which resolves a public artist *by* slug) can
 * share one definition without a circular import.
 */
export function publicSiteSlug(name: string): string {
  return normalizePublicHandle(name) || "your-studio";
}
