-- =====================================================================
-- Email Batch (human-review send) schema
--
-- Adds the manual, human-reviewed batch-send feature on top of the
-- Email Automation tables. A batch is launched from an automation
-- ("Run now"); recipients are reviewed/edited and explicitly confirmed
-- before anything sends.
--
--   email_batches            - one row per Run-now batch (draft|sent|cancelled)
--   email_messages.batch_id  - links draft/sent rows to their batch
--
-- email_messages stays the single send log + audit trail for both cron
-- and batch sends. Draft rows hold the per-recipient editable copy and
-- are excluded from the dedup index (the dedup slot is claimed only when
-- a draft flips to a sent state).
--
-- Both are landlord_id-scoped and reuse the existing is_team_member()
-- RLS helper from migrate-team-landlords.sql.
--
-- Idempotent: safe to run more than once. Run in Supabase → SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. email_batches
--    status: draft | sent | cancelled
-- ---------------------------------------------------------------------
create table if not exists public.email_batches (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references public.landlord_profiles(id) on delete cascade,
  automation_id uuid references public.email_automations(id) on delete set null,
  status        text not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists email_batches_landlord_id_idx on public.email_batches(landlord_id);
alter table public.email_batches enable row level security;
drop policy if exists email_batches_team_all on public.email_batches;
create policy email_batches_team_all on public.email_batches
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- ---------------------------------------------------------------------
-- 2. email_messages.batch_id
--    Cron sends leave it null; batch draft/sent rows set it.
-- ---------------------------------------------------------------------
alter table public.email_messages
  add column if not exists batch_id uuid references public.email_batches(id) on delete cascade;
create index if not exists email_messages_batch_id_idx on public.email_messages(batch_id);

-- ---------------------------------------------------------------------
-- 3. Dedup index: also exclude drafts
--    Draft rows never claim the dedup slot; the claim happens when a
--    draft flips to a sent state, which still blocks true double-sends.
-- ---------------------------------------------------------------------
drop index if exists public.email_messages_dedup_uidx;
create unique index if not exists email_messages_dedup_uidx
  on public.email_messages (automation_id, tenant_id, event_type, event_date, offset_days)
  where direction = 'outbound' and is_test = false and automation_id is not null and status <> 'draft';

commit;
