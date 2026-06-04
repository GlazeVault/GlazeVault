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

import { buildPublicMetaLine, buildShareContent, toPublicPiece } from "@/constants/privacy";
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
    images: [`pieces/${id}.jpg`],
    createdAt: "2025-01-01T00:00:00.000Z",
    isFavorite: false,
    collectionIds: ["c1"],
    featuredInPortfolio: true,
    isPublic: true,
    archived: false,
  };
}

const mockPieces: PotteryPiece[] = [makePiece("p1"), makePiece("p2")];

const mockCollection: Collection = {
  id: "c1",
  title: "Public Collection Name",
  intro: "",
  visibility: "public",
  // Distinct cover so the pieces still render as captioned grid tiles (a piece
  // matching the cover image is dropped from the grid by design).
  coverImageUri: "cover/distinct.jpg",
  createdAt: "2025-01-01T00:00:00.000Z",
};

// Mutable so individual tests can vary the public collection set (e.g. drop the
// explicit cover to exercise the cover-derived-from-a-piece branch). Reset in
// beforeEach. Factory-referenced outer vars must be `mock`-prefixed.
let mockCollections: Collection[] = [mockCollection];

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

// Capture the props handed to the fullscreen viewer and the share sheet so the
// test can guard these OFF-SCREEN side channels too — a caption or share
// payload could carry a private field even when nothing private is painted to
// the visible tree. Factory-referenced outer vars must be `mock`-prefixed.
const mockViewerProps: Array<Record<string, unknown>> = [];
const mockShareProps: Array<Record<string, unknown>> = [];

jest.mock("@/components/ImageViewer", () => ({
  ImageViewer: (props: Record<string, unknown>) => {
    mockViewerProps.push(props);
    return null;
  },
}));
jest.mock("@/components/ShareSheet", () => ({
  ShareSheet: (props: Record<string, unknown>) => {
    mockShareProps.push(props);
    return null;
  },
}));

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
  useCollections: () => ({ collections: mockCollections }),
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

/** Fail if any owner-only sentinel survives anywhere in a serialized payload. */
function assertNoOwnerOnly(payload: unknown, where: string): void {
  const serialized = JSON.stringify(payload ?? null);
  for (const [field, value] of Object.entries(OWNER_ONLY_SENTINELS)) {
    if (serialized.includes(value)) {
      throw new Error(
        `Privacy leak: owner-only field "${field}" reached ${where}. ` +
          `Public-mode child components must receive only projected (PublicPieceView) data.`,
      );
    }
  }
}

describe("public surfaces expose only the fixed allowed fields", () => {
  beforeEach(() => {
    mockRouterParams = {};
    mockViewerProps.length = 0;
    mockShareProps.length = 0;
    mockCollections = [mockCollection];
  });

  it("public piece view (/piece/[id]?public=1) shows only title + clay·dimensions·year", () => {
    mockRouterParams = { id: "p1", public: "1" };
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    const { toJSON } = render(<PieceDetailScreen />);
    assertOnlyPublicFields(renderedText(toJSON() as JsonNode));

    // Off-screen side channels: the fullscreen viewer captions and the share
    // payload must also carry no private field, even though they aren't painted.
    expect(mockViewerProps.length).toBeGreaterThan(0);
    mockViewerProps.forEach((p) => assertNoOwnerOnly(p.items, "the fullscreen viewer items"));
    mockShareProps.forEach((p) => assertNoOwnerOnly(p, "the share sheet"));
  });

  it("public-site portfolio tiles show only title + clay·dimensions·year", () => {
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    assertOnlyPublicFields(renderedText(toJSON() as JsonNode));
  });

  it("public-site no longer renders a separate 'Selected Works' feed", () => {
    // The portfolio is collection-driven: works appear inside their collections,
    // never duplicated in a standalone curated section.
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    const text = renderedText(toJSON() as JsonNode);
    expect(text).not.toMatch(/Selected Works/i);
  });

  it("public collection display shows only title + clay·dimensions·year", () => {
    // The public collection display is its own public surface: a non-owner
    // browsing a published collection sees its header (collection title + intro)
    // and a grid of its publicly visible pieces. Each piece is projected through
    // toPublicPiece before it renders, so a regression that wired an owner-only
    // field onto a collection tile must surface here.
    //
    // Drop the explicit artist cover so the cover is DERIVED from a sentinel
    // piece (the `coverPieceId` branch in public-site). That piece then drops
    // out of the grid, leaving its sibling to render as a captioned tile — a
    // path the explicit-cover "portfolio tiles" test never exercises.
    mockCollections = [
      { ...mockCollection, intro: "ZZINTROPUBLIC a short, public collection note", coverImageUri: undefined },
    ];
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    const text = renderedText(toJSON() as JsonNode);

    // The collection header (a public surface element) actually rendered...
    expect(text).toContain(mockCollection.title);
    expect(text).toContain("ZZINTROPUBLIC");
    // ...and only the fixed public piece fields crossed onto it.
    assertOnlyPublicFields(text);
  });

  it("the REAL fullscreen viewer paints captions with only title + clay·dimensions·year", () => {
    // The other tests stub @/components/ImageViewer to capture its props, which
    // proves the public branch HANDS it only allowlisted data. But the viewer is
    // itself a public surface: it could be changed to paint an owner-only field
    // into a caption. So here we drive the REAL viewer end-to-end.
    //
    // 1) Render the public piece view to capture the exact `viewerItems` the
    //    public branch of /piece/[id] builds from a sentinel-loaded piece — no
    //    hand-rolled items, so a regression in that mapping is exercised too.
    mockRouterParams = { id: "p1", public: "1" };
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    render(<PieceDetailScreen />);
    expect(mockViewerProps.length).toBeGreaterThan(0);
    const items = mockViewerProps[mockViewerProps.length - 1].items as unknown[];
    expect(Array.isArray(items) && items.length).toBeTruthy();

    // 2) Render the actual ImageViewer (bypassing the module mock) with those
    //    items and assert its rendered caption tree shows ONLY the allowed
    //    fields. `visible` so the Modal + caption actually mount.
    const { ImageViewer: RealImageViewer } = jest.requireActual(
      "@/components/ImageViewer",
    ) as typeof import("@/components/ImageViewer");
    const { toJSON } = render(
      <RealImageViewer
        visible
        items={items as import("@/components/ImageViewer").ViewerItem[]}
        initialIndex={0}
        onClose={() => {}}
      />,
    );
    assertOnlyPublicFields(renderedText(toJSON() as JsonNode));
  });

  it("public fullscreen viewer preview leaks nothing in caption OR its share payload", () => {
    // A dedicated guardian for the viewer as a public surface. Build a viewer
    // item exactly the way the public preview path does — projecting a
    // sentinel-loaded piece through the public allowlist helpers — then drive the
    // REAL viewer with the share affordance present. Asserts BOTH the painted
    // caption tree AND the in-viewer share payload (an off-screen side channel
    // the caption test above does not inspect) carry only public fields.
    const pub = toPublicPiece(makePiece("p1"));
    const item: import("@/components/ImageViewer").ViewerItem = {
      uri: pub.imageUri,
      title: pub.title,
      materials: buildPublicMetaLine(pub),
      collection: mockCollection.title,
      share: buildShareContent(pub, "glazevault.art/zz-studio-link"),
    };

    const { ImageViewer: RealImageViewer } = jest.requireActual(
      "@/components/ImageViewer",
    ) as typeof import("@/components/ImageViewer");
    const { toJSON } = render(
      <RealImageViewer visible items={[item]} initialIndex={0} onClose={() => {}} />,
    );

    assertOnlyPublicFields(renderedText(toJSON() as JsonNode));
    // The share payload the viewer would hand to the share sheet must be clean.
    assertNoOwnerOnly(item.share, "the in-viewer share payload");
  });
});

