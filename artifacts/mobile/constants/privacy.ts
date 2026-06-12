export interface PublicMetaPiece {
  clay: string;
  dimensions: string;
  year: string;
}

/**
 * The allowlist of piece fields that may cross onto a public, non-owner surface
 * — the portfolio, public collection pages, the public piece view,
 * fullscreen-viewer captions, shared links, and any future feed / discover /
 * search / exported surface.
 *
 * Two tiers:
 *  - ALWAYS public (when the piece itself is public): id, title, image, and the
 *    artwork-identity meta — clay body, dimensions, year.
 *  - OPT-IN per piece, OFF by default: glaze details (glaze / cone / firing
 *    environment) gated by `showGlazeDetails`, and studio notes gated by
 *    `showStudioNotes`. These keys are only PRESENT on the projection when the
 *    artist enabled the matching toggle for that piece — they are added, never
 *    defaulted, so an off-by-default piece literally has no key to read.
 *
 * Everything else a piece carries is private studio knowledge and never crosses
 * over: glaze recipes beyond the named glaze, firing schedules, clay-body
 * formulas, test results, pricing, collector notes, experiments, internal tags.
 *
 * `toPublicPiece` is the single boundary that enforces this. Public surfaces
 * must consume the `PublicPieceView` it returns — never the raw piece — so a
 * private field cannot leak even by accident: the projected object physically
 * contains only the always-public keys plus whichever opt-in keys were enabled.
 * To expose a NEW public field, add it here AND to the privacy guard test.
 */
export interface PublicPieceView {
  id: string;
  title: string;
  imageUri: string;
  clay: string;
  dimensions: string;
  year: string;
  // Opt-in: present ONLY when the piece's `showGlazeDetails` is true.
  glaze?: string;
  cone?: string;
  firingEnvironment?: string;
  // Opt-in: present ONLY when the piece's `showStudioNotes` is true.
  notes?: string;
}

/** Loose input shape so any owner piece (or partial) can be projected safely. */
type ProjectablePiece = {
  id: string;
  title?: string;
  imageUri?: string;
  clay?: string;
  dimensions?: string;
  year?: string;
  // Whether the piece is public at all. The opt-in glaze/notes keys are gated on
  // this too (defense in depth), so a non-public piece can never project them
  // even if its per-piece flags happen to be on.
  isPublic?: boolean;
  // Owner-only studio fields + the per-piece flags that gate their exposure.
  glaze?: string;
  cone?: string;
  firing?: string;
  firingEnvironment?: string;
  notes?: string;
  showGlazeDetails?: boolean;
  showStudioNotes?: boolean;
};

/**
 * Strip a piece down to the public allowlist. This is the one place where an
 * owner record becomes safe to render publicly. The always-public identity
 * fields are projected unconditionally; the opt-in glaze and notes keys are
 * added ONLY when the piece is public AND enabled the matching toggle, so a
 * piece that never opted in (or is not public) carries no glaze/cone/firing/notes
 * key at all — it is structurally impossible for those to reach a public surface
 * by default.
 *
 * The `isPublic` gate is deliberate defense in depth: every render path already
 * refuses non-public pieces via `isPubliclyVisiblePiece`, but the boundary
 * itself also refuses to project private fields for a non-public piece, so a
 * future caller that forgets the render-path gate still cannot leak them.
 */
export function toPublicPiece(piece: ProjectablePiece): PublicPieceView {
  const view: PublicPieceView = {
    id: piece.id,
    title: piece.title ?? "",
    imageUri: piece.imageUri ?? "",
    clay: piece.clay ?? "",
    dimensions: piece.dimensions ?? "",
    year: piece.year ?? "",
  };
  // Opt-in fields only ever cross over for a piece that is itself public.
  const isPublic = piece.isPublic ?? false;
  // Glaze details cross over only when the piece is public AND the artist opted
  // this piece in. Each key is added (never defaulted), so an off / non-public
  // piece has no glaze/cone/firing key at all.
  if (isPublic && piece.showGlazeDetails) {
    view.glaze = piece.glaze ?? "";
    view.cone = piece.cone ?? "";
    view.firingEnvironment = piece.firingEnvironment ?? piece.firing ?? "";
  }
  // Studio notes cross over only when public AND opted in.
  if (isPublic && piece.showStudioNotes) {
    view.notes = piece.notes ?? "";
  }
  return view;
}

/**
 * Builds the single quiet metadata line shown on EVERY public surface
 * (portfolio cards, public collection display, piece detail, fullscreen viewer).
 *
 * The public gallery's meta line is a fixed, catalog-like format: every piece
 * shows the same three artwork-identity fields — clay body · dimensions · year.
 * This line itself never carries technical/firing data or notes. The per-piece
 * opt-in glaze details and studio notes (see `toPublicPiece`) render as their
 * own elements on the public piece view, NOT in this line, so cards and
 * captions stay calm and uniform. Empty fields are dropped (no gaps), and
 * because every surface calls this one function the same string renders
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
  /** Plain display title (piece/collection/artist name) — shown in the sheet. */
  title: string;
  /**
   * Attribution headline that travels with the share, e.g.
   * "Memory of Clay — Sang-Jeong Lee on GlazeVault". Used as the native share
   * subject/title and the first line of the message so the recipient always
   * sees what the work is, whose archive it belongs to, and that it lives on
   * GlazeVault — sharing is recommending an exhibition, never reposting.
   */
  headline: string;
  message: string;
  url: string;
}

