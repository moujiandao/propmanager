# Phase 2 Bug Fixes & Features

## Fix 1: Tenant Unit Assignment as Dropdown

### Problem
The unit field on the tenant edit form is a free-text input. Units must exist in the `units` table before a tenant can be assigned to one, but nothing enforces this. Typing a unit name doesn't link the tenant to a real unit record, so `unit_id` stays null and housemate detection breaks.

### Approach

**Files affected:**
- `property-management-app.jsx` — tenant edit modal in `TenantsPage` (~line 603)
- `phase2-components.jsx` — edit mode in `TenantContactPage`

**Changes:**

1. In the tenant edit modal, replace the `unit` text `<Inp>` with a `<Sel>` dropdown:
   - Options: units filtered by the selected `propertyId` for this tenant
   - Display: `"Unit {unitNumber} — {bedrooms}bd/{bathrooms}ba"` + status badge
   - On select: set both `unitId` (uuid) and `unit` (text = unitNumber, for backward compat)
   - If no units exist for the property, show a disabled option: "No units — add units first from the property page"

2. Same treatment in `TenantContactPage` edit mode (Residence card unit field).

3. **Auto-update unit status on save**: When `update-tenant` saves a new `unit_id`, run a follow-up query:
   - Set the newly assigned unit to `status = 'occupied'`
   - If the tenant had a previous `unit_id` (different from the new one), check if any other tenant still has that old unit — if not, set it to `status = 'vacant'`
   - Do this inside the existing `update-tenant` API route after the profile update

**No schema changes required.** All needed columns (`unit_id` on `tenant_profiles`, `status` on `units`) already exist.

---

## Feature 2: Auto-Create Lease Records from Uploaded Document

### Problem
After uploading and AI-parsing a lease agreement, the landlord still has to manually create a contract and update each tenant. The AI already extracts all the relevant fields — we should use them to do it automatically.

### Approach

#### Data model note
The `contracts` table has a single `tenant_id` per record. For a multi-tenant lease (1–4 people), the app creates **one contract record per tenant**, all sharing the same unit, dates, and rent. This matches the existing pattern and avoids a schema change.

#### New API route: `app/api/documents/process-lease/route.js`

Accepts: `{ documentId, propertyId, unitId }`

Steps:
1. Fetch the document record and its `ai_extracted` JSON
2. Build a list of all people on the lease: `[ai_extracted.tenant_name, ...ai_extracted.housemates]` — filter nulls
3. For each person:
   a. Search `tenant_profiles` by name (case-insensitive) within the landlord's tenants — if found, use existing tenant
   b. If not found, create a new tenant_profile (name only, no auth account yet — `status: 'pending'`)
4. For each matched/created tenant:
   - Update `tenant_profiles`: set `unit_id`, `property_id`, `move_in_date` from `ai_extracted.lease_start_date`
   - Upsert a contract record: `tenant_id`, `property_id`, `unit` (unit number text), `start_date`, `end_date`, `rent_amount`
   - Skip if a contract already exists for this tenant with overlapping dates (check by tenant_id + start_date)
5. Return: `{ created: [...], updated: [...], skipped: [...] }` — names of tenants in each bucket

#### UI changes in `DocumentsPageV2` (`phase2-components.jsx`)

After a successful "Parse with AI" result on a document of type `lease`:
- Show a "Create Lease Records" button below the extracted data panel
- Clicking opens a confirmation modal showing:
  - Tenant names found on the lease (with match status: "existing tenant" or "new — will create profile")
  - Lease dates and rent
  - Property + unit dropdowns (pre-filled from document context if available, editable)
- "Confirm & Create" button POSTs to `/api/documents/process-lease`
- Success: refresh data, show summary ("3 tenants updated, 1 contract created")

#### Files affected:
- `app/api/documents/process-lease/route.js` — new file
- `phase2-components.jsx` — update `DocumentsPageV2` to show the confirm flow after parsing a lease

---

## Execution Order

Both fixes are independent and can be implemented in parallel.

- **Fix 1** touches `property-management-app.jsx` (tenant edit modal) + `phase2-components.jsx` (TenantContactPage edit) + `update-tenant` API route
- **Feature 2** touches `phase2-components.jsx` (DocumentsPageV2 only - append new modal state) + new API route file

No schema migrations required for either fix.
