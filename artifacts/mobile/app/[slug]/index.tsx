import { useLocalSearchParams } from "expo-router";
import React from "react";

import { PublicLoading, PublicMissing, usePublicReady } from "@/components/PublicGate";
import { publicSiteSlug, useProfile } from "@/context/ProfileContext";
import PublicSiteScreen from "@/app/public-site";

/**
 * Live public portfolio at `/{slug}` — the artist's whole exhibition. Gated:
 * resolves only when the public site is enabled AND the slug matches the
 * artist's own slug; anything else renders a quiet "not on view" page so a
 * private/unpublished archive never resolves publicly.
 */
export default function PublicPortfolioRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const ready = usePublicReady();
  const { profile } = useProfile();

  if (!ready) return <PublicLoading />;

  const ok =
    profile.publicSite.enabled && publicSiteSlug(profile.name) === slug;
  if (!ok) return <PublicMissing />;

  return <PublicSiteScreen live />;
}
