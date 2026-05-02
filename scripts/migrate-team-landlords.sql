-- =====================================================================
-- Team-landlord migration
--
-- Goal: collapse three landlord_profiles into one canonical "team" id, and
-- introduce a landlord_members table so multiple auth users can share access
-- to that single landlord_id.
--
-- Canonical landlord_id: d8915fb6-63d5-499b-b6bf-a6a925d28bba (Brian Mar / moujiandao)
-- Merged in:
--   cd5630b0-3681-4f48-ad90-c43d75982417 (brian mar / techservices97)
--   92314f0d-bfc4-4f0f-8003-c67d4c4e267e (Wayne / waynemar92)
--
-- Run inside a transaction so it's all-or-nothing.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. New table: landlord_members
-- ---------------------------------------------------------------------
create table if not exists public.landlord_members (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  landlord_id  uuid not null references public.landlord_profiles(id) on delete cascade,
  role         text not null default 'owner',
  created_at   timestamptz not null default now()
);
create index if not exists landlord_members_landlord_id_idx on public.landlord_members(landlord_id);
alter table public.landlord_members enable row level security;

-- Members can read their own membership row(s)
drop policy if exists landlord_members_self_select on public.landlord_members;
create policy landlord_members_self_select on public.landlord_members
  for select using (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. Backfill: every existing landlord_profile gets a self-membership
-- ---------------------------------------------------------------------
insert into public.landlord_members (auth_user_id, landlord_id, role)
select id, id, 'owner' from public.landlord_profiles
on conflict (auth_user_id) do nothing;

-- ---------------------------------------------------------------------
-- 3. Add cross-memberships: techservices97 + Wayne become members of moujiandao
-- ---------------------------------------------------------------------
update public.landlord_members
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where auth_user_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

-- ---------------------------------------------------------------------
-- 4. Re-point all data to the canonical landlord_id
-- ---------------------------------------------------------------------
update public.properties
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where landlord_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

update public.tenant_profiles
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where landlord_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

update public.contracts
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where landlord_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

update public.payments
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where landlord_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

update public.maintenance_requests
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where landlord_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

update public.email_settings
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where landlord_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

update public.documents
   set landlord_id = 'd8915fb6-63d5-499b-b6bf-a6a925d28bba'
 where landlord_id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

-- ---------------------------------------------------------------------
-- 5. Delete the two now-empty landlord_profiles rows
--    (auth.users entries for those ids are KEPT so they can still log in
--     as team members via landlord_members.)
-- ---------------------------------------------------------------------
delete from public.landlord_profiles
 where id in (
   'cd5630b0-3681-4f48-ad90-c43d75982417',
   '92314f0d-bfc4-4f0f-8003-c67d4c4e267e'
 );

-- ---------------------------------------------------------------------
-- 6. Helper function: is_team_member(target_landlord_id)
--    Returns true if the calling user is a member of that landlord.
--    Using a function keeps every policy below readable and consistent.
-- ---------------------------------------------------------------------
create or replace function public.is_team_member(target_landlord_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.landlord_members
     where landlord_id = target_landlord_id
       and auth_user_id = auth.uid()
  );
$$;

grant execute on function public.is_team_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Replace landlord-scoped RLS policies with membership-based ones.
--    Drops any existing policies on each table by enumerating pg_policies.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  tbls text[] := array[
    'properties',
    'tenant_profiles',
    'contracts',
    'contract_tenants',
    'payments',
    'maintenance_requests',
    'email_settings',
    'documents',
    'units',
    'landlord_profiles'
  ];
  tbl text;
begin
  foreach tbl in array tbls loop
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I', r.policyname, tbl);
    end loop;
  end loop;
end$$;

-- properties (landlord_id-scoped)
alter table public.properties enable row level security;
create policy properties_team_all on public.properties
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- tenant_profiles (member access OR self-access by tenant)
alter table public.tenant_profiles enable row level security;
create policy tenant_profiles_team_select on public.tenant_profiles
  for select using (public.is_team_member(landlord_id) or auth.uid() = id);
create policy tenant_profiles_team_modify on public.tenant_profiles
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));
create policy tenant_profiles_self_update on public.tenant_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- contracts (landlord_id-scoped)
alter table public.contracts enable row level security;
create policy contracts_team_all on public.contracts
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- contract_tenants (no landlord_id; defer to parent contract)
alter table public.contract_tenants enable row level security;
create policy contract_tenants_team_all on public.contract_tenants
  for all using (
    exists (
      select 1 from public.contracts c
       where c.id = contract_tenants.contract_id
         and public.is_team_member(c.landlord_id)
    )
  ) with check (
    exists (
      select 1 from public.contracts c
       where c.id = contract_tenants.contract_id
         and public.is_team_member(c.landlord_id)
    )
  );

-- payments (landlord_id-scoped + tenant self-access)
alter table public.payments enable row level security;
create policy payments_team_all on public.payments
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));
create policy payments_self_select on public.payments
  for select using (auth.uid() = tenant_id);

-- maintenance_requests (landlord_id-scoped + tenant self-access)
alter table public.maintenance_requests enable row level security;
create policy maintenance_team_all on public.maintenance_requests
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));
create policy maintenance_self_modify on public.maintenance_requests
  for all using (auth.uid() = tenant_id) with check (auth.uid() = tenant_id);

-- email_settings (landlord_id-scoped)
alter table public.email_settings enable row level security;
create policy email_settings_team_all on public.email_settings
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- documents (landlord_id-scoped)
alter table public.documents enable row level security;
create policy documents_team_all on public.documents
  for all using (public.is_team_member(landlord_id))
          with check (public.is_team_member(landlord_id));

-- units (no direct landlord_id; defer to parent property)
alter table public.units enable row level security;
create policy units_team_all on public.units
  for all using (
    exists (
      select 1 from public.properties p
       where p.id = units.property_id
         and public.is_team_member(p.landlord_id)
    )
  ) with check (
    exists (
      select 1 from public.properties p
       where p.id = units.property_id
         and public.is_team_member(p.landlord_id)
    )
  );

-- landlord_profiles (only team members can read/update the team's row)
alter table public.landlord_profiles enable row level security;
create policy landlord_profiles_team_select on public.landlord_profiles
  for select using (public.is_team_member(id));
create policy landlord_profiles_team_update on public.landlord_profiles
  for update using (public.is_team_member(id))
          with check (public.is_team_member(id));

commit;
