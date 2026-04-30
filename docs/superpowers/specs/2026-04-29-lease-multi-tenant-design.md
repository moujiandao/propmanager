# Lease Multi-Tenant Design

**Date:** 2026-04-29  
**Status:** Approved

## Problem

The `contracts` table has one row per tenant (`tenant_id` foreign key), so units with co-tenants produce one lease card per person on the Leases page. The correct model is one lease per unit linked to multiple tenants.

## Solution

Introduce a `contract_tenants` junction table, migrate existing data, drop `tenant_id` from `contracts`, and update all frontend references.

## Scope

- Schema change: new `contract_tenants` table, drop `contracts.tenant_id`
- Data migration: existing `tenant_id` values move to `contract_tenants`
- Frontend: `property-management-app.jsx` only - no new files, no API route changes
- Move-in date sync: when a tenant is linked to a lease, their `tenant_profiles.move_in_date` is set to the lease `start_date`

## Database Changes

### 1. Create junction table

```sql
CREATE TABLE contract_tenants (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  UNIQUE (contract_id, tenant_id)
);
```

### 2. Data migration

```sql
-- Copy existing relationships into the junction table
INSERT INTO contract_tenants (contract_id, tenant_id)
SELECT id, tenant_id
FROM contracts
WHERE tenant_id IS NOT NULL;

-- Drop the now-redundant column
ALTER TABLE contracts DROP COLUMN tenant_id;
```

Run these in order in the Supabase SQL editor. The migration is safe: every existing contract has exactly one tenant, so each becomes one `contract_tenants` row.

### 3. Move-in date sync

Handled in the frontend on lease creation (see below). No DB trigger needed.

## Frontend Changes (`property-management-app.jsx`)

### 1. `fetchAllData` — contracts query

```js
// Before
supabase.from("contracts").select("*")

// After
supabase.from("contracts").select("*, contract_tenants(tenant_id)")
```

### 2. `mapContract`

```js
// Before
(c) => ({ id: c.id, tenantId: c.tenant_id, ... })

// After
(c) => ({
  id: c.id,
  tenantIds: (c.contract_tenants || []).map(ct => ct.tenant_id),
  propertyId: c.property_id,
  unit: c.unit,
  startDate: c.start_date,
  endDate: c.end_date,
  rentAmount: c.rent_amount,
  dueDay: c.due_day,
  status: c.status || "active",
})
```

### 3. `ContractsPage` — card display

- Label changes from `t.colTenant` to `t.colTenants`
- Render all tenant names as a stacked list: `c.tenantIds.map(id => tenantFullName(tenants.find(t => t.id === id)))`
- All other fields (rent, term, days remaining, badge) unchanged

### 4. `ContractsPage` — Add Lease form

- Replace single tenant `Sel` dropdown with a scrollable checklist (checkboxes, one per tenant)
- Form state changes: `tenantId: ""` → `tenantIds: []`
- On save:
  1. `supabase.from("contracts").insert(...)` — no tenant_id field
  2. For each selected tenant: `supabase.from("contract_tenants").insert({ contract_id, tenant_id })`
  3. For each selected tenant: `supabase.from("tenant_profiles").update({ move_in_date: form.startDate }).eq("id", tenantId)`

### 5. `getContract` helper in `PaymentsPage`

```js
// Before
const getContract = (tenant) => data.contracts.find(c => c.tenantId === tenant.id);

// After
const getContract = (tenant) => data.contracts.find(c => c.tenantIds.includes(tenant.id));
```

### 6. Tenant portal contract lookup

Used in `TenantLeasePage`, `PaymentPortal`, `PaymentHistoryPage`. Currently:
```js
data.contracts.find(c => c.tenantId === user.id)
```

The tenant's `fetchAllData` branch fetches contracts via:
```js
supabase.from("contracts").select("*").eq("tenant_id", user.id)
```

Both change to:
```js
// In fetchAllData tenant branch:
const { data: ctRows } = await supabase
  .from("contract_tenants")
  .select("contract_id")
  .eq("tenant_id", user.id);
const contractId = ctRows?.[0]?.contract_id;
// Fetch with join so mapContract can build tenantIds array
const conRes = contractId
  ? await supabase.from("contracts").select("*, contract_tenants(tenant_id)").eq("id", contractId)
  : { data: [] };

// In component lookups (data already loaded) — or simply data.contracts[0]
// since tenant data is scoped to one contract:
data.contracts.find(c => c.tenantIds.includes(user.id))
```

## Translation Keys to Add

```js
colTenants: "Tenants"   // EN
colTenants: "租客"       // ZH (reuse existing value from colTenant)
```

## Out of Scope

- Editing or removing tenants from an existing lease (Supabase dashboard for now)
- Lease-level status per tenant
- Rent splitting per tenant