/**
 * Builds the attribution headline shared alongside a public link. Always
 * preserves the original artist — "{Title} — {Artist} on GlazeVault" — so a
 * shared piece/collection points back to whose archive it came from. When the
 * title already IS the artist (a portfolio) or no artist is given, it collapses
 * to "{Title} on GlazeVault" rather than repeating the name.
 */
export function buildAttributionHeadline(
  title: string,
  artistName?: string,
): string {
  const t = (title ?? "").trim() || "GlazeVault";
  const a = (artistName ?? "").trim();
  if (a && a.toLowerCase() !== t.toLowerCase()) {
    return `${t} — ${a} on GlazeVault`;
  }
  return `${t} on GlazeVault`;
}

/**
 * Builds the content used when SHARING a piece. Sharing is just another public
 * surface — the moment a piece's details leave the app they reach whoever the
 * artist shares with — so the share payload deliberately carries only the fixed
 * minimal set: the piece title, the quiet clay · dimensions · year meta line,
 * and the public site link. Even a piece that opted glaze details or studio
 * notes into its public VIEW keeps them out of the share text; those details
 * live on the public page behind the link, not in the shared blurb.
 *
 * The piece is projected through `toPublicPiece` FIRST and only its title +
 * meta line are read, so glaze, cone, firing environment, studio notes, pricing
 * and every other field are dropped before the message is assembled and cannot
 * leak into a share even by accident. Empty fields are omitted so the message
 * has no blank lines.
 */
export function buildShareContent(
  piece: ProjectablePiece,
  shareUrl: string,
  artistName?: string,
): ShareContent {
  const pub = toPublicPiece(piece);
  const title = (pub.title ?? "").trim() || "Untitled piece";
  const headline = buildAttributionHeadline(title, artistName);
  const meta = buildPublicMetaLine(pub);
  const message = [headline, meta, (shareUrl ?? "").trim()]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join("\n");
  return { title, headline, message, url: (shareUrl ?? "").trim() };
}

/**
 * Builds share content for a non-piece public surface — a Collection
 * (mini-exhibition) or the Portfolio. These carry no piece projection, only a
 * title, an optional quiet subtitle, and the public link, so there is no
 * owner-only studio field that could leak. Empty parts are dropped so the
 * message has no blank lines.
 */
