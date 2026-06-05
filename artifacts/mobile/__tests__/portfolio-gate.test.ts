/**
 * Locks the GATED portfolio rule. A piece may appear on the curated Portfolio
 * only when it is featured AND public AND filed in at least one collection, with
 * a photo and not archived. isPortfolioPiece is the single source of truth read
 * by the badge, the public site, the profile preview, and the swipe set — if any
 * leg of the gate is dropped, every one of those surfaces would over-expose, so
 * this test guards the rule directly rather than per-surface.
 */
import {
  enforceVisibilityInvariant,
  getPortfolioCollectionPieces,
  getPublicSwipePieces,
  isPortfolioPiece,
  resolveGatedCover,
} from "@/constants/privacy";

type Piece = Parameters<typeof isPortfolioPiece>[0] & { id: string };

function makePiece(overrides: Partial<Piece> = {}): Piece {
  return {
    id: "p1",
    imageUri: "pieces/p1.jpg",
    collectionIds: ["c1"],
    featuredInPortfolio: true,
    isPublic: true,
    archived: false,
    ...overrides,
  };
}

describe("isPortfolioPiece gate", () => {
  it("accepts a featured, public, collected piece with a photo", () => {
    expect(isPortfolioPiece(makePiece())).toBe(true);
  });

  it("rejects a piece that is not featured", () => {
    expect(isPortfolioPiece(makePiece({ featuredInPortfolio: false }))).toBe(false);
  });

  it("rejects a featured piece that is not public", () => {
    expect(isPortfolioPiece(makePiece({ isPublic: false }))).toBe(false);
  });

  it("rejects a featured public piece with no collection", () => {
    expect(isPortfolioPiece(makePiece({ collectionIds: [] }))).toBe(false);
  });

  it("rejects an archived piece", () => {
    expect(isPortfolioPiece(makePiece({ archived: true }))).toBe(false);
  });

  it("rejects a piece without a photo", () => {
    expect(isPortfolioPiece(makePiece({ imageUri: undefined }))).toBe(false);
  });
});

describe("enforceVisibilityInvariant", () => {
  it("drops the featured flag on a private piece (Portfolio ⊆ Public)", () => {
    expect(
      enforceVisibilityInvariant({ isPublic: false, featuredInPortfolio: true })
    ).toEqual({ isPublic: false, featuredInPortfolio: false });
  });

  it("leaves a featured public piece untouched", () => {
    const piece = { isPublic: true, featuredInPortfolio: true };
    expect(enforceVisibilityInvariant(piece)).toBe(piece);
  });

  it("leaves an unfeatured private piece untouched", () => {
    const piece = { isPublic: false, featuredInPortfolio: false };
    expect(enforceVisibilityInvariant(piece)).toBe(piece);
  });

  it("preserves the other fields when correcting", () => {
    const piece = { id: "p1", isPublic: false, featuredInPortfolio: true, title: "Bowl" };
    expect(enforceVisibilityInvariant(piece)).toEqual({
      id: "p1",
      isPublic: false,
      featuredInPortfolio: false,
      title: "Bowl",
    });
  });
});

describe("getPortfolioCollectionPieces", () => {
  it("returns only members that pass the full gate", () => {
    const pieces = [
      makePiece({ id: "ok" }),
      makePiece({ id: "private", isPublic: false }),
      makePiece({ id: "unfeatured", featuredInPortfolio: false }),
      makePiece({ id: "other", collectionIds: ["c2"] }),
    ];
    const result = getPortfolioCollectionPieces({ id: "c1" }, pieces);
    expect(result.map((p) => p.id)).toEqual(["ok"]);
  });

  it("yields an empty list for a collection with nothing featured", () => {
    const pieces = [makePiece({ id: "a", featuredInPortfolio: false })];
    expect(getPortfolioCollectionPieces({ id: "c1" }, pieces)).toEqual([]);
  });
});

