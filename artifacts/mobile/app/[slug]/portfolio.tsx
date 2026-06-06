import { useLocalSearchParams } from "expo-router";
import React from "react";

import { PublicLoading, PublicMissing } from "@/components/PublicGate";
import PublicSiteScreen from "@/app/public-site";
import { publicSiteSlug } from "@/context/ProfileContext";
import {
  PublicArtistProvider,
  usePublicArtist,
} from "@/context/PublicArtistContext";

/**
 * Live public portfolio at `/{slug}/portfolio` — the artist's curated
 * exhibition (public collections, featured works only), reached from the foyer's
 * Portfolio doorway. This is the behaviour `/{slug}` used to render directly;
 * it now sits one step in, with a quiet way back to the foyer.
 */
function PortfolioInner() {
  const { status, profile } = usePublicArtist();
  if (status === "loading") return <PublicLoading />;
  if (status === "missing" || !profile.publicSite.enabled) {
    return <PublicMissing />;
  }
  return <PublicSiteScreen live backHref={`/${publicSiteSlug(profile.name)}`} />;
}

export default function PublicPortfolioRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <PublicArtistProvider slug={slug}>
      <PortfolioInner />
    </PublicArtistProvider>
  );
}
