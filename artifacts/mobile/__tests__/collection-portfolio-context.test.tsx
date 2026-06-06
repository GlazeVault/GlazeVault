/**
 * Coverage for the portfolio-entry context on the collection detail screen.
 *
 * When a collection is opened from the Profile → Portfolio section it carries
 * `context=portfolio`. In that case its piece tiles must open the piece detail
 * with `from=portfolio` (so the detail offers "Remove from Portfolio"). Reaching
 * the same collection without that context (e.g. the Collections tab) must keep
 * collection context: pieces open with `from=<collectionId>`.
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
  collectionIds: ["col1"],
  featuredInPortfolio: true,
  isPublic: true,
  archived: false,
  showGlazeDetails: false,
  showStudioNotes: false,
};

const mockCollection = {
  id: "col1",
  title: "Spring Glazes",
  intro: "",
  createdAt: "2025-01-01T00:00:00.000Z",
  visibility: "public" as const,
};

// The first piece with an image becomes the collection's auto-cover and is
// filtered out of the grid, so a second piece is needed to render a tappable
// gallery tile.
const PIECE_2: PotteryPiece = {
  ...PIECE,
  id: "p2",
  title: "Celadon Bowl",
  imageUri: "pieces/p2.jpg",
  images: ["pieces/p2.jpg"],
};

// A collected, public, but NOT-featured piece. It belongs to the collection so
// it shows in the Collections-tab view, but must be hidden in portfolio context
// (the portfolio list renders only featured_in_portfolio pieces).
const PIECE_3: PotteryPiece = {
  ...PIECE,
  id: "p3",
  title: "Stoneware Jar",
  imageUri: "pieces/p3.jpg",
  images: ["pieces/p3.jpg"],
  featuredInPortfolio: false,
};

const mockPieces: PotteryPiece[] = [PIECE, PIECE_2, PIECE_3];

let mockParams: Record<string, string> = { id: "col1" };
const mockPush = jest.fn();

jest.mock("@/lib/confirm", () => ({ confirm: jest.fn(() => Promise.resolve(true)) }));

jest.mock("expo-router", () => ({
  router: { push: mockPush, back: jest.fn() },
  useLocalSearchParams: () => mockParams,
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

jest.mock("@/constants/imageStorage", () => ({ persistPieceImage: jest.fn() }));

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
    deleteCollection: jest.fn(),
  }),
}));

jest.mock("@/context/PotteryContext", () => ({
  usePottery: () => ({
    pieces: mockPieces,
    removePieceFromCollection: jest.fn(),
  }),
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

describe("collection detail piece-tile entry context", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockParams = { id: "col1" };
  });

  function pushedFrom() {
    const call = mockPush.mock.calls.find(
      ([arg]) => typeof arg === "object" && arg?.pathname === "/piece/[id]",
    );
    return (call?.[0] as { params: { from: string } }).params.from;
  }

  it("opens pieces with collection context by default (no context param)", () => {
    const CollectionDetailScreen = require("@/app/collection/[id]").default;
    const { getByText } = render(<CollectionDetailScreen />);

    fireEvent.press(getByText("Celadon Bowl"));

    expect(pushedFrom()).toBe("col1");
  });

  it("opens pieces with portfolio context when entered via the Portfolio section", () => {
    mockParams = { id: "col1", context: "portfolio" };
    const CollectionDetailScreen = require("@/app/collection/[id]").default;
    const { getByText } = render(<CollectionDetailScreen />);

    fireEvent.press(getByText("Celadon Bowl"));

    expect(pushedFrom()).toBe("portfolio");
  });

  it("renders every member piece in the default (Collections-tab) context", () => {
    const CollectionDetailScreen = require("@/app/collection/[id]").default;
    const { queryByText } = render(<CollectionDetailScreen />);

    // Featured and non-featured pieces both appear when not in portfolio context.
    expect(queryByText("Celadon Bowl")).not.toBeNull();
    expect(queryByText("Stoneware Jar")).not.toBeNull();
  });

  it("renders only featured pieces in portfolio context (the core fix)", () => {
    mockParams = { id: "col1", context: "portfolio" };
    const CollectionDetailScreen = require("@/app/collection/[id]").default;
    const { queryByText } = render(<CollectionDetailScreen />);

    // Featured piece stays; the non-featured piece is hidden so unfeaturing a
    // piece makes it disappear from the Portfolio list immediately.
    expect(queryByText("Celadon Bowl")).not.toBeNull();
    expect(queryByText("Stoneware Jar")).toBeNull();
  });
});
