// Server-side loaders that map snake_case Supabase rows into the camelCase
// shape buildContext() expects. Shared by test-send and the cron engine so
// emails render with the same data on both paths.

import { statusForRow } from "../tenant/status.js";

// `status` derives from the move-in/move-out dates, same as lib/tenant/mappers.js —
// this used to carry its own copy of the normalize expression, which meant the cron
// and the UI could disagree about who counts as a current tenant.
export const mapTenantRow = (t) => !t ? null : ({
  id: t.id, name: t.name, lastName: t.last_name || "", email: t.email,
  propertyId: t.property_id, unitId: t.unit_id, unit: t.unit,
  status: statusForRow(t),
  moveInDate: t.move_in_date, moveOutDate: t.move_out_date,
  monthlyRent: t.monthly_rent || 0, securityDeposit: t.security_deposit || 0,
});

export const mapContractRow = (c) => !c ? null : ({
  id: c.id, propertyId: c.property_id, unit: c.unit,
  startDate: c.start_date, endDate: c.end_date,
  rentAmount: c.rent_amount, dueDay: c.due_day, status: c.status,
});

export const mapPropertyRow = (p) => !p ? null : ({
  id: p.id, address: p.address, city: p.city, state: p.state || "CA", zip: p.zip,
});

export const mapUnitRow = (u) => !u ? null : ({ id: u.id, propertyId: u.property_id, unitNumber: u.unit_number });

export const mapLandlordRow = (l) => !l ? null : ({ id: l.id, name: l.name });

// Load and map every tenant/contract/property/unit for one landlord, plus the
// landlord row. Used by the cron engine to resolve automation targets in bulk.
export async function loadLandlordDataset(supabase, landlordId) {
  const [tRes, cRes, pRes, lRes] = await Promise.all([
    supabase.from("tenant_profiles").select("*").eq("landlord_id", landlordId),
    supabase.from("contracts").select("*, contract_tenants(tenant_id)").eq("landlord_id", landlordId),
    supabase.from("properties").select("*").eq("landlord_id", landlordId),
    supabase.from("landlord_profiles").select("id,name").eq("id", landlordId).maybeSingle(),
  ]);
  const tenants = (tRes.data || []).map(mapTenantRow);
  const contracts = (cRes.data || []).map((c) => ({ ...mapContractRow(c), tenantIds: (c.contract_tenants || []).map((ct) => ct.tenant_id) }));
  const properties = (pRes.data || []).map(mapPropertyRow);
  const propsById = new Map(properties.map((p) => [p.id, p]));
  // `units` has no landlord_id column (RLS defers to parent property), so scope
  // it to this landlord's properties rather than loading every unit in the DB.
  const propertyIds = properties.map((p) => p.id);
  const uRes = propertyIds.length
    ? await supabase.from("units").select("*").in("property_id", propertyIds)
    : { data: [] };
  const unitsById = new Map((uRes.data || []).map((u) => [u.id, mapUnitRow(u)]));
  const landlord = mapLandlordRow(lRes.data);
  return { tenants, contracts, propsById, unitsById, landlord };
}

// Find the active contract that includes a given tenant.
export function contractForTenant(contracts, tenantId) {
  return (contracts || []).find((c) => (c.tenantIds || []).includes(tenantId)) || null;
}

// Load the full merge context for one tenant (tenant + their contract + property + unit).
// `supabase` is a service-role client. Returns { tenant, contract, property, unit }.
export async function loadTenantContext(supabase, { tenantId, landlordId }) {
  const { data: tRow } = await supabase
    .from("tenant_profiles").select("*").eq("id", tenantId).eq("landlord_id", landlordId).maybeSingle();
  const tenant = mapTenantRow(tRow);
  if (!tenant) return { tenant: null, contract: null, property: null, unit: null };

  const [{ data: cRows }, { data: pRow }, { data: uRow }] = await Promise.all([
    supabase.from("contracts").select("*, contract_tenants(tenant_id)").eq("landlord_id", landlordId),
    tenant.propertyId ? supabase.from("properties").select("*").eq("id", tenant.propertyId).maybeSingle() : Promise.resolve({ data: null }),
    tenant.unitId ? supabase.from("units").select("*").eq("id", tenant.unitId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const cRow = (cRows || []).find((c) => (c.contract_tenants || []).some((ct) => ct.tenant_id === tenantId));
  return {
    tenant,
    contract: mapContractRow(cRow),
    property: mapPropertyRow(pRow),
    unit: mapUnitRow(uRow),
  };
}
