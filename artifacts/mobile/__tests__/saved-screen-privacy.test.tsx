/**
 * The Saved (Inspiration) shelf must re-gate saved items against the artist's
 * CURRENT privacy choice on every render. A piece saved while public but later
 * made private/archived — or a collection turned private — must silently fall
 * off the shelf. Saved status is the viewer's bookmark; it can never override
 * the owner's privacy.
 */
import { render } from "@testing-library/react-native";
import React from "react";

import SavedScreen from "@/app/(tabs)/saved";

const PUBLIC_PIECE = {
  id: "public-piece",
  title: "ZZPUBLICWORK",
  imageUri: "pieces/public.jpg",
  isPublic: true,
  archived: false,
  collectionIds: ["col-public"],
};

const PRIVATE_PIECE = {
  id: "private-piece",
  title: "ZZPRIVATEWORK",
  imageUri: "pieces/private.jpg",
  isPublic: false,
  archived: false,
  collectionIds: ["col-public"],
};

const PUBLIC_COLLECTION = {
  id: "col-public",
  title: "ZZPUBLICEXHIBIT",
  visibility: "public",
  coverImageUri: null,
};

const PRIVATE_COLLECTION = {
  id: "col-private",
  title: "ZZPRIVATEEXHIBIT",
  visibility: "private",
  coverImageUri: null,
};

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/context/PotteryContext", () => ({
  usePottery: () => ({ pieces: [PUBLIC_PIECE, PRIVATE_PIECE] }),
}));

jest.mock("@/context/CollectionsContext", () => ({
  useCollections: () => ({ collections: [PUBLIC_COLLECTION, PRIVATE_COLLECTION] }),
}));

jest.mock("@/context/ProfileContext", () => ({
  useProfile: () => ({ profile: { name: "Test Artist" } }),
  publicSiteSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}));

// The viewer has saved BOTH pieces and BOTH collections. The screen must only
// render the public ones.
jest.mock("@/context/SavedContext", () => ({
  useSaved: () => ({
    hydrated: true,
    saved: {
      pieces: ["public-piece", "private-piece"],
      collections: ["col-public", "col-private"],
      artists: [],
      following: [],
    },
    isPieceSaved: () => true,
    togglePieceSaved: () => {},
    isCollectionSaved: () => true,
    toggleCollectionSaved: () => {},
    isArtistSaved: () => false,
    toggleArtistSaved: () => {},
    isFollowing: () => false,
    toggleFollowing: () => {},
  }),
}));

describe("Saved shelf privacy gating", () => {
  it("renders only public saved pieces and collections, never private ones", () => {
    const { queryByText } = render(<SavedScreen />);

    expect(queryByText("ZZPUBLICWORK")).toBeTruthy();
    expect(queryByText("ZZPUBLICEXHIBIT")).toBeTruthy();

    expect(queryByText("ZZPRIVATEWORK")).toBeNull();
    expect(queryByText("ZZPRIVATEEXHIBIT")).toBeNull();
  });
});
