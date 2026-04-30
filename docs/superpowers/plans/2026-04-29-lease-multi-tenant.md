# Lease Multi-Tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-contract-per-tenant model with a junction table so multiple tenants can share one lease record, grouped into a single card on the Leases page.

**Architecture:** Add a `contract_tenants` junction table in Supabase, migrate existing `tenant_id` values into it, drop the column from `contracts`, then update `mapContract`, `fetchAllData`, `ContractsPage`, `PaymentsPage`, and the three tenant portal components to use a `tenantIds` array instead.

**Tech Stack:** Supabase (SQL editor for migration), Next.js, React (inline styles, no test framework)

---

## File Map

| File | What changes |
|------|-------------|
| Supabase SQL editor | Create `contract_tenants`, migrate data, drop `tenant_id` from `contracts` |
| `property-management-app.jsx:21` | Add `colTenants` to EN translation block |
| `property-management-app.jsx:103` | Add `colTenants` to ZH translation block |
| `property-management-app.jsx:2182` | Update `mapContract` — drop `tenantId`, add `tenantIds` |
| `property-management-app.jsx:2201` | Update landlord contracts query to join `contract_tenants` |
| `property-management-app.jsx:2233` | Update tenant contracts query (two-step via `contract_tenants`) |
| `property-management-app.jsx:1138–1200` | Rewrite `ContractsPage` — card display + Add Lease form |
| `property-management-app.jsx:1274` | Update `getContract` in `PaymentsPage` |
| `property-management-app.jsx:1664` | Update contract lookup in `PaymentPortal` |
| `property-management-app.jsx:1830` | Update contract lookup in `TenantLeasePage` |

---

## Task 1: Database — create junction table

**Files:** Supabase SQL editor (no code files)

- [ ] **Step 1: Open Supabase SQL editor**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Create the junction table**

Paste and run:

```sql
CREATE TABLE contract_tenants (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  UNIQUE (contract_id, tenant_id)
);
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Migrate existing data**

Paste and run:

```sql
INSERT INTO contract_tenants (contract_id, tenant_id)
SELECT id, tenant_id
FROM contracts
WHERE tenant_id IS NOT NULL;
```

Expected: row count equals the number of existing contracts (e.g. "26 rows affected").

- [ ] **Step 4: Verify migration**

```sql
SELECT COUNT(*) FROM contract_tenants;
SELECT COUNT(*) FROM contracts WHERE tenant_id IS NOT NULL;
```

Both counts must match before proceeding.

- [ ] **Step 5: Drop tenant_id column**

```sql
ALTER TABLE contracts DROP COLUMN tenant_id;
```

Expected: "Success. No rows returned."

---

## Task 2: Update mapContract and landlord contracts query

**Files:**
- Modify: `property-management-app.jsx:2182` (mapContract)
- Modify: `property-management-app.jsx:2201` (landlord fetchAllData)

- [ ] **Step 1: Update mapContract (line 2182)**

Replace:
```js
const mapContract  = (c) => ({ id: c.id, tenantId: c.tenant_id, propertyId: c.property_id, unit: c.unit, startDate: c.start_date, endDate: c.end_date, rentAmount: c.rent_amount, dueDay: c.due_day, status: c.status || "active" });
```

With:
```js
const mapContract  = (c) => ({ id: c.id, tenantIds: (c.contract_tenants || []).map(ct => ct.tenant_id), propertyId: c.property_id, unit: c.unit, startDate: c.start_date, endDate: c.end_date, rentAmount: c.rent_amount, dueDay: c.due_day, status: c.status || "active" });
```

- [ ] **Step 2: Update landlord contracts query (line 2201)**

Replace:
```js
supabase.from("contracts").select("*"),
```

With:
```js
supabase.from("contracts").select("*, contract_tenants(tenant_id)"),
```

- [ ] **Step 3: Commit**

```bash
git add property-management-app.jsx
git commit -m "feat: update mapContract and landlord query for contract_tenants junction"
```

---

## Task 3: Add colTenants translation keys

**Files:**
- Modify: `property-management-app.jsx:21` (EN block)
- Modify: `property-management-app.jsx:103` (ZH block)

- [ ] **Step 1: Add to EN block (line 21)**

On the line that contains `colTenant: "Tenant"`, add `colTenants` after it:

```js
colTenant: "Tenant", colTenants: "Tenants", colAmount: "Amount", ...
```

- [ ] **Step 2: Add to ZH block (line 103)**

On the line that contains `colTenant: "租客"`, add `colTenants` after it:

```js
colTenant: "租客", colTenants: "租客", colAmount: "金额", ...
```

- [ ] **Step 3: Commit**

```bash
git add property-management-app.jsx
git commit -m "feat: add colTenants translation key to EN and ZH"
```

---

## Task 4: Update ContractsPage card display

**Files:**
- Modify: `property-management-app.jsx:1156–1166` (ContractsPage card render)

- [ ] **Step 1: Replace single-tenant card content**

In `ContractsPage`, find the `.map(c => { ... })` block starting around line 1156. Replace the first `<div>` inside the card (the TENANT column) with:

```jsx
<div>
  <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.colTenants}</div>
  {c.tenantIds.map(tid => {
    const ten = data.tenants.find(t => t.id === tid);
    return ten ? <div key={tid} style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{tenantFullName(ten)}</div> : null;
  })}
  <div style={{ fontSize: 12, color: "#64748b" }}>{prop?.address} · {c.unit}</div>
