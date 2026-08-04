-- Landlord acknowledgment of a move-in / move-out actually happening.
--
-- Before this, a dashboard transition row dismissed itself: an incoming tenant
-- vanished the moment their move_in_date arrived (derived status flips
-- future→current) and an outgoing one vanished when move_out_date passed. The
-- landlord had no way to say "yes, this actually happened". These two columns
-- hold that confirmation; the dashboard keeps showing the transition until it's
-- set. Null = not yet acknowledged.

alter table public.tenant_profiles
  add column if not exists move_in_acked_at  timestamptz,
  add column if not exists move_out_acked_at timestamptz;

comment on column public.tenant_profiles.move_in_acked_at is
  'When the landlord confirmed the tenant actually moved in. Null = dashboard still shows the pending move-in.';
comment on column public.tenant_profiles.move_out_acked_at is
  'When the landlord confirmed the tenant actually moved out. Null = dashboard still shows the pending move-out.';

-- ── Backfill ────────────────────────────────────────────────────────────────
-- REQUIRED, not optional. "Unacknowledged" is the null default, so without this
-- every tenant who ever moved in becomes an unacknowledged move-in and the
-- dashboard fills with years of history the moment this ships. Treat everything
-- already in the past as acknowledged; only transitions from here forward need a
-- human to confirm them.
--
-- now() (not the move date) is honest: it records when the backfill decided
-- this, not a confirmation the landlord never actually gave.
update public.tenant_profiles
   set move_in_acked_at = now()
 where move_in_acked_at is null
   and move_in_date is not null
   and move_in_date <= current_date;

update public.tenant_profiles
   set move_out_acked_at = now()
 where move_out_acked_at is null
   and move_out_date is not null
   and move_out_date <= current_date;
