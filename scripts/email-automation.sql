-- =====================================================================
-- Email Automation schema
--
-- Three new tables for the Email Automation feature. The existing
-- payment-reminder feature (email_settings) is left untouched.
--
--   email_templates   - named, reusable templates with {merge_tags}
--   email_automations - date-triggered rules (event + offset days + template)
--   email_messages    - outbound send log AND inbound reply store + tracking
--
-- All three are landlord_id-scoped and reuse the existing is_team_member()
-- RLS helper from migrate-team-landlords.sql. Inbound inserts and tracking
-- updates are performed by the service role (bypasses RLS).
--
-- Idempotent: safe to run more than once. Run in Supabase → SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. email_templates
-- ---------------------------------------------------------------------
create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlord_profiles(id) on delete cascade,
  name        text not null,
  subject     text not null default '',
  body_html   text,
  body_text   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists email_templates_landlord_id_idx on public.email_templates(landlord_id);
alter table public.email_templates enable row level security;
drop policy if exists email_templates_team_all on public.email_templates;
create policy email_templates_team_all on public.email_templates
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- ---------------------------------------------------------------------
-- 2. email_automations
--    event_type: move_out | move_in | lease_end | projected_move_out | rent_due
--    offset_days: lead times before the event, e.g. {10,5,3}
--    scope: optional jsonb filter, e.g. {"propertyId": "...", "status": "current tenant"}
-- ---------------------------------------------------------------------
create table if not exists public.email_automations (
  id          uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlord_profiles(id) on delete cascade,
  name        text not null,
  event_type  text not null,
  offset_days int[] not null default '{}',
  template_id uuid references public.email_templates(id) on delete set null,
  scope       jsonb,
  enabled     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists email_automations_landlord_id_idx on public.email_automations(landlord_id);
alter table public.email_automations enable row level security;
drop policy if exists email_automations_team_all on public.email_automations;
create policy email_automations_team_all on public.email_automations
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- ---------------------------------------------------------------------
-- 3. email_messages (send log + inbound replies + tracking)
--    direction: outbound | inbound
--    status:    queued | sent | delivered | opened | bounced | complained | failed | received
-- ---------------------------------------------------------------------
create table if not exists public.email_messages (
  id                  uuid primary key default gen_random_uuid(),
  landlord_id         uuid not null references public.landlord_profiles(id) on delete cascade,
  direction           text not null default 'outbound',
  automation_id       uuid references public.email_automations(id) on delete set null,
  template_id         uuid references public.email_templates(id) on delete set null,
  tenant_id           uuid references public.tenant_profiles(id) on delete set null,
  event_type          text,
  event_date          date,
  offset_days         int,
  to_email            text,
  from_email          text,
  subject             text,
  body_html           text,
  body_text           text,
  resend_message_id   text,
  status              text not null default 'sent',
  delivered_at        timestamptz,
  opened_at           timestamptz,
  replied_at          timestamptz,
  reply_to_message_id uuid references public.email_messages(id) on delete set null,
  is_test             boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists email_messages_landlord_id_idx   on public.email_messages(landlord_id);
create index if not exists email_messages_resend_id_idx      on public.email_messages(resend_message_id);
create index if not exists email_messages_tenant_id_idx      on public.email_messages(tenant_id);
create index if not exists email_messages_reply_to_idx       on public.email_messages(reply_to_message_id);

-- Dedup guarantee: one real outbound send per (automation, tenant, event, date, offset).
-- Makes the cron route idempotent via INSERT ... ON CONFLICT DO NOTHING.
create unique index if not exists email_messages_dedup_uidx
  on public.email_messages (automation_id, tenant_id, event_type, event_date, offset_days)
  where direction = 'outbound' and is_test = false and automation_id is not null;

alter table public.email_messages enable row level security;
drop policy if exists email_messages_team_all on public.email_messages;
create policy email_messages_team_all on public.email_messages
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

commit;
