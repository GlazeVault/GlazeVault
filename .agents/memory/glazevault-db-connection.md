---
name: GlazeVault Supabase DB direct-connection quirk
description: How to actually reach the Supabase Postgres for DDL/migrations from this container (the obvious env vars don't work as-is).
---

# Reaching the Supabase Postgres for DDL / migrations

When you need to run schema DDL (e.g. `alter table ... add column`) against the
live Supabase DB from this container, neither secret works as-is:

- `SUPABASE_DB_URL` (direct `db.<ref>.supabase.co`) is **IPv6-only** → container
  has no IPv6 route → `Network is unreachable`.
- `SUPABASE_POOLER_URL` as stored points at the **wrong pooler host**
  (`aws-0-us-east-1...:5432`) → `FATAL: Tenant or user not found`.

**What works:** keep the username/password from `SUPABASE_POOLER_URL` but swap the
host to **`aws-1-us-east-1.pooler.supabase.com`** on the **transaction pooler port
`6543`**. Reconstruct the URL in code (never print the secret), then `psql`.

**Why:** Supabase deprecated IPv4 on direct connections and the project's real
pooler tenant lives behind the `aws-1-` prefix, not the `aws-0-` host baked into
the secret.

**How to apply:** parse the pooler URL with Python's urllib, replace netloc host
with `aws-1-us-east-1.pooler.supabase.com:6543`, run `psql <url> -c "<ddl>"`. The
REST API (`EXPO_PUBLIC_SUPABASE_URL` + anon key) is fine for read checks but
cannot run DDL. After any schema change, also update
`artifacts/mobile/supabase/schema.sql` to match.