export function buildLinkShareContent(
  title: string,
  shareUrl: string,
  subtitle?: string,
  artistName?: string,
): ShareContent {
  const cleanTitle = (title ?? "").trim() || "GlazeVault";
  const headline = buildAttributionHeadline(cleanTitle, artistName);
  const url = (shareUrl ?? "").trim();
  const message = [headline, (subtitle ?? "").trim(), url]
    .map((v) => v.trim())
    .filter(Boolean)
    .join("\n");
  return { title: cleanTitle, headline, message, url };
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

export const MAX_PORTFOLIO_ITEMS = 12;

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

/**
 * A piece on the curated Portfolio. Featuring is GATED: a piece can only belong
 * to the portfolio when it is featured AND public, with a photo and not
 * archived. Collections are optional organization, closer to tags/groups, so
 * portfolio membership does not require collection membership.
 */
export function isPortfolioPiece(piece: PieceLike): boolean {
  return (
    !!piece.featuredInPortfolio &&
    !!piece.isPublic &&
    !piece.archived &&
    !!piece.imageUri
  );
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
 * Enforces the Portfolio ⊆ Public invariant on a piece's stored flags: a piece
 * can never be featured while it is private. A private piece is invisible to the
 * public site, so a lingering `featuredInPortfolio: true` on a private piece is a
 * confusing, illegal state. Applied centrally in the data layer (on load and on
 * every update) so the invariant holds no matter the source — a toggle, the
 * editor, archive, or a legacy/remote row — rather than depending on every call
 * site to remember it. Returns a corrected copy only when needed.
 */
export function enforceVisibilityInvariant<
  T extends { isPublic?: boolean; featuredInPortfolio?: boolean },
>(piece: T): T {
  if (!piece.isPublic && piece.featuredInPortfolio) {
    return { ...piece, featuredInPortfolio: false };
  }
  return piece;
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
 * The curated portfolio pieces of a collection: members that pass the full
 * portfolio gate (isPortfolioPiece — featured + public + photo + not archived).
 * A public collection with none of these yields an empty list, and its caller
 * drops it from the portfolio entirely.
 */
export function getPortfolioCollectionPieces<P extends PieceLike>(
  collection: { id: string },
  pieces: P[]
): P[] {
  return pieces.filter(
    (p) => (p.collectionIds ?? []).includes(collection.id) && isPortfolioPiece(p)
  );
}

/**
 * Resolves the cover image (and the piece it should link to, if any) for a
 * collection on a GATED surface — the curated Portfolio or a public collection.
 *
 * The leak this closes: a cover image can be picked FROM an in-collection piece,
 * so an artist may set a collection's cover to a piece that is NOT curated for
 * the surface (a public-but-unfeatured piece, or a private/archived one). Naively
 * honoring `coverImageUri` would then surface that uncurated piece's artwork on a
 * Portfolio/public view even though the piece is correctly filtered out of the
 * grid — making it look like the piece is in the Portfolio. The cover must be
 * gated by the SAME rule as the surface it sits on.
 *
 * The caller passes the already-gated `eligible` set for THAT surface (featured
 * pieces for the Portfolio, publicly-visible pieces for a public collection) and
 * the widest piece list it can see as `available`. The rule:
 *
 *  - A cover that matches an `eligible` piece is kept and made tappable to it.
 *  - A dedicated uploaded cover (matches no piece, and is not a piece-storage
 *    image) is kept — it represents the collection, not a piece — but stays
 *    non-tappable.
 *  - A cover pointing at an uncurated piece (present in `available` but not
 *    `eligible`, or a piece-storage image not visible to this surface, e.g. a
 *    private piece on a remote public view) is DROPPED and replaced by the first
 *    eligible piece's image, so an uncurated piece can never represent the surface.
 *
 * Because each surface supplies its own `eligible` set, Portfolio covers and
 * public-collection covers are filtered independently.
 */
export function resolveGatedCover<P extends PieceLike & { id: string }>(
  collection: { coverImageUri?: string },
  eligible: P[],
  available: P[]
): { coverUri: string | null; coverPieceId: string | null } {
  const fallback = eligible.find((p) => !!p.imageUri) ?? null;
  const cover = (collection.coverImageUri ?? "").trim();
  if (cover) {
    const eligibleMatch = eligible.find((p) => p.imageUri === cover);
    if (eligibleMatch) {
      return { coverUri: cover, coverPieceId: eligibleMatch.id };
    }
    const isKnownPiece = available.some((p) => p.imageUri === cover);
    // A cover that matches no known piece AND is not a piece-storage image is a
    // dedicated uploaded cover — safe. `pieces/` is the storage namespace for
    // piece photos; covers upload to `collections/` (see uploadImage). Match the
    // segment in both the remote URL form (`.../pieces/…`) and the native
    // relative form (`pieces/…`, no leading slash). This net catches a private
    // piece used as a cover on a remote public view, where the private piece is
    // absent from `available` and so would otherwise slip past.
    const isPieceImage = /(?:^|\/)pieces\//.test(cover);
    if (!isKnownPiece && !isPieceImage) {
      return { coverUri: cover, coverPieceId: null };
    }
  }
  return { coverUri: fallback?.imageUri ?? null, coverPieceId: fallback?.id ?? null };
}

/**
 * The set of pieces the PUBLIC fullscreen viewer may swipe through, given the
 * piece the visitor opened and the collection context they came from (`fromId`).
 *
 * When `fromId` names a PUBLIC collection, the swipe set is scoped to exactly
 * that collection's portfolio pieces — so swiping stays consistent with the
 * collection section the visitor was browsing, never wandering into another
 * collection's work. Without a valid public `fromId` it falls back to portfolio
 * pieces sharing ANY public collection with the opened piece. Either way the set
 * is gated by `isPortfolioPiece` (featured + public + photo + not archived), so
 * a private/archived/unfeatured piece is never reachable, and a piece outside
 * the curated portfolio always swipes alone.
 */
export function getPublicSwipePieces<P extends PieceLike & { id: string }>(
  piece: P,
  pieces: P[],
  collections: CollectionLike[],
  fromId?: string | null
): P[] {
  const scopeId =
    fromId && collections.some((c) => c.id === fromId && isCollectionPublic(c))
      ? fromId
      : null;
  const scopedSiblings = (ids: string[]): P[] =>
    pieces.filter(
      (p) =>
        (p.collectionIds ?? []).some((cid) => ids.includes(cid)) && isPortfolioPiece(p)
    );
  if (scopeId) {
    const siblings = scopedSiblings([scopeId]);
    return siblings.some((p) => p.id === piece.id) ? siblings : [piece];
  }
  const sharedPublicIds = (piece.collectionIds ?? []).filter((cid) =>
    collections.some((c) => c.id === cid && isCollectionPublic(c))
  );
  if (sharedPublicIds.length === 0) return [piece];
  const siblings = scopedSiblings(sharedPublicIds);
  return siblings.some((p) => p.id === piece.id) ? siblings : [piece];
}
