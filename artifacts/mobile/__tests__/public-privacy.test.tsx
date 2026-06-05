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

function makePiece(id: string, overrides: Partial<PotteryPiece> = {}): PotteryPiece {
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
    // Per-piece public field exposure defaults OFF, so by default a public piece
    // still keeps its glaze details and notes private (the calm default the
    // privacy guard below locks in). Individual tests opt in via overrides.
    showGlazeDetails: false,
    showStudioNotes: false,
    ...overrides,
  };
}

// Mutable so individual tests can vary the piece set (e.g. mark a piece private
// or archived to exercise the public-view GATE, not just field-level leaks).
// Reset in beforeEach. Factory-referenced outer vars must be `mock`-prefixed.
let mockPieces: PotteryPiece[] = [makePiece("p1"), makePiece("p2")];

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

// Orientation measurement relies on react-native's Image.getSize, whose
// jest-expo mock is incompatible with RN 0.81's promise-based ImageLoader (it
// throws "success is not a function"). The real grid layout is exercised
// elsewhere; for the privacy guard we only care which fields render, so stub the
// measuring hook to skip native sizing while keeping the real row/landscape
// helpers intact.
jest.mock("@/hooks/useImageOrientations", () => {
  const actual = jest.requireActual("@/hooks/useImageOrientations");
  return { ...actual, useImageOrientations: () => ({}) };
});

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
      publicSite: { contactEmail: "", etsy: "", shopify: "" },
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
    mockPieces = [makePiece("p1"), makePiece("p2")];
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

describe("opt-in glaze details and studio notes cross over ONLY when enabled", () => {
  // These two per-piece flags are the ONLY way a glaze detail or studio note may
  // reach a public surface. Both default OFF, so the default-off guard tests
  // above (which assert NO owner-only field leaks) still hold; here we prove the
  // opt-in path works and stays independent and gated.
  beforeEach(() => {
    mockRouterParams = {};
    mockViewerProps.length = 0;
    mockShareProps.length = 0;
    mockCollections = [mockCollection];
  });

  it("toPublicPiece adds glaze/cone/firingEnvironment ONLY when showGlazeDetails is on", () => {
    const off = toPublicPiece(makePiece("p1"));
    expect("glaze" in off).toBe(false);
    expect("cone" in off).toBe(false);
    expect("firingEnvironment" in off).toBe(false);

    const on = toPublicPiece(makePiece("p1", { showGlazeDetails: true }));
    expect(on.glaze).toBe(OWNER_ONLY_SENTINELS.glaze);
    expect(on.cone).toBe(OWNER_ONLY_SENTINELS.cone);
    expect(on.firingEnvironment).toBe(OWNER_ONLY_SENTINELS.firingEnvironment);
    // The two opt-ins are independent: notes is still omitted.
    expect("notes" in on).toBe(false);
  });

  it("toPublicPiece adds notes ONLY when showStudioNotes is on", () => {
    const off = toPublicPiece(makePiece("p1"));
    expect("notes" in off).toBe(false);

    const on = toPublicPiece(makePiece("p1", { showStudioNotes: true }));
    expect(on.notes).toBe(OWNER_ONLY_SENTINELS.notes);
    // glaze details stay omitted.
    expect("glaze" in on).toBe(false);
  });

  it("toPublicPiece NEVER projects glaze/notes for a non-public piece even with both flags on", () => {
    // Defense in depth at the boundary itself: the flags are meaningless until
    // the piece is public, so the structural projection omits the keys entirely
    // regardless of the toggles. A future caller that forgets the render-path
    // gate still cannot leak a private field.
    const projected = toPublicPiece(
      makePiece("p1", { isPublic: false, showGlazeDetails: true, showStudioNotes: true }),
    );
    expect("glaze" in projected).toBe(false);
    expect("cone" in projected).toBe(false);
    expect("firingEnvironment" in projected).toBe(false);
    expect("notes" in projected).toBe(false);
    // The always-public identity fields are still projected as normal.
    expect(projected.clay).toBe(PUBLIC_SENTINELS.clay);
  });

  it("public piece view renders glaze details AND studio notes when both flags are on", () => {
    mockPieces = [makePiece("p1", { showGlazeDetails: true, showStudioNotes: true })];
    mockRouterParams = { id: "p1", public: "1" };
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    const { toJSON } = render(<PieceDetailScreen />);
    const text = renderedText(toJSON() as JsonNode);

    // The always-public fields are still present...
    for (const value of Object.values(PUBLIC_SENTINELS)) expect(text).toContain(value);
    // ...and the opted-in details now cross over, each with its label.
    expect(text).toContain(OWNER_ONLY_SENTINELS.glaze);
    expect(text).toContain(OWNER_ONLY_SENTINELS.cone);
    expect(text).toContain(OWNER_ONLY_SENTINELS.firingEnvironment);
    expect(text).toContain(OWNER_ONLY_SENTINELS.notes);
    expect(text).toContain("Studio Notes");
    // The duplicate `firing` field is never the one shown — only firingEnvironment.
    expect(text).not.toContain(OWNER_ONLY_SENTINELS.firing);
  });

  it("public piece view shows glaze details but NOT notes when only glaze is enabled", () => {
    mockPieces = [makePiece("p1", { showGlazeDetails: true, showStudioNotes: false })];
    mockRouterParams = { id: "p1", public: "1" };
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    const { toJSON } = render(<PieceDetailScreen />);
    const text = renderedText(toJSON() as JsonNode);

    expect(text).toContain(OWNER_ONLY_SENTINELS.glaze);
    // Notes stay private on a public piece when their toggle is off.
    expect(text).not.toContain(OWNER_ONLY_SENTINELS.notes);
  });

  it("a NON-public piece never crosses glaze/notes even with both flags on", () => {
    // Defense in depth: the flags only matter once the piece is publicly visible.
    // An un-public piece hits the public-view GATE and renders the private screen,
    // so the opted-in details can never reach a viewer.
    mockPieces = [
      makePiece("p1", { isPublic: false, showGlazeDetails: true, showStudioNotes: true }),
    ];
    mockRouterParams = { id: "p1", public: "1" };
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    const { toJSON } = render(<PieceDetailScreen />);
    const text = renderedText(toJSON() as JsonNode);

    expect(text).toContain("This piece is private");
    expect(text).not.toContain(OWNER_ONLY_SENTINELS.glaze);
    expect(text).not.toContain(OWNER_ONLY_SENTINELS.notes);
  });
});

