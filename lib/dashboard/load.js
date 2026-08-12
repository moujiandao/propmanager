// The app's read path, lifted out of the `App()` component.
//
// This was `fetchAllData`, defined inside the component and closing over both
// `setData` and the seven inline mappers. It is now React-free and takes its
// Supabase client injected, so the store can live in a layout provider rather
// than in the page component.
//
// Scoping note: every query here is an unfiltered `select("*")`. That is
// deliberate and load-bearing — the rows are scoped by RLS
// (`is_team_member(landlord_id)`), not by the query. So this MUST be called
// with a client carrying the user's session (the browser anon client, or a
// server anon client). Handing it the service-role client from
// lib/supabase/server.js would silently return every team's data.

import { mapMaintenance, mapMaintenanceType, mapMaintenanceAttachment, mapMaintenanceComment } from '../maintenance/mappers.js';
import { mapTenant } from '../tenant/mappers.js';
import { isCurrentRow } from '../tenant/status.js';
import { mapEmailSettings } from '../payment-reminders/mappers.js';
import { EMPTY_EMAIL_SETTINGS } from '../payment-reminders/constants.js';
import { mapProperty } from '../property/mappers.js';
import { mapUnit } from '../units/mappers.js';
import { mapPayment } from '../payments/mappers.js';
import { mapParkingSpot, mapParkingRenter, mapParkingLease } from '../parking/mappers.js';
import { mapContract, mapContractTenant } from '../contracts/mappers.js';
import { mapDocument } from '../documents/mappers.js';
import { mapEmailTemplate, mapEmailAutomation, mapEmailMessage } from '../email/mappers.js';
import { mapLeaseRenewal } from '../docuseal/mappers.js';

// The full shape of `data`. Both branches spread over this rather than building
// a bare object: the caller REPLACES state wholesale, so a branch that omits a
// slice would leave it `undefined` instead of the empty array every consumer
// expects. The tenant branch omits eight of them, which is why this is shared.
export const EMPTY_DATA = {
  properties: [], tenants: [], contracts: [], payments: [], maintenance: [],
  emailSettings: EMPTY_EMAIL_SETTINGS, units: [], documents: [],
  maintenanceTypes: [], maintenanceAttachments: [], maintenanceComments: [],
  emailTemplates: [], emailAutomations: [], emailMessages: [], leaseRenewals: [],
  contractTenants: [], parkingSpots: [], parkingRenters: [], parkingLeases: [],
};

// RLS blocks the embedded `contract_tenants(tenant_id)` join for the browser
// client, so it comes back empty and the real ids have to be fetched through a
// service-role route. Returns contractId -> [tenantId]; an empty map on any
// failure, which the callers treat as "fall back to the (probably empty) embed"
// rather than as an error.
async function fetchTenantLinks(contractIds) {
  const linkMap = new Map();
  if (contractIds.length === 0) return linkMap;
  try {
    const res = await fetch('/api/contracts/tenant-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractIds }),
    });
    if (!res.ok) return linkMap;
    const { links } = await res.json();
    for (const l of links || []) {
      if (!linkMap.has(l.contract_id)) linkMap.set(l.contract_id, []);
      linkMap.get(l.contract_id).push(l.tenant_id);
    }
  } catch {
    // Route unavailable — fall back to the client-side join.
  }
  return linkMap;
}

