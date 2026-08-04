-- Log when a To Do List ticket was closed.
--
-- Nullable with no default: null means "not closed" (or closed before this
-- column existed). The value is written by lib/maintenance/core.setStatus on the
-- transition INTO a closed status and cleared on the transition back out, so it
-- always reflects the most recent close rather than the first one.
--
-- Deliberately NOT backfilled from updated_at/created_at: those say when the row
-- last changed, not when it was closed, and inventing a close date that the
-- landlord never recorded is worse than showing nothing. Pre-existing closed
-- tickets render without a close date until they're re-closed.

alter table public.maintenance_requests
  add column if not exists closed_at timestamptz;

comment on column public.maintenance_requests.closed_at is
  'When the request most recently moved into a closed status. Null while open. Managed by lib/maintenance/core.setStatus.';

-- Supports "closed in the last N days" style filtering later; cheap on a column
-- that is null for every open ticket.
create index if not exists idx_maintenance_closed_at
  on public.maintenance_requests (closed_at)
  where closed_at is not null;