describe("the public gate refuses non-visible pieces entirely", () => {
  // The sentinel tests above prove that WHEN a public surface renders it shows
  // only the allowed fields. These tests prove the GATE itself: a piece that is
  // not publicly visible (private, archived, or photoless) must be refused on
  // the public surfaces outright — it shows the "This piece is private" lock
  // screen, never the artwork. A regression in isPubliclyVisiblePiece that
  // quietly published such a piece would be caught here.
  beforeEach(() => {
    mockRouterParams = {};
    mockViewerProps.length = 0;
    mockShareProps.length = 0;
    mockCollections = [mockCollection];
    mockPieces = [makePiece("p1"), makePiece("p2")];
  });

  // Each case is a single reason a piece is NOT publicly visible; all three must
  // hit the same lock screen on the public piece view.
  const blockedCases: Array<{ reason: string; overrides: Partial<PotteryPiece> }> = [
    { reason: "marked private (isPublic: false)", overrides: { isPublic: false } },
    { reason: "archived", overrides: { archived: true } },
    { reason: "photoless (no imageUri)", overrides: { imageUri: "", images: [] } },
  ];

  it.each(blockedCases)(
    "public piece view (/piece/[id]?public=1) shows the lock screen when a piece is $reason",
    ({ overrides }) => {
      mockPieces = [makePiece("p1", overrides)];
      mockRouterParams = { id: "p1", public: "1" };
      const PieceDetailScreen = require("@/app/piece/[id]").default;
      const { toJSON } = render(<PieceDetailScreen />);
      const text = renderedText(toJSON() as JsonNode);

      // The lock screen rendered...
      expect(text).toContain("This piece is private");
      // ...and NONE of the artwork did: not the public "Public View" eyebrow,
      // not the title, and not the quiet clay·dimensions·year meta line.
      expect(text).not.toMatch(/Public View/i);
      expect(text).not.toContain(PUBLIC_SENTINELS.title);
      expect(text).not.toContain(PUBLIC_SENTINELS.clay);
      expect(text).not.toContain(PUBLIC_SENTINELS.dimensions);

      // The fullscreen viewer must not even be wired up with this piece — a
      // blocked piece is unreachable, not merely hidden behind a tap.
      mockViewerProps.forEach((p) =>
        expect(JSON.stringify(p.items ?? null)).not.toContain("pieces/p1.jpg"),
      );
    },
  );

  it("public fullscreen viewer swipe set excludes private/archived collection siblings", () => {
    // p1 is publicly visible. p2 (private) and p3 (archived) share collection
    // c1 with it. The public viewer's swipe set must include ONLY p1 — a
    // non-owner can never reach a sibling that isn't publicly visible, even
    // though it lives in the same collection.
    mockPieces = [
      makePiece("p1"),
      makePiece("p2", { isPublic: false }),
      makePiece("p3", { archived: true }),
    ];
    mockRouterParams = { id: "p1", public: "1" };
    const PieceDetailScreen = require("@/app/piece/[id]").default;
    render(<PieceDetailScreen />);

    expect(mockViewerProps.length).toBeGreaterThan(0);
    const items = mockViewerProps[mockViewerProps.length - 1].items as Array<{ uri?: string }>;
    const uris = items.map((i) => i.uri);

    // Only the publicly visible piece is reachable...
    expect(uris).toEqual(["pieces/p1.jpg"]);
    // ...and the blocked siblings appear nowhere in the viewer payload.
    const serialized = JSON.stringify(items);
    expect(serialized).not.toContain("pieces/p2.jpg");
    expect(serialized).not.toContain("pieces/p3.jpg");
  });

  it("public-site portfolio renders ONLY the public piece's tile, never private/archived/photoless siblings", () => {
    // The field-level tests above prove that WHEN a tile renders it shows only
    // the allowed fields. This proves the GATE on the portfolio surface itself:
    // a private / archived / photoless sibling sharing the same public
    // collection must never appear as a tile at all. Each blocked piece carries
    // a unique title sentinel and a unique image path so its appearance anywhere
    // in the rendered tree — caption OR image source — would be caught. The
    // explicit collection cover is distinct from every piece, so every publicly
    // visible piece flows into the grid as a tile (none is consumed as cover).
    mockCollections = [mockCollection];
    mockPieces = [
      makePiece("p1", { title: "ZZVISIBLETILE" }),
      makePiece("p2", { title: "ZZPRIVATETILE", isPublic: false }),
      makePiece("p3", { title: "ZZARCHIVEDTILE", archived: true }),
      makePiece("p4", { title: "ZZPHOTOLESSTILE", imageUri: "", images: [] }),
    ];
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    // Serialize the WHOLE tree (props included) so image sources are inspected
    // too — a tile's photo lives in a prop, not in the text children.
    const tree = JSON.stringify(toJSON() ?? null);

    // The one publicly visible piece IS on the page — its title and its photo...
    expect(tree).toContain("ZZVISIBLETILE");
    expect(tree).toContain("pieces/p1.jpg");
    // ...and the collection's public piece count reflects only that one piece,
    // never the three blocked siblings.
    expect(tree).toContain("1 piece");

    // None of the blocked siblings surfaced as a tile: not their title caption...
    for (const blocked of ["ZZPRIVATETILE", "ZZARCHIVEDTILE", "ZZPHOTOLESSTILE"]) {
      expect(tree).not.toContain(blocked);
    }
    // ...and not their photo (the photoless piece has no path of its own).
    for (const img of ["pieces/p2.jpg", "pieces/p3.jpg", "pieces/p4.jpg"]) {
      expect(tree).not.toContain(img);
    }
  });

  it("public collection grid (getPublicCollectionPieces) excludes blocked siblings end-to-end", () => {
    // Drives the cover-DERIVED-from-a-piece path: with no explicit artist cover,
    // the first publicly visible piece becomes the cover and the remaining public
    // pieces fill the grid. This proves the gate end-to-end through BOTH derived
    // surfaces — a blocked sibling must neither be promoted to the derived cover
    // nor appear in the grid. p1 (visible) becomes the cover, p2 (visible) renders
    // as a grid tile, and p3/p4/p5 (private/archived/photoless) are refused.
    mockCollections = [{ ...mockCollection, coverImageUri: undefined }];
    mockPieces = [
      makePiece("p1", { title: "ZZCOVERVISIBLE" }),
      makePiece("p2", { title: "ZZGRIDVISIBLE" }),
      makePiece("p3", { title: "ZZPRIVATETILE", isPublic: false }),
      makePiece("p4", { title: "ZZARCHIVEDTILE", archived: true }),
      makePiece("p5", { title: "ZZPHOTOLESSTILE", imageUri: "", images: [] }),
    ];
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    const tree = JSON.stringify(toJSON() ?? null);

    // The two publicly visible pieces rendered: p1 as the derived cover photo,
    // p2 as a captioned grid tile.
    expect(tree).toContain("pieces/p1.jpg");
    expect(tree).toContain("pieces/p2.jpg");
    expect(tree).toContain("ZZGRIDVISIBLE");
    // The public piece count counts only the two visible pieces.
    expect(tree).toContain("2 pieces");

    // No blocked sibling surfaced as the cover, a tile, or a caption...
    for (const blocked of ["ZZPRIVATETILE", "ZZARCHIVEDTILE", "ZZPHOTOLESSTILE"]) {
      expect(tree).not.toContain(blocked);
    }
    // ...nor did any blocked sibling's photo reach the grid or the cover slot.
    for (const img of ["pieces/p3.jpg", "pieces/p4.jpg", "pieces/p5.jpg"]) {
      expect(tree).not.toContain(img);
    }
  });

  it("public-site portfolio excludes a PUBLIC-but-unfeatured sibling", () => {
    // The curated Portfolio is featured-only: a piece that is fully public and
    // photo-bearing but NOT featured must never surface on the portfolio. p1 is
    // featured (default); p2 is public + collected but unfeatured. Only p1's
    // title and photo may appear, and the count must read "1 piece".
    mockCollections = [mockCollection];
    mockPieces = [
      makePiece("p1", { title: "ZZFEATUREDTILE" }),
      makePiece("p2", { title: "ZZUNFEATUREDTILE", featuredInPortfolio: false }),
    ];
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    const tree = JSON.stringify(toJSON() ?? null);

    // The featured piece is on the page; the unfeatured public sibling is not.
    expect(tree).toContain("ZZFEATUREDTILE");
    expect(tree).toContain("pieces/p1.jpg");
    expect(tree).toContain("1 piece");
    expect(tree).not.toContain("ZZUNFEATUREDTILE");
    expect(tree).not.toContain("pieces/p2.jpg");
  });

  it("public-site omits a PUBLIC collection that has zero featured pieces", () => {
    // A collection may be public yet contain nothing featured. With an empty
    // curated set the whole collection is dropped (public-site filters out
    // entries whose portfolio pieces are []), so neither its title nor any of
    // its pieces may render anywhere on the page.
    mockCollections = [{ ...mockCollection, title: "ZZEMPTYCOLLECTION" }];
    mockPieces = [
      makePiece("p1", { title: "ZZUNFEATUREDA", featuredInPortfolio: false }),
      makePiece("p2", { title: "ZZUNFEATUREDB", featuredInPortfolio: false }),
    ];
    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    const tree = JSON.stringify(toJSON() ?? null);

    // The collection itself is gone, and none of its unfeatured pieces leaked.
    expect(tree).not.toContain("ZZEMPTYCOLLECTION");
    expect(tree).not.toContain("ZZUNFEATUREDA");
    expect(tree).not.toContain("ZZUNFEATUREDB");
    expect(tree).not.toContain("pieces/p1.jpg");
    expect(tree).not.toContain("pieces/p2.jpg");
  });
});

