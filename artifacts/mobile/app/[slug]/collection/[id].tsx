import { useLocalSearchParams } from "expo-router";
import React from "react";

import { PublicLoading, PublicMissing } from "@/components/PublicGate";
import { isCollectionPublic } from "@/constants/privacy";
import PublicSiteScreen from "@/app/public-site";
import {
  PublicArtistProvider,
  usePublicArtist,
} from "@/context/PublicArtistContext";

/**
 * Live public collection page at `/{slug}/collection/{id}` — a single
 * mini-exhibition. The provider fetches the artist's public archive by slug;
 * this gates on the collection existing and being public, then reuses the
 * portfolio screen scoped to that one collection. Anything else renders a quiet
 * "not on view" page.
 */
function CollectionInner({ id }: { id: string }) {
  const { status, profile, collections } = usePublicArtist();
  if (status === "loading") return <PublicLoading />;
  const collection = collections.find((c) => c.id === id);
  if (
    status === "missing" ||
    !profile.publicSite.enabled ||
    !collection ||
    !isCollectionPublic(collection)
  ) {
    return <PublicMissing />;
  }
  return <PublicSiteScreen live onlyCollectionId={id} />;
}

export default function PublicCollectionRoute() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>();
  return (
    <PublicArtistProvider slug={slug}>
      <CollectionInner id={id} />
    </PublicArtistProvider>
  );
}
