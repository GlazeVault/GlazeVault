---
name: GlazeVault collections data model
description: How pieces relate to collections in the GlazeVault mobile app and the invariants around removing/deleting.
---

# Collections ↔ pieces relationship

Each pottery piece carries `collectionIds: string[]` (MULTI-collection membership, NOT a join table). Pieces live in `PotteryContext` (AsyncStorage `@glazevault_pieces_v2`); collections live in `CollectionsContext` (`@glazevault_collections_v1`). The two contexts are independent — `CollectionsContext` has no access to pieces. Persistence keeps `collection_id` = first id for back-compat (see `glazevault-privacy.md` / `glazevault-supabase.md`).

## Membership is pure organization
`addPieceToCollection(collectionId, pieceId)` / `removePieceFromCollection(collectionId, pieceId)` add/splice an entry in `collectionIds`. They must NEVER touch `isPublic`/`featuredInPortfolio` — adding a piece to a collection does not publish or feature it. Multi-select toggle UI (piece detail + edit screens) uses `collectionIds.includes(id)`.

## Invariant: removing a relation must never delete the piece
Removing a piece from a collection only splices its `collectionIds`. `deletePiece` is reserved exclusively for the explicit "Delete piece" destructive action. Archive/restore (`archived` flag) is separate from deletion and from collection membership.

**Why:** users expect a piece to stay in the Archive after leaving a collection; conflating the two would destroy data.

## Cascade on collection deletion
Because `CollectionsContext` can't touch pieces, the cascade must happen at the call site (the collection detail screen): unlink every affected piece via `removePieceFromCollection` BEFORE calling `deleteCollection`, otherwise pieces keep a dangling id in `collectionIds` pointing at a gone collection.

**How to apply:** any new code path that deletes a collection must also unlink its pieces, or pieces get stuck referencing a deleted collection.
