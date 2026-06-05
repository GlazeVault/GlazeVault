/**
 * Locks the GATED portfolio rule. A piece may appear on the curated Portfolio
 * only when it is featured AND public AND filed in at least one collection, with
 * a photo and not archived. isPortfolioPiece is the single source of truth read
 * by the badge, the public site, the profile preview, and the swipe set — if any
 * leg of the gate is dropped, every one of those surfaces would over-expose, so
 * this test guards the rule directly rather than per-surface.
 */
import {
  getPortfolioCollectionPieces,
  getPublicSwipePieces,
  isPortfolioPiece,
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