async function loadLandlordData(supabase) {
  const [
    propRes, tenRes, conRes, payRes, maintRes, emailRes, unitRes, docRes,
    maintTypesRes, maintAttRes, maintCommRes, emailTplRes, emailAutoRes,
    emailMsgRes, renewalRes, parkSpotRes, parkRenterRes, parkLeaseRes,
  ] = await Promise.all([
    supabase.from('properties').select('*').order('created_at', { ascending: true }),
    supabase.from('tenant_profiles').select('*'),
    supabase.from('contracts').select('*, contract_tenants(tenant_id)'),
    supabase.from('payments').select('*').order('due_date', { ascending: false }),
    supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('email_settings').select('*').single(),
    supabase.from('units').select('*').order('unit_number', { ascending: true }),
    supabase.from('documents').select('*').order('uploaded_at', { ascending: false }),
    supabase.from('maintenance_types').select('*').order('name', { ascending: true }),
    supabase.from('maintenance_attachments').select('*').order('created_at', { ascending: true }),
    supabase.from('maintenance_comments').select('*').order('created_at', { ascending: true }),
    supabase.from('email_templates').select('*').order('updated_at', { ascending: false }),
    supabase.from('email_automations').select('*').order('created_at', { ascending: true }),
    supabase.from('email_messages').select('*').neq('status', 'draft').order('created_at', { ascending: false }).limit(300),
    supabase.from('lease_renewals').select('*').order('created_at', { ascending: false }),
    supabase.from('parking_spots').select('*').order('label', { ascending: true }),
    supabase.from('parking_renters').select('*'),
    supabase.from('parking_leases').select('*').order('start_date', { ascending: false }),
  ]);

  // A unit's stored `status` is dead; occupancy is derived from the unit's
  // tenants on read, the same rule the server routes apply. Any future
  // per-route loader that fetches units MUST also fetch that property's
  // tenants, or occupancy silently regresses to whatever the column holds.
  const units = (unitRes.data || []).map(mapUnit).map((unit) => {
    const tenantsInUnit = (tenRes.data || []).filter((t) => t.unit_id === unit.id);
    const isOccupied = tenantsInUnit.some((t) => isCurrentRow(t));
    return { ...unit, status: isOccupied ? 'occupied' : 'vacant' };
  });

  const linkMap = await fetchTenantLinks((conRes.data || []).map((c) => c.id));

  const contracts = (conRes.data || []).map(mapContract).map((c) => {
    const fromApi = linkMap.get(c.id);
    return fromApi && fromApi.length > 0 ? { ...c, tenantIds: fromApi } : c;
  });

  // Flatten the contract→tenant junction into the list the Renewals page reads.
  const contractTenants = [];
  for (const c of conRes.data || []) {
    const fromApi = linkMap.get(c.id);
    const tenantIds = fromApi && fromApi.length > 0
      ? fromApi
      : (c.contract_tenants || []).map((ct) => ct.tenant_id);
    for (const tenantId of tenantIds) {
      contractTenants.push(mapContractTenant({ contract_id: c.id, tenant_id: tenantId }));
    }
  }

  return {
    ...EMPTY_DATA,
    properties:             (propRes.data       || []).map(mapProperty),
    tenants:                (tenRes.data        || []).map(mapTenant),
    contracts,
    payments:               (payRes.data        || []).map(mapPayment),
    maintenance:            (maintRes.data      || []).map(mapMaintenance),
    emailSettings:          mapEmailSettings(emailRes.data),
    units,
    documents:              (docRes.data        || []).map(mapDocument),
    maintenanceTypes:       (maintTypesRes.data || []).map(mapMaintenanceType),
    maintenanceAttachments: (maintAttRes.data   || []).map(mapMaintenanceAttachment),
    maintenanceComments:    (maintCommRes.data  || []).map(mapMaintenanceComment),
    emailTemplates:         (emailTplRes.data   || []).map(mapEmailTemplate),
    emailAutomations:       (emailAutoRes.data  || []).map(mapEmailAutomation),
    emailMessages:          (emailMsgRes.data   || []).map(mapEmailMessage),
    leaseRenewals:          (renewalRes.data    || []).map(mapLeaseRenewal),
    contractTenants,
    parkingSpots:           (parkSpotRes.data   || []).map(mapParkingSpot),
    parkingRenters:         (parkRenterRes.data || []).map(mapParkingRenter),
    parkingLeases:          (parkLeaseRes.data  || []).map(mapParkingLease),
  };
}

// Genuinely sequential: the profile gives the property, and the most recent
// contract link gives the contract, before the rest can be fetched.
async function loadTenantData(supabase, user) {
  const { data: tenRow } = await supabase.from('tenant_profiles').select('*').eq('id', user.id).single();
  const tenant = tenRow ? mapTenant(tenRow) : null;

  const { data: ctRows } = await supabase
    .from('contract_tenants')
    .select('contract_id')
    .eq('tenant_id', user.id)
    .order('created_at', { ascending: false });
  const contractId = ctRows?.[0]?.contract_id;

  const [propRes, conRes, payRes, maintRes, maintCommRes] = await Promise.all([
    tenant?.propertyId
      ? supabase.from('properties').select('*').eq('id', tenant.propertyId)
      : Promise.resolve({ data: [] }),
    contractId
      ? supabase.from('contracts').select('*, contract_tenants(tenant_id)').eq('id', contractId)
      : Promise.resolve({ data: [] }),
    supabase.from('payments').select('*').eq('tenant_id', user.id).order('due_date', { ascending: false }),
    supabase.from('maintenance_requests').select('*').eq('tenant_id', user.id).order('created_at', { ascending: false }),
    supabase.from('maintenance_comments').select('*').order('created_at', { ascending: true }),
  ]);

  return {
    ...EMPTY_DATA,
    properties:          (propRes.data      || []).map(mapProperty),
    tenants:             tenant ? [tenant] : [],
    contracts:           (conRes.data       || []).map(mapContract),
    payments:            (payRes.data       || []).map(mapPayment),
    maintenance:         (maintRes.data     || []).map(mapMaintenance),
    maintenanceComments: (maintCommRes.data || []).map(mapMaintenanceComment),
  };
}

// Load everything the signed-in user can see. Throws on failure — the caller
// decides whether to keep the previous data or surface an error.
export async function loadAllData(supabase, user) {
  return user.role === 'landlord'
    ? loadLandlordData(supabase)
    : loadTenantData(supabase, user);
}
