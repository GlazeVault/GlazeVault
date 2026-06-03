export interface PublicMetaPiece {
  clay: string;
  dimensions: string;
  year: string;
}

/**
 * Builds the single quiet metadata line shown on EVERY public surface
 * (portfolio cards, public collection display, piece detail, fullscreen viewer).
 *
 * The public portfolio is a fixed, gallery-like format: every piece shows the
 * same three artwork-identity fields — clay body · dimensions · year. There are
 * no per-field toggles; technical/firing data (glaze, cone, firing environment,
 * recipe, firing notes) is never shown publicly and lives only on the owner's
 * private studio record. Empty fields are dropped (no gaps), and because every
 * surface calls this one function the same string renders identically across the
 * app, e.g. "Stoneware · 12 × 12 × 14 in · 2025".
 */
export function buildPublicMetaLine(piece: PublicMetaPiece): string {
  return [piece.clay, piece.dimensions, piece.year]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join("  ·  ");
}

/**
 * Whether a collection is published to the artist's portfolio. This is the single
 * source of truth for the redesigned one-switch publishing model. `featuredOnSite`
 * is the stored flag — the only publishing control there is.
 */
export function isCollectionInPortfolio(collection: {
  featuredOnSite: boolean;
}): boolean {
  return !!collection.featuredOnSite;
}

/**
 * The public pieces of a collection: every piece in the collection that has a
 * photo. There is no per-piece publishing control — a piece is public iff its
 * collection is in the portfolio (checked by the caller) and it has an image.
 */
export function getPublicCollectionPieces<
  P extends { collectionId?: string; imageUri?: string }
>(collection: { id: string }, pieces: P[]): P[] {
  return pieces.filter((p) => p.collectionId === collection.id && !!p.imageUri);
}

/**
 * Whether a piece surfaces on a public, non-owner surface. A piece is public iff
 * it belongs to a collection that is in the portfolio AND it has a photo. Pieces
 * without a collection (or whose collection was deleted / is hidden) are never
 * public — putting a collection in the portfolio is the only way to publish.
 */
export function isPubliclyVisiblePiece(
  piece: { collectionId?: string; imageUri?: string },
  collections: { id: string; featuredOnSite: boolean }[]
): boolean {
  if (!piece.imageUri) return false;
  if (!piece.collectionId) return false;
  const parent = collections.find((c) => c.id === piece.collectionId);
  return !!parent && isCollectionInPortfolio(parent);
}
