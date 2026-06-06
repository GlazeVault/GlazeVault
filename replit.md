# GlazeVault

A record-first ceramic archive for artists: a private studio archive, a public portfolio system, and a quiet exhibition network — built so an artist feels they are building a lifelong ceramic archive, not posting content. (Mobile app: `artifacts/mobile`, Expo SDK 54.)

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

GlazeVault is **archive-first creative infrastructure**, not a social network for ceramics. The archive is the foundation; the social layer emerges naturally from shared archives. Three pillars:

1. **Private studio archive** — the foundation. Pieces accumulate glaze history, firing knowledge, dimensions, notes over years.
2. **Public portfolio system** — curated public collections + featured works that emerge from the archive (Portfolio ⊆ Public).
3. **Quiet exhibition network** — discovery and following framed as visiting open studios and exhibitions.

**Record-first, not share-first.** The artist's mental model is "I am building a lifelong ceramic archive," never "I am posting content."

**Design feeling:** calm, contemplative, tactile, editorial, trustworthy, artist-centered. A quiet digital ceramic library + personal studio archive + contemporary exhibition space, connected through intentional sharing.

**Discovery** should feel like wandering open studios, visiting exhibitions, browsing artist monographs — collection-first, slow, editorially paced. Surface artist *worlds* (collections), not isolated posts. Prioritize featured collections, recently updated archives, aesthetic diversity.

**Follow** = following an artist *archive* (new public collections, featured works, exhibition updates) — not a social creator. No follower-count obsession.

**Sharing** = sending someone to a digital exhibition. Core sharing units: Piece, Collection (mini-exhibition, especially important), Portfolio.

**Do NOT build / optimize for:** virality, engagement addiction, infinite/doomscrolling feeds, aggressive algorithmic feeds, TikTok/Reels behavior, loud notifications, content farming, trending competition, gamification, dopamine loops, creator pressure.

**Long-term business direction:** a trusted lifelong archive + portfolio infrastructure for ceramic artists (NOT "Instagram for ceramics"). Value compounds as years of work, glaze history, and firing knowledge accumulate → high trust, long retention, deep emotional attachment.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Public pages show "Not on view" in production but work in dev:** the deployed `expo export` build does NOT receive the workspace Secrets, so `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` inline as empty strings → `isSupabaseConfigured` is false → every public artist page renders the "Not on view" gate. Fix: a committed `artifacts/mobile/.env.production` (NOT gitignored; only `.env` and `.env*.local` are) supplies these two public values to the export. dotenv won't override real `process.env`, so dev is unaffected. After changing these, re-publish so the build re-inlines them.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
