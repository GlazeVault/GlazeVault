---
name: GlazeVault search (Case 1 MVP)
description: How piece/collection search works and the deliberate "keep it simple" scope
---

# Search

Local, in-memory substring filtering only — no search screen, no route, no debounce, no fuzzy matching. **Why:** the Case 1 spec said "basic local filtering only"; the architect explicitly said NOT to add fuzzy/debounce/dedicated-screen.

- Shared input: `components/SearchBar.tsx` (controlled: `value`/`onChangeText`/`placeholder`; Feather search icon + clear "x").
- Archive tab (`app/(tabs)/index.tsx`): filters `pieces` over title/clay/glaze/firing/cone/dimensions/notes.
- Collections tab (`app/(tabs)/collections.tsx`): filters `collections` over title/intro.
- Convention each tab follows: `trimmed = query.trim().toLowerCase()`; empty/whitespace query = no filter (show all); count switches to "X of Y" only while querying; a "No matches" block renders only when query active AND filtered list empty; search bar only renders when the source list is non-empty.

**How to apply:** if adding search to another tab, reuse `SearchBar` and this same pattern. There is real duplication of the query/filter/count/no-results logic across the two tabs — fine for now; extract a small hook only if a third search surface appears.