describe("getPublicSwipePieces", () => {
  const collections = [
    { id: "c1", visibility: "public" as const },
    { id: "c2", visibility: "public" as const },
    { id: "cp", visibility: "private" as const },
  ];

  it("scopes the swipe set to the collection the visitor came from", () => {
    const opened = makePiece({ id: "a", collectionIds: ["c1", "c2"] });
    const pieces = [
      opened,
      makePiece({ id: "b", collectionIds: ["c1"] }),
      makePiece({ id: "c", collectionIds: ["c2"] }),
    ];
    const result = getPublicSwipePieces(opened, pieces, collections, "c1");
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("excludes public-but-unfeatured siblings within the scoped collection", () => {
    const opened = makePiece({ id: "a", collectionIds: ["c1"] });
    const pieces = [
      opened,
      makePiece({ id: "unfeatured", collectionIds: ["c1"], featuredInPortfolio: false }),
      makePiece({ id: "private", collectionIds: ["c1"], isPublic: false }),
      makePiece({ id: "archived", collectionIds: ["c1"], archived: true }),
    ];
    const result = getPublicSwipePieces(opened, pieces, collections, "c1");
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("falls back to shared public collections when no from is given", () => {
    const opened = makePiece({ id: "a", collectionIds: ["c1", "c2"] });
    const pieces = [
      opened,
      makePiece({ id: "b", collectionIds: ["c1"] }),
      makePiece({ id: "c", collectionIds: ["c2"] }),
    ];
    const result = getPublicSwipePieces(opened, pieces, collections, undefined);
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores a from that is a private collection and falls back", () => {
    const opened = makePiece({ id: "a", collectionIds: ["c1", "cp"] });
    const pieces = [
      opened,
      makePiece({ id: "b", collectionIds: ["c1"] }),
      makePiece({ id: "secret", collectionIds: ["cp"] }),
    ];
    const result = getPublicSwipePieces(opened, pieces, collections, "cp");
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("swipes alone when the opened piece is not itself a portfolio piece", () => {
    const opened = makePiece({ id: "a", collectionIds: ["c1"], featuredInPortfolio: false });
    const pieces = [opened, makePiece({ id: "b", collectionIds: ["c1"] })];
    const result = getPublicSwipePieces(opened, pieces, collections, "c1");
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("resolveGatedCover (portfolio surface — featured gate)", () => {
  const featured = makePiece({ id: "f", imageUri: "/pieces/featured.jpg" });
  const unfeatured = makePiece({
    id: "u",
    imageUri: "/pieces/unfeatured.jpg",
    featuredInPortfolio: false,
  });
  const eligible = getPortfolioCollectionPieces({ id: "c1" }, [featured, unfeatured]);
  const available = [featured, unfeatured];

  it("keeps a cover that is itself a featured piece and links to it", () => {
    const out = resolveGatedCover(
      { coverImageUri: "/pieces/featured.jpg" },
      eligible,
      available,
    );
    expect(out).toEqual({ coverUri: "/pieces/featured.jpg", coverPieceId: "f" });
  });

  it("drops a cover set to an unfeatured piece, falling back to a featured one", () => {
    const out = resolveGatedCover(
      { coverImageUri: "/pieces/unfeatured.jpg" },
      eligible,
      available,
    );
    expect(out).toEqual({ coverUri: "/pieces/featured.jpg", coverPieceId: "f" });
  });

  it("honors a dedicated uploaded cover (not a piece image), non-tappable", () => {
    const out = resolveGatedCover(
      { coverImageUri: "https://x/collections/cover.jpg" },
      eligible,
      available,
    );
    expect(out).toEqual({
      coverUri: "https://x/collections/cover.jpg",
      coverPieceId: null,
    });
  });

  it("drops a private piece used as a cover even when absent from the visible set", () => {
    // On a remote public view the private piece is not in `available`, so the
    // pieces/ namespace net must still reject it rather than treat it as upload.
    const out = resolveGatedCover(
      { coverImageUri: "https://x/pieces/private.jpg" },
      eligible,
      available,
    );
    expect(out).toEqual({ coverUri: "/pieces/featured.jpg", coverPieceId: "f" });
  });

  it("drops a native relative piece path (no leading slash) used as a cover", () => {
    // Native persists piece photos as `pieces/<name>` with no leading slash; the
    // namespace net must catch that form too, not only the remote `/pieces/` URL.
    const out = resolveGatedCover(
      { coverImageUri: "pieces/private.jpg" },
      eligible,
      available,
    );
    expect(out).toEqual({ coverUri: "/pieces/featured.jpg", coverPieceId: "f" });
  });

  it("falls back to a featured piece when no cover is set", () => {
    const out = resolveGatedCover({}, eligible, available);
    expect(out).toEqual({ coverUri: "/pieces/featured.jpg", coverPieceId: "f" });
  });
});

describe("resolveGatedCover (saved / public-collection surface — featured gate)", () => {
  // The saved-exhibition thumbnail uses the SAME featured Portfolio gate as the
  // public site, so a cover pointing at a non-featured (or private) piece is
  // dropped to a featured one rather than pulling the uncurated piece in as the
  // public collection's cover.
  const featured = makePiece({ id: "f", imageUri: "/pieces/featured.jpg" });
  const publicUnfeatured = makePiece({
    id: "pu",
    imageUri: "/pieces/pu.jpg",
    featuredInPortfolio: false,
  });
  const privatePiece = makePiece({
    id: "pr",
    imageUri: "/pieces/pr.jpg",
    isPublic: false,
  });
  const available = [featured, publicUnfeatured, privatePiece];
  const eligible = getPortfolioCollectionPieces({ id: "c1" }, available);

  it("drops a cover set to a public-but-unfeatured piece, falling back to a featured one", () => {
    const out = resolveGatedCover(
      { coverImageUri: "/pieces/pu.jpg" },
      eligible,
      available,
    );
    expect(out).toEqual({ coverUri: "/pieces/featured.jpg", coverPieceId: "f" });
  });

  it("drops a cover set to a private piece, falling back to a featured one", () => {
    const out = resolveGatedCover(
      { coverImageUri: "/pieces/pr.jpg" },
      eligible,
      available,
    );
    expect(out).toEqual({ coverUri: "/pieces/featured.jpg", coverPieceId: "f" });
  });
});
