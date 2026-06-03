/**
 * Privacy guard: locks the FIXED set of fields allowed on public surfaces.
 *
 * The public portfolio is a gallery-like format that may only ever expose a
 * piece's Title, Photo, and the quiet clay · dimensions · year meta line. The
 * private studio record (notes, glaze, cone, firing / firing environment, and
 * any future owner-only field) must NEVER reach a public surface.
 *
 * These tests render the two real public surfaces — the public piece view
 * (`/piece/[id]?public=1`) and the public-site portfolio tiles — with a piece
 * whose every field carries a unique sentinel value, then assert that ONLY the
 * allowed sentinels appear in the rendered output. If a future change wires an
 * owner-only field onto either surface, the matching sentinel will render and
 * the test will fail, catching the privacy leak before it ships.
 */
import { render } from "@testing-library/react-native";
import React from "react";

import type { Collection } from "@/context/CollectionsContext";
import type { PotteryPiece } from "@/context/PotteryContext";

// Unique, unmistakable sentinels so an accidental match can't be a layout
// string or an icon name — every value is namespaced with "ZZ".
const PUBLIC_SENTINELS = {
  title: "ZZTITLEPUBLIC",
  clay: "ZZCLAYPUBLIC",
  dimensions: "ZZDIMENSIONSPUBLIC",
  year: "ZZYEARPUBLIC",
} as const;

// Owner-only fields that must never appear on a public surface. `price` is kept
// here intentionally even though the model has no price field today: if one is
// ever added and leaked, this list documents the intent to keep it private.
const OWNER_ONLY_SENTINELS = {
  notes: "ZZNOTESPRIVATE",
  glaze: "ZZGLAZEPRIVATE",
  cone: "ZZCONEPRIVATE",
  firing: "ZZFIRINGPRIVATE",
  firingEnvironment: "ZZFIRINGENVPRIVATE",
  price: "ZZPRICEPRIVATE",
} as const;

function makePiece(id: string): PotteryPiece {
  return {
    id,
    title: PUBLIC_SENTINELS.title,
    clay: PUBLIC_SENTINELS.clay,
    dimensions: PUBLIC_SENTINELS.dimensions,
    year: PUBLIC_SENTINELS.year,
    notes: OWNER_ONLY_SENTINELS.notes,
    glaze: OWNER_ONLY_SENTINELS.glaze,
    cone: OWNER_ONLY_SENTINELS.cone,
    firing: OWNER_ONLY_SENTINELS.firing,
    firingEnvironment: OWNER_ONLY_SENTINELS.firingEnvironment,
    imageUri: `pieces/${id}.jpg`,
    createdAt: "2025-01-01T00:00:00.000Z",
    isFavorite: false,
    collectionId: "c1",
  };
}

const mockPieces: PotteryPiece[] = [makePiece("p1"), makePiece("p2")];

const mockCollection: Collection = {
  id: "c1",
  title: "Public Collection Name",
  intro: "",
  featuredOnSite: true,
  // Distinct cover so the pieces still render as captioned grid tiles (a piece
  // matching the cover image is dropped from the grid by design).
  coverImageUri: "cover/distinct.jpg",
  createdAt: "2025-01-01T00:00:00.000Z",
} as Collection;

// --- Mocks -----------------------------------------------------------------
// privacy.ts (buildPublicMetaLine / isPubliclyVisiblePiece) is intentionally
// NOT mocked — it is part of the contract under test.

let mockRouterParams: Record<string, string> = {};

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

jest.mock("@/components/ImageViewer", () => ({ ImageViewer: () => null }));
jest.mock("@/components/ShareSheet", () => ({ ShareSheet: () => null }));

jest.mock("@/context/PotteryContext", () => ({
  usePottery: () => ({
    pieces: mockPieces,
    updatePiece: jest.fn(),
    toggleFavorite: jest.fn(),
    deletePiece: jest.fn(),
    removePieceFromCollection: jest.fn(),
    getPiece: (id: string) => mockPieces.find((p) => p.id === id),
  }),
}));

jest.mock("@/context/CollectionsContext", () => ({
  useCollections: () => ({ collections: [mockCollection] }),
}));

jest.mock("@/context/ProfileContext", () => ({
  useProfile: () => ({
    profile: {
      name: "Test Artist",
      bio: "",
      statement: "",
      instagram: "",
      website: "",
      avatarUri: "",
      publicSite: { homepageLayout: "grid", contactEmail: "", etsy: "", shopify: "" },
    },
  }),
  PUBLIC_SITE_DOMAIN: "glazevault.art",
  publicSiteSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () =>
    new Proxy(
      { radius: 12 },
      { get: (target, prop) => (typeof prop === "string" && prop in target ? (target as Record<string, unknown>)[prop] : "#000000") },
    ),
}));

// --- Helpers ---------------------------------------------------------------

type JsonNode =
  | string
  | number
  | null
  | { children?: JsonNode[] | null }
  | JsonNode[];

function collectText(node: JsonNode, acc: string[]): void {
  if (node == null) return;
  if (typeof node === "string") {
    acc.push(node);
    return;
  }
  if (typeof node === "number") return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, acc));
    return;
  }
  if (node.children) collectText(node.children, acc);
}

function renderedText(json: JsonNode): string {
  const acc: string[] = [];
  collectText(json, acc);
  return acc.join(" \u0000 ");
}

function assertOnlyPublicFields(text: string): void {
  // Every allowed public field must be present...
  for (const value of Object.values(PUBLIC_SENTINELS)) {
    expect(text).toContain(value);
  }
  // ...and no owner-only field may leak.
  for (const [field, value] of Object.entries(OWNER_ONLY_SENTINELS)) {
    if (text.includes(value)) {
      throw new Error(
        `Privacy leak: owner-only field "${field}" rendered on a public surface. ` +
          `Public surfaces may only show title, photo, and the clay · dimensions · year meta line.`,
      );
    }
  }
}

// --- Tests -----------------------------------------------------------------

describe("public surfaces expose only the fixed allowed fields", () => {
  beforeEach(() => {
    mockRouterParams = {};
  });

  it("public piece view (/piece/[id]?public=1) shows only title + clay·dimensions·year", () => {
    mockRouterParams = { id: "p1", public: "1" };
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    const { toJSON } = render(<PieceDetailScreen />);
    assertOnlyPublicFields(renderedText(toJSON() as JsonNode));
  });

  it("public-site portfolio tiles show only title + clay·dimensions·year", () => {
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    assertOnlyPublicFields(renderedText(toJSON() as JsonNode));
  });
});