</div>
```

Also remove the now-unused `const ten = data.tenants.find(ten => ten.id === c.tenantId);` line at the top of the map callback.

- [ ] **Step 2: Verify in browser**

Run `npm run dev`, navigate to Leases page. Each card should now show all co-tenants stacked, one name per line.

- [ ] **Step 3: Commit**

```bash
git add property-management-app.jsx
git commit -m "feat: ContractsPage card shows all co-tenants per lease"
```

---

## Task 5: Rewrite ContractsPage Add Lease form

**Files:**
- Modify: `property-management-app.jsx:1139–1199` (ContractsPage form state, add function, modal)

- [ ] **Step 1: Update form state (line 1140)**

Replace:
```js
const [form, setForm] = useState({ tenantId: "", propertyId: "", unit: "", startDate: "", endDate: "", rentAmount: "", dueDay: "1" });
```

With:
```js
const [form, setForm] = useState({ tenantIds: [], propertyId: "", unit: "", startDate: "", endDate: "", rentAmount: "", dueDay: "1" });
```

- [ ] **Step 2: Rewrite the add function (line 1142–1149)**

Replace the entire `add` function:
```js
const add = async () => {
  if (!form.tenantId || !form.rentAmount) return;
  const { error } = await supabase.from("contracts").insert({
    landlord_id: user.id, tenant_id: form.tenantId, property_id: form.propertyId, unit: form.unit,
    start_date: form.startDate, end_date: form.endDate,
    rent_amount: +form.rentAmount, due_day: +form.dueDay, status: "active",
  });
  if (!error) { await refresh(); setShow(false); }
};
```

With:
```js
const add = async () => {
  if (!form.tenantIds.length || !form.rentAmount) return;
  const { data: newContract, error } = await supabase.from("contracts").insert({
    landlord_id: user.id, property_id: form.propertyId, unit: form.unit,
    start_date: form.startDate, end_date: form.endDate,
    rent_amount: +form.rentAmount, due_day: +form.dueDay, status: "active",
  }).select().single();
  if (error || !newContract) return;
  await Promise.all(form.tenantIds.map(tid =>
    supabase.from("contract_tenants").insert({ contract_id: newContract.id, tenant_id: tid })
  ));
  if (form.startDate) {
    await Promise.all(form.tenantIds.map(tid =>
      supabase.from("tenant_profiles").update({ move_in_date: form.startDate }).eq("id", tid)
    ));
  }
  await refresh();
  setShow(false);
};
```

- [ ] **Step 3: Replace tenant Sel dropdown with checkbox list in modal**

In the modal's grid `<div>`, replace:
```jsx
<Sel label={t.colTenant} value={form.tenantId} onChange={v => setF("tenantId",v)} options={[{value:"",label:t.selectTenant},...data.tenants.map(ten => ({value:ten.id,label:tenantFullName(ten)}))]} />
```

With:
```jsx
<div style={{ gridColumn: "1 / -1" }}>
  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{t.colTenants}</div>
  <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px" }}>
    {data.tenants.map(ten => (
      <label key={ten.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={form.tenantIds.includes(ten.id)}
          onChange={() => setForm(f => ({
            ...f,
            tenantIds: f.tenantIds.includes(ten.id)
              ? f.tenantIds.filter(id => id !== ten.id)
              : [...f.tenantIds, ten.id]
          }))}
        />
        <span style={{ fontSize: 14, color: "#0f172a" }}>{tenantFullName(ten)}</span>
      </label>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Verify in browser**

Open Add Lease modal — should show a scrollable checklist of tenants. Select 2 tenants, fill in the other fields, save. The Leases page should show one card with both names. Check Tenants page — both tenants' move-in dates should match the lease start date.

- [ ] **Step 5: Commit**

```bash
git add property-management-app.jsx
git commit -m "feat: Add Lease form uses multi-select checklist, syncs move-in dates"
```

---

## Task 6: Update getContract in PaymentsPage

**Files:**
- Modify: `property-management-app.jsx:1274`

- [ ] **Step 1: Update getContract**

Replace:
```js
const getContract = (tenant) => data.contracts.find(c => c.tenantId === tenant.id);
```

With:
```js
const getContract = (tenant) => data.contracts.find(c => c.tenantIds.includes(tenant.id));
```

- [ ] **Step 2: Commit**

```bash
git add property-management-app.jsx
git commit -m "fix: update getContract to use tenantIds array"
```

---

## Task 7: Update tenant fetchAllData contracts query

**Files:**
- Modify: `property-management-app.jsx:2231–2233` (tenant branch of fetchAllData)

- [ ] **Step 1: Replace the tenant contracts query**

The current tenant branch has a `Promise.all` that includes:
```js
supabase.from("contracts").select("*").eq("tenant_id", user.id),
```

Replace the entire `Promise.all` block for the tenant branch with a two-step approach. The tenant contracts fetch must happen after a lookup through `contract_tenants`. Replace:

```js
const [propRes, conRes, payRes, maintRes] = await Promise.all([
  tenant?.propertyId ? supabase.from("properties").select("*").eq("id", tenant.propertyId) : Promise.resolve({ data: [] }),
  supabase.from("contracts").select("*").eq("tenant_id", user.id),
  supabase.from("payments").select("*").eq("tenant_id", user.id).order("due_date", { ascending: false }),
  supabase.from("maintenance_requests").select("*").eq("tenant_id", user.id).order("created_at", { ascending: false }),
]);
```

With:
```js
const { data: ctRows } = await supabase
  .from("contract_tenants")
  .select("contract_id")
  .eq("tenant_id", user.id);
const contractId = ctRows?.[0]?.contract_id;
const [propRes, conRes, payRes, maintRes] = await Promise.all([
  tenant?.propertyId ? supabase.from("properties").select("*").eq("id", tenant.propertyId) : Promise.resolve({ data: [] }),
  contractId
    ? supabase.from("contracts").select("*, contract_tenants(tenant_id)").eq("id", contractId)
    : Promise.resolve({ data: [] }),
  supabase.from("payments").select("*").eq("tenant_id", user.id).order("due_date", { ascending: false }),
  supabase.from("maintenance_requests").select("*").eq("tenant_id", user.id).order("created_at", { ascending: false }),
]);
```

- [ ] **Step 2: Commit**

```bash
git add property-management-app.jsx
git commit -m "fix: tenant fetchAllData looks up contract via contract_tenants junction"
```

---

## Task 8: Update tenant portal component lookups

**Files:**
- Modify: `property-management-app.jsx:1664` (PaymentPortal)
- Modify: `property-management-app.jsx:1830` (TenantLeasePage)

- [ ] **Step 1: Update PaymentPortal (line 1664)**

Replace:
```js
const contract = data.contracts.find(c => c.tenantId === user.id);
```

With:
```js
const contract = data.contracts.find(c => c.tenantIds.includes(user.id));
```

- [ ] **Step 2: Update TenantLeasePage (line 1830)**

Replace:
```js
const contract = data.contracts.find(c => c.tenantId === user.id);
```

With:
```js
const contract = data.contracts.find(c => c.tenantIds.includes(user.id));
```

- [ ] **Step 3: Verify in browser as a tenant**

Log in as a tenant account. Navigate to Payment Portal and My Lease pages. Both should load the correct lease without errors.

- [ ] **Step 4: Commit and push**

```bash
git add property-management-app.jsx
git commit -m "fix: tenant portal components use tenantIds.includes for contract lookup"
git push
```

---

## Self-Review Checklist

- [x] `contract_tenants` table created with correct FK references and CASCADE delete
- [x] Data migration copies all existing `tenant_id` values and drops the column
- [x] `mapContract` produces `tenantIds: []` array
- [x] Landlord `fetchAllData` joins `contract_tenants` in select
- [x] Tenant `fetchAllData` uses two-step lookup through `contract_tenants`
- [x] `ContractsPage` card renders all co-tenant names
- [x] Add Lease form validates `tenantIds.length > 0`, not `tenantId`
- [x] Add Lease form inserts `contract_tenants` rows per tenant
- [x] Add Lease form syncs `move_in_date` per tenant
- [x] `getContract` uses `.tenantIds.includes()`
- [x] `PaymentPortal` uses `.tenantIds.includes()`
- [x] `TenantLeasePage` uses `.tenantIds.includes()`
- [x] Translation keys `colTenants` added to both EN and ZH
- [x] No remaining references to `c.tenantId` or `contract.tenantId` in the codebase