describe("sharing a piece exposes only the fixed allowed fields", () => {
  // Sharing is another way a piece's details leave the app — the share text /
  // payload reaches whoever the artist shares with. It must carry the same fixed
  // public set as every other public surface: title + clay·dimensions·year +
  // the public site link, and NO owner-only studio field.
  const SHARE_URL = "glazevault.art/zz-studio-link";

  it("buildShareContent carries title + clay·dimensions·year + link, never owner-only data", () => {
    // Drive the REAL builder used by ShareSheet with a piece whose every field
    // (public AND owner-only) carries a unique sentinel.
    const content = buildShareContent(makePiece("p1"), SHARE_URL);
    const serialized = JSON.stringify(content);

    // Every allowed public field is present in the share content...
    expect(content.message).toContain(PUBLIC_SENTINELS.title);
    expect(content.message).toContain(PUBLIC_SENTINELS.clay);
    expect(content.message).toContain(PUBLIC_SENTINELS.dimensions);
    expect(content.message).toContain(PUBLIC_SENTINELS.year);
    // ...along with the public site link.
    expect(content.message).toContain(SHARE_URL);
    expect(content.url).toBe(SHARE_URL);
    expect(content.title).toBe(PUBLIC_SENTINELS.title);

    // ...and no owner-only field leaks into ANY part of the payload.
    for (const [field, value] of Object.entries(OWNER_ONLY_SENTINELS)) {
      if (serialized.includes(value)) {
        throw new Error(
          `Privacy leak: owner-only field "${field}" reached the share content. ` +
            `Sharing may only expose title, the clay · dimensions · year meta line, and the public site link.`,
        );
      }
    }
  });

  it("projects through the public allowlist even when handed a raw owner piece", () => {
    // The builder must be safe-by-construction: passing the full owner record
    // (not a pre-projected piece) still drops every studio field.
    const content = buildShareContent(makePiece("p2"), SHARE_URL);
    assertNoOwnerOnly(content, "the share content");
  });
});

describe("toPublicPiece is the structural allowlist boundary", () => {
  it("projects a piece to exactly the public fields and nothing else", () => {
    const projected = toPublicPiece(makePiece("p1"));
    // The projected object's keys ARE the allowlist — no more, no less.
    expect(Object.keys(projected).sort()).toEqual(
      ["clay", "dimensions", "id", "imageUri", "title", "year"].sort(),
    );
    // No owner-only value survives the projection, by value.
    const serialized = JSON.stringify(projected);
    for (const [field, value] of Object.entries(OWNER_ONLY_SENTINELS)) {
      if (serialized.includes(value)) {
        throw new Error(
          `Privacy leak: owner-only field "${field}" survived toPublicPiece. ` +
            `The projection must drop every field outside the public allowlist.`,
        );
      }
    }
  });
});
