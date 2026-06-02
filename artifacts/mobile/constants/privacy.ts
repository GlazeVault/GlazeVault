export type Visibility = "public" | "private";

export interface PublicDataSettings {
  showTitle: boolean;
  showPhotos: boolean;
  showDescription: boolean;
  showClayBody: boolean;
  showGlazeName: boolean;
  showGlazeRecipe: boolean;
  showCone: boolean;
  showFiringEnvironment: boolean;
  showFiringNotes: boolean;
  showDimensions: boolean;
  showPrice: boolean;
}

export const DEFAULT_PUBLIC_DATA_SETTINGS: PublicDataSettings = {
  showTitle: true,
  showPhotos: true,
  showDescription: true,
  showClayBody: false,
  showGlazeName: true,
  showGlazeRecipe: false,
  showCone: false,
  showFiringEnvironment: false,
  showFiringNotes: false,
  showDimensions: true,
  showPrice: false,
};

export const PUBLIC_DATA_FIELDS: { key: keyof PublicDataSettings; label: string }[] = [
  { key: "showTitle", label: "Title" },
  { key: "showPhotos", label: "Photos" },
  { key: "showDescription", label: "Studio Notes" },
  { key: "showClayBody", label: "Clay Body" },
  { key: "showGlazeName", label: "Glaze Name" },
  { key: "showGlazeRecipe", label: "Glaze Recipe" },
  { key: "showCone", label: "Cone" },
  { key: "showFiringEnvironment", label: "Firing Environment" },
  { key: "showFiringNotes", label: "Firing Notes" },
  { key: "showDimensions", label: "Dimensions" },
  { key: "showPrice", label: "Price" },
];

export function isPiecePublic(piece: { visibility: Visibility }): boolean {
  return piece.visibility === "public";
}

export function isCollectionPublic(collection: { visibility: Visibility }): boolean {
  return collection.visibility === "public";
}

/**
 * Whether a collection should surface on the public site. Featuring requires the
 * collection to be public — a private collection can never be featured, so the
 * public flag always wins over a stale `featuredOnSite` value.
 */
export function isCollectionFeatured(collection: {
  visibility: Visibility;
  featuredOnSite: boolean;
}): boolean {
  return isCollectionPublic(collection) && collection.featuredOnSite;
}

export function getPublicCollectionPieces<
  P extends { collectionId?: string; visibility: Visibility }
>(collection: { id: string }, pieces: P[]): P[] {
  return pieces.filter((p) => p.collectionId === collection.id && isPiecePublic(p));
}

/**
 * Whether a piece should surface on a public, non-owner surface (e.g. a public
 * portfolio). A public piece is hidden if it lives inside a private collection —
 * collection visibility can suppress a public piece, but can never reveal a
 * private one. Pieces without a collection (or whose collection was deleted)
 * surface as long as the piece itself is public.
 */
export function isPubliclyVisiblePiece(
  piece: { visibility: Visibility; collectionId?: string },
  collections: { id: string; visibility: Visibility }[]
): boolean {
  if (!isPiecePublic(piece)) return false;
  if (!piece.collectionId) return true;
  const parent = collections.find((c) => c.id === piece.collectionId);
  if (parent && !isCollectionPublic(parent)) return false;
  return true;
}
