export interface PublicMetaPiece {
  clay: string;
  dimensions: string;
  year: string;
}

/**
 * The exhaustive allowlist of piece fields that may EVER cross onto a public,
 * non-owner surface — the portfolio, public collection pages, the public piece
 * view, fullscreen-viewer captions, shared links, and any future feed /
 * discover / search / exported surface.
 *
 * Everything else a piece carries is private studio knowledge and must never be
 * shown publicly: glaze recipes, firing schedules, kiln/process notes, clay-body
 * formulas, test results, cone / firing environment, pricing, collector notes,
 * unfinished experiments, and internal tags.
 *
 * `toPublicPiece` is the single boundary that enforces this. Public surfaces
 * must consume the `PublicPieceView` it returns — never the raw piece — so a
 * private field cannot leak even by accident, because the projected object
 * physically contains only these keys. To expose a NEW public field, add it
 * here AND to the privacy guard test — nowhere else.
 */
export interface PublicPieceView {
  id: string;
  title: string;
  imageUri: string;
  clay: string;
  dimensions: string;
  year: string;
}

/** Loose input shape so any owner piece (or partial) can be projected safely. */
type ProjectablePiece = {
  id: string;
  title?: string;
  imageUri?: string;
  clay?: string;
  dimensions?: string;
  year?: string;
};

/**
 * Strip a piece down to ONLY the public allowlist. This is the one place where
 * an owner record becomes safe to render publicly: the returned object carries
 * no glaze, firing, notes, pricing, tags, or any other studio field, so it is
 * structurally impossible for those to reach a public surface.
 */
export function toPublicPiece(piece: ProjectablePiece): PublicPieceView {
  return {
    id: piece.id,
    title: piece.title ?? "",
    imageUri: piece.imageUri ?? "",
    clay: piece.clay ?? "",
    dimensions: piece.dimensions ?? "",
    year: piece.year ?? "",
  };
}

/**
 * Builds the single quiet metadata line shown on EVERY public surface
 * (portfolio cards, public collection display, piece detail, fullscreen viewer).
 *
 * The public gallery is a fixed, catalog-like format: every piece shows the
 * same three artwork-identity fields — clay body · dimensions · year. There are
 * no per-field toggles; technical/firing data (glaze, cone, firing environment,
 * recipe, firing notes) and private studio notes are never shown publicly and
 * live only on the owner's private record. Empty fields are dropped (no gaps),
 * and because every surface calls this one function the same string renders
 * identically across the app, e.g. "Stoneware · 12 × 12 × 14 in · 2025".
 */
export function buildPublicMetaLine(piece: PublicMetaPiece): string {
  return [piece.clay, piece.dimensions, piece.year]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join("  ·  ");
}

/** The text/payload produced when a piece is shared (copy-link, social, etc.). */
export interface ShareContent {
  title: string;
  message: string;
  url: string;
}

/**
 * Builds the content used when SHARING a piece. Sharing is just another public
 * surface — the moment a piece's details leave the app they reach whoever the
 * artist shares with — so the share payload may only ever carry the same fixed
 * public set as every other public surface: the piece title, the quiet
 * clay · dimensions · year meta line, and the public site link.
 *
 * The piece is projected through `toPublicPiece` FIRST, so glaze recipes, firing
 * schedules, cone / firing environment, studio notes, pricing and every other
 * owner-only field are physically dropped before the message is assembled and
 * cannot leak into a share even by accident. Empty fields are omitted so the
 * message has no blank lines.
 */
export function buildShareContent(
  piece: ProjectablePiece,
  shareUrl: string,
): ShareContent {
  const pub = toPublicPiece(piece);
  const title = (pub.title ?? "").trim() || "Untitled piece";
  const meta = buildPublicMetaLine(pub);
  const message = [title, meta, (shareUrl ?? "").trim()]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join("\n");
  return { title, message, url: (shareUrl ?? "").trim() };
}

// Minimal structural shapes the helpers need. Declared here (rather than
// importing the context types) so this module stays dependency-free and the
// helpers can be reused anywhere without import cycles.
type PieceLike = {
  collectionIds?: string[];
  imageUri?: string;
  isPublic?: boolean;
  featuredInPortfolio?: boolean;
  archived?: boolean;
};
type CollectionLike = { id: string; visibility?: "public" | "private" };

/**
 * GlazeVault separates organization (Collections) from curation (Portfolio) and
 * from discovery (Public). Three independent piece states drive every surface:
 *
 *  - `isPublic`            → the piece is viewable/discoverable by others at all
 *                            (public collections, shared/public archive).
 *  - `featuredInPortfolio` → the piece is hand-picked for the curated Portfolio.
 *  - `archived`            → soft-retired: kept in the owner's archive but never
 *                            shown on any public/portfolio surface.
 *
 * Portfolio ⊆ Public is kept as an invariant by the toggle handlers (featuring a
 * piece also makes it public; un-publishing also un-features it), but each public
 * surface still re-checks the relevant flag here so gating never depends on UI.
 */

/** A piece on the curated Portfolio: featured, has a photo, not archived. */
export function isPortfolioPiece(piece: PieceLike): boolean {
  return !!piece.featuredInPortfolio && !!piece.imageUri && !piece.archived;
}

/** A piece discoverable on any public, non-owner surface: public, photo, not archived. */
export function isPubliclyVisiblePiece(piece: PieceLike): boolean {
  return !!piece.isPublic && !!piece.imageUri && !piece.archived;
}

/** Whether a collection itself is browsable publicly. */
export function isCollectionPublic(collection: CollectionLike): boolean {
  return collection.visibility === "public";
}

/**
 * Every piece that belongs to a collection (owner view). Membership is the
 * multi-collection `collectionIds` array. Archived pieces are NOT filtered here —
 * the owner still sees their full archive; public surfaces do the gating.
 */
export function getCollectionPieces<P extends { collectionIds?: string[] }>(
  collection: { id: string },
  pieces: P[]
): P[] {
  return pieces.filter((p) => (p.collectionIds ?? []).includes(collection.id));
}

/**
 * The public pieces of a collection: members that are publicly visible. Used
 * when displaying a public collection to a non-owner.
 */
export function getPublicCollectionPieces<P extends PieceLike>(
  collection: { id: string },
  pieces: P[]
): P[] {
  return pieces.filter(
    (p) => (p.collectionIds ?? []).includes(collection.id) && isPubliclyVisiblePiece(p)
  );
}

/**
 * A piece that belongs on the curated public Portfolio: publicly visible AND
 * hand-picked via the "Feature in Portfolio" star. This is the single gate that
 * decides what a visitor sees on the portfolio — combine the public-visibility
 * and featured checks so the rule never depends on UI state.
 */
export function isFeaturedPublicPiece(piece: PieceLike): boolean {
  return isPubliclyVisiblePiece(piece) && !!piece.featuredInPortfolio;
}

/**
 * The curated portfolio pieces of a collection: members that are BOTH publicly
 * visible and featured. This is the source of truth for what renders on the
 * public portfolio — a public collection with no featured pieces yields an
 * empty list (and is dropped from the portfolio by its caller).
 */
export function getFeaturedCollectionPieces<P extends PieceLike>(
  collection: { id: string },
  pieces: P[]
): P[] {
  return pieces.filter(
    (p) => (p.collectionIds ?? []).includes(collection.id) && isFeaturedPublicPiece(p)
  );
}
