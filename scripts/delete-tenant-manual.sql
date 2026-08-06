-- Manually delete one tenant and everything attached to them.
--
-- This is the escape hatch for a test row the app's delete button refuses,
-- because that button blocks whenever any record still points at the tenant
-- (see lib/tenant/deletion.js). Here you are choosing to remove those records
-- too. It is IRREVERSIBLE and there is no undo -- run scripts/backup-tables.mjs
-- first if the tenant is anything other than obvious test data.
--
-- Run STEP 1, read the output, then paste the id into STEP 2. Deliberately not
-- one script: deleting by a name match is how the wrong person gets deleted.


-- ─── STEP 1 — find the tenant and see exactly what will be destroyed ─────────
-- Handles both name shapes: 'Otto' + 'Tester' across two columns, or the whole
-- thing sitting in `name` (older rows predate scripts/split-tenant-names.mjs).

select
  t.id,
  t.name,
  t.last_name,
  t.email,
  t.move_in_date,
  t.move_out_date,
  (select count(*) from payments             where tenant_id = t.id) as payments,
  (select count(*) from contract_tenants     where tenant_id = t.id) as lease_links,
  (select count(*) from maintenance_requests where tenant_id = t.id) as maintenance,
  (select count(*) from documents            where tenant_id = t.id) as documents,
  (select count(*) from parking_leases       where tenant_id = t.id) as parking_leases
from tenant_profiles t
where lower(trim(coalesce(t.name, '') || ' ' || coalesce(t.last_name, ''))) like '%otto%tester%'
   or lower(coalesce(t.name, '')) like '%otto%';

-- STOP. Confirm this returned exactly ONE row and it is the record you mean.
-- If it returned several, or someone you didn't expect, do not continue.


-- ─── STEP 2 — delete it ──────────────────────────────────────────────────────
-- Replace PASTE_ID_HERE (both occurrences) with the id from step 1, then run.
-- Wrapped in a transaction: if any statement fails the whole thing rolls back,
-- so you can never end up with a half-deleted tenant.

begin;

-- Children first — several of these FKs are NO ACTION and would otherwise
-- refuse the delete, which is exactly what the app's guard reports.
delete from payments             where tenant_id = 'PASTE_ID_HERE';
delete from contract_tenants     where tenant_id = 'PASTE_ID_HERE';
delete from maintenance_requests where tenant_id = 'PASTE_ID_HERE';
delete from documents            where tenant_id = 'PASTE_ID_HERE';
delete from parking_leases       where tenant_id = 'PASTE_ID_HERE';

-- email_messages.tenant_id is ON DELETE SET NULL, so the send log survives with
-- the tenant detached. Left alone on purpose: it's an audit trail.

delete from tenant_profiles      where id = 'PASTE_ID_HERE';

-- The portal login, if they had one. Tenants created with "Create tenant portal
-- login" unchecked have no auth.users row and this simply deletes nothing.
delete from auth.users           where id = 'PASTE_ID_HERE';

commit;


-- ─── STEP 3 — resync unit occupancy ─────────────────────────────────────────
-- units.status is derived from tenants on read in the app, but the column is
-- still written by the server routes, so leave it consistent for external SQL.
-- Recomputes every unit of the property the tenant lived in; harmless to run
-- against all units, which is what this does.

update units u
   set status = case
     when exists (
       select 1 from tenant_profiles t
        where t.unit_id = u.id
          and (t.move_out_date is null or t.move_out_date >= current_date)
          and (t.move_in_date  is null or t.move_in_date  <= current_date)
     ) then 'occupied' else 'vacant'
   end;


-- ─── STEP 4 — the "Unit test" unit under Ridge Rd ───────────────────────────
-- Run this only AFTER steps 1-3. Otto Tester is very likely the one tenant the
-- app reported as blocking this unit, so removing him first is what frees it.
--
-- Find it and confirm nothing else is attached:

select
  u.id,
  u.unit_number,
  p.address,
  (select count(*) from tenant_profiles where unit_id = u.id) as tenants,
  (select count(*) from documents       where unit_id = u.id) as documents
from units u
join properties p on p.id = u.property_id
where lower(p.address) like '%ridge%'
  and lower(u.unit_number) like '%test%';

-- Expect tenants = 0 and documents = 0. If tenants is still above zero,
-- someone OTHER than Otto is assigned to it -- stop and look at who, rather
-- than deleting a unit that a real tenancy points at.


-- ─── STEP 5 — delete the unit ───────────────────────────────────────────────
-- Replace PASTE_UNIT_ID_HERE with the id from step 4.

begin;

-- Detach any document filed against the unit rather than deleting it: a lease
-- PDF is worth more than the unit row, and documents.unit_id is nullable.
update documents set unit_id = null where unit_id = 'PASTE_UNIT_ID_HERE';

delete from units where id = 'PASTE_UNIT_ID_HERE';

commit;