describe("the collection-level gate hides an entire private collection", () => {
  // The piece-level gate (above) proves a hidden PIECE never surfaces. This
  // proves the COLLECTION-level gate: a collection whose OWN visibility is
  // "private" must never render on the public-site at all — not its title,
  // intro, cover, nor any of its pieces — EVEN when every piece it contains is
  // fully public and photo-bearing. The gate lives in `isCollectionPublic`,
  // applied by public-site via `collections.filter(isCollectionPublic)`. A
  // regression there would publish an entire private collection wholesale, so
  // this test locks that boundary down. A companion assertion confirms a sibling
  // PUBLIC collection still renders, proving the filter is selective rather than
  // a blanket hide.
  beforeEach(() => {
    mockRouterParams = {};
    mockViewerProps.length = 0;
    mockShareProps.length = 0;
    mockCollections = [mockCollection];
    mockPieces = [makePiece("p1"), makePiece("p2")];
  });

  it("renders nothing from a private collection but keeps a sibling public collection", () => {
    // A private collection whose content carries unique sentinels — title,
    // intro, an explicit cover, and a fully-public, photo-bearing piece — none
    // of which may appear anywhere on the rendered public-site.
    const PRIVATE = {
      collectionTitle: "ZZPRIVATECOLLTITLE",
      collectionIntro: "ZZPRIVATECOLLINTRO a body of work kept off the site",
      cover: "cover/private-collection.jpg",
      pieceTitle: "ZZPRIVATECOLLPIECE",
      photo: "pieces/private-piece.jpg",
    } as const;
    // A sibling PUBLIC collection whose content MUST still render, proving the
    // filter is selective — it hides only the private one, not every collection.
    const PUBLIC = {
      collectionTitle: "ZZPUBLICCOLLTITLE",
      collectionIntro: "ZZPUBLICCOLLINTRO a body of work shown on the site",
      cover: "cover/public-collection.jpg",
      pieceTitle: "ZZPUBLICCOLLPIECE",
      photo: "pieces/public-piece.jpg",
    } as const;

    mockCollections = [
      {
        ...mockCollection,
        id: "c-private",
        title: PRIVATE.collectionTitle,
        intro: PRIVATE.collectionIntro,
        visibility: "private",
        coverImageUri: PRIVATE.cover,
      },
      {
        ...mockCollection,
        id: "c-public",
        title: PUBLIC.collectionTitle,
        intro: PUBLIC.collectionIntro,
        visibility: "public",
        coverImageUri: PUBLIC.cover,
      },
    ];
    mockPieces = [
      // Fully public, photo-bearing piece living ONLY in the private collection.
      makePiece("pp", {
        title: PRIVATE.pieceTitle,
        imageUri: PRIVATE.photo,
        images: [PRIVATE.photo],
        collectionIds: ["c-private"],
      }),
      // Fully public, photo-bearing piece living in the public collection.
      makePiece("pub", {
        title: PUBLIC.pieceTitle,
        imageUri: PUBLIC.photo,
        images: [PUBLIC.photo],
        collectionIds: ["c-public"],
      }),
    ];

    const PublicSiteScreen = require("@/app/public-site").default;
    const { toJSON } = render(<PublicSiteScreen />);
    // Serialize the WHOLE tree (props included) so cover/piece image sources are
    // inspected too — covers and tiles carry their photo in a prop, not text.
    const tree = JSON.stringify(toJSON() ?? null);

    // The private collection contributed NOTHING: not its title, not its intro,
    // not its cover image, and not its (otherwise-public) piece's title or photo.
    expect(tree).not.toContain(PRIVATE.collectionTitle);
    expect(tree).not.toContain("ZZPRIVATECOLLINTRO");
    expect(tree).not.toContain(PRIVATE.cover);
    expect(tree).not.toContain(PRIVATE.pieceTitle);
    expect(tree).not.toContain(PRIVATE.photo);

    // The sibling PUBLIC collection still rendered in full — proving the filter
    // is selective, not a blanket hide of every collection.
    expect(tree).toContain(PUBLIC.collectionTitle);
    expect(tree).toContain("ZZPUBLICCOLLINTRO");
    expect(tree).toContain(PUBLIC.cover);
    expect(tree).toContain(PUBLIC.pieceTitle);
    expect(tree).toContain(PUBLIC.photo);
  });
});
