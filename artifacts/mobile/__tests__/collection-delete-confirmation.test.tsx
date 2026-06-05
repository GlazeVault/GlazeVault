/**
 * End-to-end coverage that deleting a collection only happens after the user
 * confirms, and that it cascade-unlinks member pieces, deletes the collection, and
 * navigates back.
 *
 * The destructive "Delete" control only exists in edit mode, so each test renders
 * the real collection screen, taps the edit affordance to enter edit mode, then
 * taps "Delete". The cross-platform confirm() helper is mocked to a controllable
 * boolean to drive the confirmed vs. cancelled branch.
 *
 * confirmed  → removePieceFromCollection(id, pieceId) for each member, then
 *              deleteCollection(id), then router.back()
 * cancelled  → none of the above
 *
 * Feather is mocked so the unlabeled edit FAB is queryable by its icon name.
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
  collectionIds: ["col1"],
  featuredInPortfolio: false,
  isPublic: false,
  archived: false,
  showGlazeDetails: false,
  showStudioNotes: false,
};

const mockCollection = {
  id: "col1",
  title: "Spring Glazes",
  intro: "",
  createdAt: "2025-01-01T00:00:00.000Z",
  visibility: "private" as const,
};

const mockPieces: PotteryPiece[] = [PIECE];

let mockConfirmResult = true;

const mockBack = jest.fn();
const mockDeleteCollection = jest.fn();
const mockRemovePieceFromCollection = jest.fn();
const mockConfirm = jest.fn((..._args: unknown[]) => Promise.resolve(mockConfirmResult));

jest.mock("@/lib/confirm", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: mockBack },
  useLocalSearchParams: () => ({ id: "col1" }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Warning: "warning" },
}));

jest.mock("@expo/vector-icons", () => {
  const ReactModule = require("react");
  const RN = require("react-native");
  return {
    Feather: ({ name }: { name: string }) =>
      ReactModule.createElement(RN.Text, null, `icon:${name}`),
  };
});

jest.mock("expo-image", () => {
  const ReactModule = require("react");
  const RN = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => ReactModule.createElement(RN.View, props),
  };
});

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react");
  const RN = require("react-native");
  const View = (props: Record<string, unknown>) =>
    ReactModule.createElement(RN.View, props);
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (Comp: unknown) => Comp },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withDelay: (_d: unknown, v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/components/ExpandableText", () => ({ ExpandableText: () => null }));
jest.mock("@/components/StatusBadge", () => ({ PieceStatusBadge: () => null }));

jest.mock("@/constants/imageStorage", () => ({
  persistPieceImage: jest.fn(),
}));

jest.mock("@/constants/seedImages", () => ({
  resolveImageSource: (uri: string) => ({ uri }),
}));

jest.mock("@/hooks/useImageOrientations", () => {
  const actual = jest.requireActual("@/hooks/useImageOrientations");
  return { ...actual, useImageOrientations: () => ({}) };
});

jest.mock("@/services/dataService", () => ({ uploadImage: jest.fn() }));
jest.mock("@/services/supabase", () => ({ isSupabaseConfigured: false }));
jest.mock("@/lib/notice", () => ({ notice: jest.fn() }));

jest.mock("@/context/CollectionsContext", () => ({
  useCollections: () => ({
    getCollection: (id: string) => (id === mockCollection.id ? mockCollection : undefined),
    updateCollection: jest.fn(),
    deleteCollection: mockDeleteCollection,
  }),
}));

jest.mock("@/context/PotteryContext", () => ({
  usePottery: () => ({
    pieces: mockPieces,
    removePieceFromCollection: mockRemovePieceFromCollection,
  }),
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

function flush() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe("collection detail delete", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockDeleteCollection.mockClear();
    mockRemovePieceFromCollection.mockClear();
    mockConfirm.mockClear();
    mockConfirmResult = true;
  });

  function renderInEditMode() {
    const CollectionDetailScreen = require("@/app/collection/[id]").default;
    const utils = render(<CollectionDetailScreen />);
    // The edit FAB is unlabeled; enter edit mode by tapping its icon.
    fireEvent.press(utils.getByText("icon:edit-2"));
    return utils;
  }

  it("confirming cascade-unlinks pieces, deletes the collection, and navigates back", async () => {
    const { getByText } = renderInEditMode();

    await fireEvent.press(getByText("Delete"));
    await flush();

    const confirmArg = mockConfirm.mock.calls[0][0] as { title: string };
    expect(confirmArg.title).toBe("Delete Collection");
    expect(mockRemovePieceFromCollection).toHaveBeenCalledWith("col1", "p1");
    expect(mockDeleteCollection).toHaveBeenCalledWith("col1");
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("cancelling does neither", async () => {
    mockConfirmResult = false;
    const { getByText } = renderInEditMode();

    await fireEvent.press(getByText("Delete"));
    await flush();

    const confirmArg = mockConfirm.mock.calls[0][0] as { title: string };
    expect(confirmArg.title).toBe("Delete Collection");
    expect(mockRemovePieceFromCollection).not.toHaveBeenCalled();
    expect(mockDeleteCollection).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
