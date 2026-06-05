/**
 * Owner fullscreen viewer: opens at the TAPPED photo's flattened index.
 *
 * The owner viewer FLATTENS every in-scope piece to one entry per photo so the
 * owner can swipe through every photo of every piece. The viewer's start
 * position is therefore `pieceStartIndex + offset`, where `pieceStartIndex` is
 * where the current piece's photos begin in the flattened list and `offset` is
 * which of the current piece's own photos was tapped (the cover for the hero, or
 * the tapped thumbnail's index).
 *
 * This index math is easy to break in a refactor — an off-by-one or a switch
 * back to per-piece indexing would open the viewer on the wrong photo (or the
 * wrong piece). These tests render the real owner detail screen with multiple
 * multi-photo pieces, tap the hero, and assert the ImageViewer is handed an
 * `initialIndex` whose flattened item is exactly the cover photo (the hero is
 * the only thumbnail that opens the viewer; the detail strip's thumbnails now
 * promote the tapped photo to cover instead — see the photo-reorder tests).
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import type { PotteryPiece } from "@/context/PotteryContext";

// Two earlier pieces (2 + 1 = 3 photos) precede the piece under test, so its
// photos start at flattened index 3 — proving the start offset is real, not 0.
const PIECE_A: PotteryPiece = makePiece("a", "pieces/a0.jpg", [
  "pieces/a0.jpg",
  "pieces/a1.jpg",
]);
const PIECE_B: PotteryPiece = makePiece("b", "pieces/b0.jpg", ["pieces/b0.jpg"]);
// The piece under test. Its COVER is the middle photo, so coverOffset === 1 —
// the hero must open at the cover, not at images[0].
const PIECE_C: PotteryPiece = makePiece("c", "pieces/c1.jpg", [
  "pieces/c0.jpg",
  "pieces/c1.jpg",
  "pieces/c2.jpg",
]);

// Flattened owner viewer list (archive scope, in pieces order):
//   0:a0 1:a1 | 2:b0 | 3:c0 4:c1 5:c2
// PIECE_C starts at 3; its cover (c1) sits at flattened index 4.
const FLATTENED = [
  "pieces/a0.jpg",
  "pieces/a1.jpg",
  "pieces/b0.jpg",
  "pieces/c0.jpg",
  "pieces/c1.jpg",
  "pieces/c2.jpg",
];
const PIECE_C_START = 3;

function makePiece(id: string, cover: string, images: string[]): PotteryPiece {
  return {
    id,
    title: `Piece ${id}`,
    clay: "",
    glaze: "",
    cone: "",
    dimensions: "",
    year: "",
    notes: "",
    firing: "",
    firingEnvironment: "",
    imageUri: cover,
    images,
    createdAt: "2025-01-01T00:00:00.000Z",
    isFavorite: false,
    collectionIds: [],
    featuredInPortfolio: false,
    isPublic: false,
    archived: false,
    showGlazeDetails: false,
    showStudioNotes: false,
  };
}

const mockPieces: PotteryPiece[] = [PIECE_A, PIECE_B, PIECE_C];

// Capture every set of props the (mocked) fullscreen viewer is handed so the
// test can read back the initialIndex it would open at. Factory-referenced outer
// vars must be `mock`-prefixed.
const mockViewerProps: Array<Record<string, unknown>> = [];

// Render at PIECE_C in the owner (non-public) archive scope — no `from`, so the
// viewer spans the whole archive and the flattened start offset is non-zero.
let mockRouterParams: Record<string, string> = { id: "c" };

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockRouterParams,
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Warning: "warning" },
}));

jest.mock("expo-image", () => {
  const ReactModule = require("react");
  const RN = require("react-native");
  return { Image: (props: Record<string, unknown>) => ReactModule.createElement(RN.View, props) };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/constants/seedImages", () => ({
  resolveImageSource: (uri: string) => ({ uri }),
}));

jest.mock("@/components/ImageViewer", () => ({
  ImageViewer: (props: Record<string, unknown>) => {
    mockViewerProps.push(props);
    return null;
  },
}));

jest.mock("@/components/ShareSheet", () => ({
  ShareSheet: () => null,
}));

jest.mock("@/context/PotteryContext", () => ({
  usePottery: () => ({
    pieces: mockPieces,
    updatePiece: jest.fn(),
    toggleFavorite: jest.fn(),
    deletePiece: jest.fn(),
    addPieceToCollection: jest.fn(),
    removePieceFromCollection: jest.fn(),
    getPiece: (id: string) => mockPieces.find((p) => p.id === id),
  }),
}));

jest.mock("@/context/CollectionsContext", () => ({
  useCollections: () => ({ collections: [] }),
}));

jest.mock("@/context/SavedContext", () => ({
  useSaved: () => ({
    saved: { pieces: [], collections: [], artists: [], following: [] },
    hydrated: true,
    isPieceSaved: () => false,
    togglePieceSaved: () => {},
    isCollectionSaved: () => false,
    toggleCollectionSaved: () => {},
    isArtistSaved: () => false,
    toggleArtistSaved: () => {},
    isFollowing: () => false,
    toggleFollowing: () => {},
  }),
}));

jest.mock("@/context/ProfileContext", () => ({
  useProfile: () => ({ profile: { name: "Test Artist" } }),
  PUBLIC_SITE_DOMAIN: "glazevault.art",
  publicSiteSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
  publicBaseUrl: (name: string) =>
    `https://glazevault.art/${name.toLowerCase().replace(/\s+/g, "-")}`,
  portfolioShareUrl: (name: string) =>
    `https://glazevault.art/${name.toLowerCase().replace(/\s+/g, "-")}`,
  collectionShareUrl: (name: string, id: string) =>
    `https://glazevault.art/${name.toLowerCase().replace(/\s+/g, "-")}/collection/${id}`,
  pieceShareUrl: (name: string, id: string) =>
    `https://glazevault.art/${name.toLowerCase().replace(/\s+/g, "-")}/piece/${id}`,
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () =>
    new Proxy(
      { radius: 12 },
      {
        get: (target, prop) =>
          typeof prop === "string" && prop in target
            ? (target as Record<string, unknown>)[prop]
            : "#000000",
      },
    ),
}));

// The uri the viewer would open on, given the latest captured initialIndex.
function lastOpenedUri(): string {
  expect(mockViewerProps.length).toBeGreaterThan(0);
  const props = mockViewerProps[mockViewerProps.length - 1];
  const items = props.items as Array<{ uri: string }>;
  const initialIndex = props.initialIndex as number;
  // The viewer's flattened item list must match our expected flattening.
  expect(items.map((i) => i.uri)).toEqual(FLATTENED);
  return items[initialIndex].uri;
}

describe("owner viewer opens at the tapped photo's flattened index", () => {
  beforeEach(() => {
    mockRouterParams = { id: "c" };
    mockViewerProps.length = 0;
  });

  it("flattens to one entry per photo across all in-scope pieces", () => {
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    render(<PieceDetailScreen />);
    const props = mockViewerProps[mockViewerProps.length - 1];
    expect((props.items as unknown[]).map((i) => (i as { uri: string }).uri)).toEqual(
      FLATTENED,
    );
  });

  it("hero tap opens at the piece's COVER, offset into the flattened list", () => {
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    const { getByLabelText } = render(<PieceDetailScreen />);
    // Cover of PIECE_C is c1 → coverOffset 1 → flattened PIECE_C_START + 1 = 4.
    fireEvent.press(getByLabelText("View Piece c fullscreen"));
    const props = mockViewerProps[mockViewerProps.length - 1];
    expect(props.initialIndex).toBe(PIECE_C_START + 1);
    expect(lastOpenedUri()).toBe("pieces/c1.jpg");
  });
});
