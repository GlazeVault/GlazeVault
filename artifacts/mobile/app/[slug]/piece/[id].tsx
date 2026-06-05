import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

import { PublicLoading, PublicMissing, usePublicReady } from "@/components/PublicGate";
import { isPubliclyVisiblePiece } from "@/constants/privacy";
import { publicSiteSlug, useProfile } from "@/context/ProfileContext";
import { usePottery } from "@/context/PotteryContext";

/**
 * Live public piece page at `/{slug}/piece/{id}`. Gated on the public site being
 * enabled, the slug matching, AND the piece being publicly visible. Only then do
 * we hand off to the existing safe public piece view (`/piece/{id}?public=1`),
 * which renders strictly through the public projection. A private or hidden
 * piece resolves to a quiet "not on view" page instead.
 */
export default function PublicPieceRoute() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>();
  const ready = usePublicReady();
  const { profile } = useProfile();
  const { pieces } = usePottery();

  if (!ready) return <PublicLoading />;

  const piece = pieces.find((p) => p.id === id);
  const ok =
    profile.publicSite.enabled &&
    publicSiteSlug(profile.name) === slug &&
    !!piece &&
    isPubliclyVisiblePiece(piece);
  if (!ok) return <PublicMissing />;

  return <Redirect href={`/piece/${id}?public=1`} />;
}
