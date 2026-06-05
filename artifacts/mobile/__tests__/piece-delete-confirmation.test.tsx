/**
 * End-to-end coverage that the piece detail screen's destructive footer link runs
 * the right context action *only* when the user confirms, and navigates back.
 *
 * The bug this guards: on web the confirm prompt silently did nothing, so a
 * "confirm" never reached deletePiece / removePieceFromCollection. Here the
 * cross-platform confirm() helper is mocked to a controllable boolean so each test
 * drives the confirmed vs. cancelled branch and asserts the side effects:
 *
 *   - no `from`  → footer reads "Delete piece" → confirm "Remove Piece" →
 *                  deletePiece(id) + router.back()
 *   - `from`     → footer reads "Remove from collection" → confirm
 *                  "Remove from Collection" → removePieceFromCollection(from, id) +
 *                  router.back()
 *
 * Factory-referenced outer vars are `mock`-prefixed per the jest hoisting rule.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import type { PotteryPiece } from "@/context/PotteryContext";

const PIECE: PotteryPiece = {
  id: "p1",
  title: "Cobalt Vase",
  clay: "",
  glaze: "",
  cone: "",
  dimensions: "",
  year: "",
  notes: "",
  firing: "",
  firingEnvironment: "",
  imageUri: "pieces/p1.jpg",
  images: ["pieces/p1.jpg"],
  createdAt: "2025-01-01T00:00:00.000Z",
  isFavorite: false,
  collectionIds: ["c1"],
  featuredInPortfolio: false,
  isPublic: false,
  archived: false,
  showGlazeDetails: false,
  showStudioNotes: false,
};

const mockPieces: PotteryPiece[] = [PIECE];

let mockConfirmResult = true;
let mockRouterParams: Record<string, string> = { id: "p1" };

const mockBack = jest.fn();
const mockDeletePiece = jest.fn();
const mockRemovePieceFromCollection = jest.fn();
const mockConfirm = jest.fn((..._args: unknown[]) => Promise.resolve(mockConfirmResult));

jest.mock("@/lib/confirm", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: mockBack },
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
  return {
    Image: (props: Record<string, unknown>) => ReactModule.createElement(RN.View, props),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/constants/seedImages", () => ({
  resolveImageSource: (uri: string) => ({ uri }),
}));

jest.mock("@/components/ImageViewer", () => ({ ImageViewer: () => null }));
jest.mock("@/components/ShareSheet", () => ({ ShareSheet: () => null }));
jest.mock("@/components/DraggablePhotoStrip", () => ({
  DraggablePhotoStrip: () => null,
}));

jest.mock("@/context/PotteryContext", () => ({
  usePottery: () => ({
    pieces: mockPieces,
    updatePiece: jest.fn(),
    toggleFavorite: jest.fn(),
    deletePiece: mockDeletePiece,
    addPieceToCollection: jest.fn(),
    removePieceFromCollection: mockRemovePieceFromCollection,
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
  publicSiteLabel: (name: string) =>
    `glazevault.art/${name.toLowerCase().replace(/\s+/g, "-")}`,
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

function confirmTitle(): string {
  const calls = mockConfirm.mock.calls;
  const arg = calls[calls.length - 1][0] as { title: string };
  return arg.title;
}

describe("piece detail destructive footer", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockDeletePiece.mockClear();
    mockRemovePieceFromCollection.mockClear();
    mockConfirm.mockClear();
    mockConfirmResult = true;
    mockRouterParams = { id: "p1" };
  });

  describe("delete piece (no collection context)", () => {
    it("confirming removes the piece and navigates back", async () => {
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { getByText } = render(<PieceDetailScreen />);

      await fireEvent.press(getByText("Delete piece"));
      await Promise.resolve();
      await Promise.resolve();

      expect(confirmTitle()).toBe("Remove Piece");
      expect(mockDeletePiece).toHaveBeenCalledWith("p1");
      expect(mockRemovePieceFromCollection).not.toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it("cancelling does neither", async () => {
      mockConfirmResult = false;
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { getByText } = render(<PieceDetailScreen />);

      await fireEvent.press(getByText("Delete piece"));
      await Promise.resolve();
      await Promise.resolve();

      expect(confirmTitle()).toBe("Remove Piece");
      expect(mockDeletePiece).not.toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  describe("remove from collection (with `from` context)", () => {
    beforeEach(() => {
      mockRouterParams = { id: "p1", from: "c1" };
    });

    it("confirming removes the piece from the collection and navigates back", async () => {
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { getByText } = render(<PieceDetailScreen />);

      await fireEvent.press(getByText("Remove from collection"));
      await Promise.resolve();
      await Promise.resolve();

      expect(confirmTitle()).toBe("Remove from Collection");
      expect(mockRemovePieceFromCollection).toHaveBeenCalledWith("c1", "p1");
      expect(mockDeletePiece).not.toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it("cancelling does neither", async () => {
      mockConfirmResult = false;
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { getByText } = render(<PieceDetailScreen />);

      await fireEvent.press(getByText("Remove from collection"));
      await Promise.resolve();
      await Promise.resolve();

      expect(confirmTitle()).toBe("Remove from Collection");
      expect(mockRemovePieceFromCollection).not.toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
    });
  });
});
