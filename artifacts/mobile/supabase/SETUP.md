# GlazeVault — Supabase setup

GlazeVault syncs all data (pieces, collections, profile, public-site settings,
visibility, `publicDataSettings`, `featuredOnSite`, and image URLs) to Supabase.
AsyncStorage is only an offline cache. Until the two keys below are set, the app
runs fully offline against that cache — no crashes, just no cloud sync.

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free project, and wait for
it to finish provisioning.

## 2. Create the tables, policies, and storage bucket

In the Supabase dashboard: **SQL Editor → New query**, paste the contents of
[`schema.sql`](./schema.sql), and click **Run**. This creates the `pieces`,
`collections`, and `profiles` tables, the row-level-security policies, and the
public `images` storage bucket.

## 3. Get your two keys

In the dashboard: **Project Settings → API**. Copy:

- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL` (e.g. `https://abcd.supabase.co`)
- **`anon` public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The `anon` key is safe to ship in a client app — it only grants what the
row-level-security policies allow.

## 4. Add them as Replit Secrets

Add both as **Secrets** (the agent will prompt you, or use the Secrets tab):

| Key | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | your Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | your anon public key |

## 5. Restart the Expo workflow

Expo bakes `EXPO_PUBLIC_*` values into the bundle at build time, so restart the
`artifacts/mobile: expo` workflow after setting the secrets. On next launch the
console logs `[supabase] Configured for …` and your existing local data is
migrated up to Supabase automatically.

## Security note (MVP)

There is no user authentication yet, so the schema grants the `anon` key full
read/write. That's fine for a single artist. Before opening the app to multiple
users, add Supabase Auth and tighten the policies (see the comment at the top of
`schema.sql`).
