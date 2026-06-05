/**
 * End-to-end coverage that the piece detail screen's archive toggle runs
 * updatePiece *only* with the right archived flag, gated by the cross-platform
 * confirm() helper.
 *
 * The bug this guards: on web Alert.alert is a no-op, so the "Retire Piece"
 * confirmation could silently never reach updatePiece. confirm() is mocked to a
 * controllable boolean so each test drives the confirmed vs. cancelled branch:
 *
 *   - not archived → footer reads "Retire piece" → confirm "Retire Piece" →
 *                    updatePiece(id, { archived: true })
 *   - cancelled    → updatePiece is never called
 *   - archived     → footer reads "Restore piece" → applies immediately
 *                    (updatePiece(id, { archived: false })) with NO prompt
 *
 * Factory-referenced outer vars are `mock`-prefixed per the jest hoisting rule.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import type { PotteryPiece } from "@/context/PotteryContext";

const BASE_PIECE: PotteryPiece = {
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

let mockPieces: PotteryPiece[] = [BASE_PIECE];
let mockConfirmResult = true;
const mockRouterParams: Record<string, string> = { id: "p1" };

const mockUpdatePiece = jest.fn();
const mockConfirm = jest.fn((..._args: unknown[]) => Promise.resolve(mockConfirmResult));

jest.mock("@/lib/confirm", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

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
    updatePiece: mockUpdatePiece,
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

jest.mock("@/context/ProfileContext", () => ({
  useProfile: () => ({ profile: { name: "Test Artist" } }),
  PUBLIC_SITE_DOMAIN: "glazevault.art",
  publicSiteSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
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

describe("piece detail archive toggle", () => {
  beforeEach(() => {
    mockUpdatePiece.mockClear();
    mockConfirm.mockClear();
    mockConfirmResult = true;
    mockPieces = [BASE_PIECE];
  });

  describe("archiving an active piece", () => {
    it("confirming archives the piece", async () => {
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { getByText } = render(<PieceDetailScreen />);

      await fireEvent.press(getByText("Retire piece"));
      await Promise.resolve();
      await Promise.resolve();

      expect(confirmTitle()).toBe("Retire Piece");
      expect(mockUpdatePiece).toHaveBeenCalledWith("p1", { archived: true });
    });

    it("cancelling leaves the piece unchanged", async () => {
      mockConfirmResult = false;
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { getByText } = render(<PieceDetailScreen />);

      await fireEvent.press(getByText("Retire piece"));
      await Promise.resolve();
      await Promise.resolve();

      expect(confirmTitle()).toBe("Retire Piece");
      expect(mockUpdatePiece).not.toHaveBeenCalled();
    });
  });

  describe("restoring an archived piece", () => {
    beforeEach(() => {
      mockPieces = [{ ...BASE_PIECE, archived: true }];
    });

    it("applies immediately without a prompt", async () => {
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { getByText } = render(<PieceDetailScreen />);

      await fireEvent.press(getByText("Restore piece"));
      await Promise.resolve();
      await Promise.resolve();

      expect(mockConfirm).not.toHaveBeenCalled();
      expect(mockUpdatePiece).toHaveBeenCalledWith("p1", { archived: false });
    });
  });
});
