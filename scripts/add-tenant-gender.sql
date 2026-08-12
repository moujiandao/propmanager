-- =====================================================================
-- Tenant gender
--
-- Optional, and deliberately NOT CHECK-constrained. The app only ever
-- displays this value (a ♂ / ♀ mark beside the tenant's name); it never
-- branches on it. That is the same test lib/parking/status.js documents
-- for spot `type` vs `market_status`: values you dispatch on want a
-- database constraint, values you render want room to grow without a
-- migration. The vocabulary lives in lib/tenant/gender.js, which
-- validates every write path -- the dropdown, the API routes, and any
-- future seed script.
--
-- Nullable with no default: existing tenants have no gender recorded and
-- must not be guessed at. Unset renders no mark at all.
--
-- Idempotent: safe to run more than once. Run in Supabase -> SQL Editor.
-- =====================================================================

alter table public.tenant_profiles
  add column if not exists gender text;
