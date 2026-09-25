-- Atomic residential-lease writes.
--
-- Apply after scripts/migrate-team-landlords.sql, which creates the team RLS
-- helper and assumes contracts, tenant_profiles, and contract_tenants already
-- exist. These functions replace multi-request application sequences with one
-- PostgreSQL transaction for the contract and its party links.

create or replace function public.assert_contract_tenants_for_landlord(
  p_landlord_id uuid,
  p_tenant_ids uuid[]
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_requested_count integer;
  v_distinct_count integer;
  v_matching_count integer;
begin
  if p_landlord_id is null then
    raise exception 'landlord_id is required';
  end if;
  if p_tenant_ids is null or cardinality(p_tenant_ids) = 0 then
    raise exception 'at least one tenant is required';
  end if;

  v_requested_count := cardinality(p_tenant_ids);
  select count(distinct tenant_id) into v_distinct_count
    from unnest(p_tenant_ids) as tenant_id;
  if v_requested_count <> v_distinct_count then
    raise exception 'each tenant may appear only once on a lease';
  end if;

  select count(*) into v_matching_count
    from public.tenant_profiles
   where id = any(p_tenant_ids)
     and landlord_id = p_landlord_id;
  if v_matching_count <> v_requested_count then
    raise exception 'every tenant must belong to the lease landlord';
  end if;
end;
$$;

create or replace function public.create_contract_with_tenants(
  p_landlord_id uuid,
  p_property_id uuid,
  p_unit text,
  p_start_date date,
  p_end_date date,
  p_rent_amount numeric,
  p_due_day integer,
  p_tenant_ids uuid[]
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_contract_id uuid;
begin
  if p_rent_amount is null or p_rent_amount <= 0 then
    raise exception 'rent_amount must be greater than zero';
  end if;
  if p_due_day is not null and p_due_day not between 1 and 31 then
    raise exception 'due_day must be between 1 and 31';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'end_date cannot precede start_date';
  end if;
  if p_property_id is not null and not exists (
    select 1 from public.properties where id = p_property_id and landlord_id = p_landlord_id
  ) then
    raise exception 'property does not belong to the lease landlord';
  end if;

  perform public.assert_contract_tenants_for_landlord(p_landlord_id, p_tenant_ids);

  insert into public.contracts (
    landlord_id, property_id, unit, start_date, end_date, rent_amount, due_day, status
  ) values (
    p_landlord_id, p_property_id, nullif(btrim(p_unit), ''), p_start_date, p_end_date,
    p_rent_amount, p_due_day, 'active'
  ) returning id into v_contract_id;

  insert into public.contract_tenants (contract_id, tenant_id)
  select v_contract_id, tenant_id from unnest(p_tenant_ids) as tenant_id;

  return v_contract_id;
end;
$$;

create or replace function public.update_contract_with_tenants(
  p_contract_id uuid,
  p_landlord_id uuid,
  p_property_id uuid,
  p_unit text,
  p_start_date date,
  p_end_date date,
  p_rent_amount numeric,
  p_due_day integer,
  p_tenant_ids uuid[]
) returns void
language plpgsql
set search_path = public
as $$
begin
  -- Locking the contract makes concurrent edits serialize before either party
  -- list can be replaced.
  perform 1 from public.contracts
   where id = p_contract_id and landlord_id = p_landlord_id
   for update;
  if not found then
    raise exception 'contract does not belong to the lease landlord';
  end if;
  if p_rent_amount is null or p_rent_amount <= 0 then
    raise exception 'rent_amount must be greater than zero';
  end if;
  if p_due_day is not null and p_due_day not between 1 and 31 then
    raise exception 'due_day must be between 1 and 31';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'end_date cannot precede start_date';
  end if;
  if p_property_id is not null and not exists (
    select 1 from public.properties where id = p_property_id and landlord_id = p_landlord_id
  ) then
    raise exception 'property does not belong to the lease landlord';
  end if;

  perform public.assert_contract_tenants_for_landlord(p_landlord_id, p_tenant_ids);

  update public.contracts
     set property_id = p_property_id,
         unit = nullif(btrim(p_unit), ''),
         start_date = p_start_date,
         end_date = p_end_date,
         rent_amount = p_rent_amount,
         due_day = p_due_day
   where id = p_contract_id;

  delete from public.contract_tenants where contract_id = p_contract_id;
  insert into public.contract_tenants (contract_id, tenant_id)
  select p_contract_id, tenant_id from unnest(p_tenant_ids) as tenant_id;
end;
$$;

revoke all on function public.assert_contract_tenants_for_landlord(uuid, uuid[]) from public;
revoke all on function public.create_contract_with_tenants(uuid, uuid, text, date, date, numeric, integer, uuid[]) from public;
revoke all on function public.update_contract_with_tenants(uuid, uuid, uuid, text, date, date, numeric, integer, uuid[]) from public;
grant execute on function public.assert_contract_tenants_for_landlord(uuid, uuid[]) to service_role;
grant execute on function public.create_contract_with_tenants(uuid, uuid, text, date, date, numeric, integer, uuid[]) to service_role;
grant execute on function public.update_contract_with_tenants(uuid, uuid, uuid, text, date, date, numeric, integer, uuid[]) to service_role;
