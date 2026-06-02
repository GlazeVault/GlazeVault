---
name: GlazeVault collections data model
description: How pieces relate to collections in the GlazeVault mobile app and the invariants around removing/deleting.
---

# Collections ↔ pieces relationship

Each pottery piece carries a single optional `collectionId` (NOT an array, NOT a join table). Pieces live in `PotteryContext` (AsyncStorage `@glazevault_pieces_v2`); collections live in `CollectionsContext` (`@glazevault_collections_v1`). The two contexts are independent — `CollectionsContext` has no access to pieces.

## Invariant: removing a relation must never delete the piece
Removing a piece from a collection only clears its `collectionId`. Use the dedicated `removePieceFromCollection(collectionId, pieceId)` in `PotteryContext` (clears only when `p.collectionId === collectionId`). `deletePiece` is reserved exclusively for the explicit "Remove from archive" destructive action.

**Why:** users expect a piece to stay in the Archive after leaving a collection; conflating the two would destroy data.

## Cascade on collection deletion
Because `CollectionsContext` can't touch pieces, the cascade must happen at the call site (the collection detail screen): unlink every affected piece via `removePieceFromCollection` BEFORE calling `deleteCollection`, otherwise pieces keep a dangling `collectionId` pointing at a gone collection.

**How to apply:** any new code path that deletes a collection must also unlink its pieces, or pieces get stuck referencing a deleted collection.
