import { useLocalSearchParams } from "expo-router";
import React from "react";

import { PublicLoading, PublicMissing } from "@/components/PublicGate";
import PublicSiteScreen from "@/app/public-site";
import {
  PublicArtistProvider,
  usePublicArtist,
} from "@/context/PublicArtistContext";

/**
 * Live public portfolio at `/{slug}` — the artist's whole exhibition. The
 * provider fetches that artist's public archive from Supabase by slug, so a
 * visitor (a different signed-in artist, or an anonymous link follower) sees
 * only public work. A slug that resolves to no enabled public site renders a
 * quiet "not on view" page.
 */
function PortfolioInner() {
  const { status, profile } = usePublicArtist();
  if (status === "loading") return <PublicLoading />;
  if (status === "missing" || !profile.publicSite.enabled) {
    return <PublicMissing />;
  }
  return <PublicSiteScreen live />;
}

export default function PublicPortfolioRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <PublicArtistProvider slug={slug}>
      <PortfolioInner />
    </PublicArtistProvider>
  );
}
