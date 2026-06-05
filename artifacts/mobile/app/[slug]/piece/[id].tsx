import { useLocalSearchParams } from "expo-router";
import React from "react";

import { PublicLoading, PublicMissing } from "@/components/PublicGate";
import PieceDetailScreen from "@/app/piece/[id]";
import { isPubliclyVisiblePiece } from "@/constants/privacy";
import {
  PublicArtistProvider,
  usePublicArtist,
} from "@/context/PublicArtistContext";

/**
 * Live public piece page at `/{slug}/piece/{id}`. The provider fetches the
 * artist's public archive by slug; this gates on the piece existing and being
 * publicly visible, then renders the shared piece detail screen, which detects
 * the provider and renders strictly through its public projection. A private or
 * hidden piece renders a quiet "not on view" page.
 */
function PieceInner({ id }: { id: string }) {
  const { status, profile, pieces } = usePublicArtist();
  if (status === "loading") return <PublicLoading />;
  const piece = pieces.find((p) => p.id === id);
  if (
    status === "missing" ||
    !profile.publicSite.enabled ||
    !piece ||
    !isPubliclyVisiblePiece(piece)
  ) {
    return <PublicMissing />;
  }
  return <PieceDetailScreen />;
}

export default function PublicPieceRoute() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>();
  return (
    <PublicArtistProvider slug={slug}>
      <PieceInner id={id} />
    </PublicArtistProvider>
  );
}
