import { useLocalSearchParams } from "expo-router";
import React from "react";

import { PublicLoading, PublicMissing, usePublicReady } from "@/components/PublicGate";
import { isCollectionPublic } from "@/constants/privacy";
import { useCollections } from "@/context/CollectionsContext";
import { publicSiteSlug, useProfile } from "@/context/ProfileContext";
import PublicSiteScreen from "@/app/public-site";

/**
 * Live public collection page at `/{slug}/collection/{id}` — a single
 * mini-exhibition. Gated on the public site being enabled, the slug matching,
 * AND the collection being public. Reuses the portfolio screen scoped to this
 * one collection so the presentation stays identical. A private collection
 * resolves to a quiet "not on view" page.
 */
export default function PublicCollectionRoute() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>();
  const ready = usePublicReady();
  const { profile } = useProfile();
  const { collections } = useCollections();

  if (!ready) return <PublicLoading />;

  const collection = collections.find((c) => c.id === id);
  const ok =
    profile.publicSite.enabled &&
    publicSiteSlug(profile.name) === slug &&
    !!collection &&
    isCollectionPublic(collection);
  if (!ok) return <PublicMissing />;

  return <PublicSiteScreen live onlyCollectionId={id} />;
}
