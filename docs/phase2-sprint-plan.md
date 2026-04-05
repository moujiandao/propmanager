# Phase 2 Sprint Plan: PropManager

## Context

PropManager is a Next.js property management app where all UI lives in a single monolith file (`property-management-app.jsx`). Phase 1 delivered basic CRUD for properties, tenants, leases, payments, and maintenance. Phase 2 transforms it into a more structured system: units become first-class entities, documents get uploaded and AI-parsed, and tenant profiles become rich contact pages with auto-extracted data.

The current data model treats "unit" as a text field on tenants/contracts. Properties only store a unit count. There's no file upload - just Google Drive link embeds. No AI integration exists.

---

## Database Schema Changes (Run in Supabase SQL Editor)

```sql
-- 1. Units table
CREATE TABLE units (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  unit_number text NOT NULL,
  bedrooms integer DEFAULT 1,
  bathrooms integer DEFAULT 1,
  monthly_rent numeric,
  status text DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_units_property ON units(property_id);

-- 2. Documents table
CREATE TABLE documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid REFERENCES landlord_profiles(id) NOT NULL,
  tenant_id uuid REFERENCES tenant_profiles(id),
  property_id uuid REFERENCES properties(id),
  unit_id uuid REFERENCES units(id),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  document_type text DEFAULT 'other' CHECK (document_type IN ('application', 'lease', 'other')),
  ai_extracted jsonb,
  uploaded_at timestamptz DEFAULT now()
);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);

-- 3. Extend tenant_profiles with contact fields
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES units(id);
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS move_in_date date;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS move_out_date date;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS has_cosigner boolean DEFAULT false;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS student_status text;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS student_year text;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS zelle_name text;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS home_address text;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS age integer;

-- 4. Create storage bucket (run via Supabase dashboard or API)
-- Storage > New bucket > "documents" > Public: off
```

**RLS policies** (apply to new tables):
```sql
-- Units: landlords see their own properties' units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage units" ON units FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE landlord_id = auth.uid()));

-- Documents: landlords see their own
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlords manage documents" ON documents FOR ALL
  USING (landlord_id = auth.uid());
CREATE POLICY "Tenants view own documents" ON documents FOR SELECT
  USING (tenant_id = auth.uid());
```

---

## File Structure Decision

New Phase 2 components go in a **separate file**: `phase2-components.jsx`. This keeps the existing monolith stable while organizing new code cleanly. The new file exports components that the main `property-management-app.jsx` imports and wires into `renderPage`.

**`phase2-components.jsx` will contain**:
- `PropertyDetailPage` (units grid, add/edit unit)
- `TenantContactPage` (rich tenant profile with all new fields)
- `DocumentsPageV2` (file upload, document list, AI parse trigger)

**`property-management-app.jsx` still gets modified** for:
- Data state (`units: []`, `documents: []`), mappers, `fetchAllData`, `renderPage` cases
- PropertiesPage card changes (occupied count, clickable cards)
- TenantsPage (clickable tenant names)
- New state: `selectedPropertyId`, `selectedTenantId`

---

## Work Streams

### Wave 1: Foundation (Sequential - do first)

#### WS1: Schema + Dependencies
**What**: Run the SQL above in Supabase SQL Editor. Create `documents` storage bucket in Supabase dashboard (Storage > New bucket > "documents" > Public: off). Install dependencies.
**Commands**:
```bash
npm install @anthropic-ai/sdk mammoth
```
**Env var**: Add `ANTHROPIC_API_KEY` to `.env.local`
**Verification**: Query `SELECT * FROM units LIMIT 0;` succeeds. `documents` bucket visible in Supabase Storage.

---

### Wave 2: Core Features (2 agents in parallel, then 1 agent)

#### WS2: Units + Property Detail Page
**Agent A** - runs in parallel with Agent B

**Files to modify**:
- `property-management-app.jsx` (PropertiesPage at line 538, mappers at 1509, fetchAllData at 1521, renderPage at 1579, data state at 1500)

**Files to create**:
- `phase2-components.jsx` (new file - create with `PropertyDetailPage` component)

**Changes to `property-management-app.jsx`**:

1. **Add `mapUnit` mapper** (after line 1513):
```js
const mapUnit = (u) => ({ id: u.id, propertyId: u.property_id, unitNumber: u.unit_number, bedrooms: u.bedrooms, bathrooms: u.bathrooms, monthlyRent: u.monthly_rent, status: u.status });
```

2. **Add `units` to data state** (line 1500): Add `units: []` to initial state and to the `setData` reset in `handleLogout` (line 1610).

3. **Fetch units in `fetchAllData`** (line 1525): Add `supabase.from("units").select("*")` to the `Promise.all`. Map with `mapUnit`.

4. **Add `selectedPropertyId` state** to the App component for drill-down navigation.

5. **Modify PropertiesPage** (line 538):
   - Change property card stat from `pts.length/{p.units}` tenants to occupied/total units count using `data.units.filter(u => u.propertyId === p.id)`
   - Label: "Occupied" instead of "Tenants"
   - Make each property card clickable: `onClick={() => { setSelectedPropertyId(p.id); setPage("property-detail"); }}`

6. **Add to `renderPage`** (line 1582): New case `"property-detail"` rendering the imported `PropertyDetailPage`.

7. **Import at top of file**: `import { PropertyDetailPage } from './phase2-components'`

**Changes to `phase2-components.jsx`** (new file):

1. **Create `PropertyDetailPage` component**:
   - Export: `export const PropertyDetailPage = ({ data, setData, refresh, user, propertyId, onBack, onNavigateToTenant })`
   - Import supabase client at top: `import { createClient } from './lib/supabase/client'`
   - Import reusable components: needs `useState` from React. For UI components (Modal, Inp, Sel, Btn, Badge, Icon, PageHeader), either import from main file (requires exporting them) OR duplicate the simple helper components in this file. **Recommended**: export the reusable components from `property-management-app.jsx` and import them.
   - Header: property address + back button (`onBack` calls `setPage("properties")`)
   - Grid of unit cards showing: unit number, bed/bath count, monthly rent, status badge, tenant name(s) (clickable via `onNavigateToTenant(tenantId)`)
   - "Add Unit" button + modal with fields: unit number, bedrooms, bathrooms, monthly rent
   - Edit unit (pencil icon on card): same modal pre-filled
   - Insert to `units` table on add; update on edit; call `refresh()` after
   - **Auto-update unit status**: When saving, check if any tenant has `unit_id` matching this unit. If yes, set status to `'occupied'`, otherwise `'vacant'`.

**Verification**: Navigate to Properties, see "X/Y Occupied" on cards. Click a property, see units grid. Add a unit with 2 bed/1 bath. See it in the grid.

---

#### WS3: AI Document Parsing API
**Agent B** - runs in parallel with Agent A (no file overlap)

**Files to create**:
- `app/api/documents/upload/route.js`
- `app/api/documents/delete/route.js`
- `app/api/documents/parse/route.js`

**Upload route** (`app/api/documents/upload/route.js`):
- Accept multipart form data (file + metadata: landlordId, tenantId, propertyId, unitId, documentType)
- Upload file to Supabase Storage bucket `documents` with path: `{landlordId}/{tenantId}/{timestamp}-{filename}`
- Insert row into `documents` table with file_name, file_path, file_type, document_type
- Return document record

**Delete route** (`app/api/documents/delete/route.js`):
- Accept `{ documentId }` in POST body
- Fetch document record to get `file_path`
- Delete from Supabase Storage
- Delete row from `documents` table

**Parse route** (`app/api/documents/parse/route.js`):
- Accept: `{ documentId }` in POST body
- Fetch document record from DB to get `file_path` and `file_type`
- Download file from Supabase Storage
- If PDF: send as base64 document to Claude API (Claude supports native PDF input via `type: "document"` content block)
- If DOCX: use `mammoth` to extract text, send text to Claude
- Claude prompt (system): "You are extracting tenant information from a rental application or lease agreement. Return ONLY valid JSON with the following fields. If a field is not found, set it to null."
- Fields to extract:
  ```json
  {
    "tenant_name": "string",
    "email": "string",
    "phone": "string",
    "home_address": "string",
    "move_in_date": "YYYY-MM-DD or null",
    "move_out_date": "YYYY-MM-DD or null",
    "has_cosigner": true/false,
    "student_status": "undergrad|masters|phd|none|null",
    "student_year": "string (e.g. '2nd year') or null",
    "current_rent": "number or null",
    "zelle_name": "string or null",
    "age": "number or null",
    "lease_start_date": "YYYY-MM-DD or null",
    "lease_end_date": "YYYY-MM-DD or null",
    "rent_amount": "number or null",
    "housemates": ["string names"] or []
  }
  ```
- Save extracted JSON to `documents.ai_extracted` column
- Return the extracted data
- Use Anthropic SDK:
```js
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env
```

**Verification**: Can be tested via curl once Wave 2b adds the UI. For now, verify the routes start without errors.

---

#### WS4: Documents UI + Monolith Wiring
**Agent C** - runs AFTER Agent A merges (to avoid conflicts in shared sections of the monolith)

**Files to modify**:
- `property-management-app.jsx` (DocumentsPage at line 1298, data state, fetchAllData, mappers)
- `phase2-components.jsx` (add DocumentsPageV2 component)

**Changes to `property-management-app.jsx`**:

1. **Add `mapDocument` mapper** (after mapUnit, which was added by WS2):
```js
const mapDocument = (d) => ({ id: d.id, tenantId: d.tenant_id, propertyId: d.property_id, unitId: d.unit_id, fileName: d.file_name, filePath: d.file_path, fileType: d.file_type, documentType: d.document_type, aiExtracted: d.ai_extracted, uploadedAt: d.uploaded_at });
```

2. **Add `documents: []` to data state** and fetch in `fetchAllData`: Add `supabase.from("documents").select("*").order("uploaded_at", { ascending: false })` to the Promise.all.

3. **Replace DocumentsPage in `renderPage`**: Change `case "documents"` to render imported `DocumentsPageV2` instead of old `DocumentsPage`.

4. **Import**: Add `DocumentsPageV2` to the import from `./phase2-components`.

**Changes to `phase2-components.jsx`** (add to existing file):

1. **Create `DocumentsPageV2` component**:
   - Export: `export const DocumentsPageV2 = ({ data, setData, refresh, user })`
   - Top bar: "Upload Document" button + filter dropdowns (by property, by tenant, by type)
   - Upload flow: file input (accept .pdf,.docx,.doc) + form modal (select tenant, property, document type: Application/Lease/Other) -> POST to `/api/documents/upload`
   - Document list: cards or table rows showing file name, type badge, linked tenant name, property, upload date
   - Each document row actions:
     - **View**: generate signed URL from Supabase Storage, open in new tab
     - **Delete**: POST to `/api/documents/delete`, refresh
     - **Parse with AI**: POST to `/api/documents/parse`, show loading spinner, display extracted fields when done
   - Keep old Google Drive embed section at bottom as "Legacy: Google Drive Links" collapsible

**Verification**: Upload a PDF. See it listed. Click view - opens in new tab. Delete it. Click "Parse with AI" - see extracted data.

---

### Wave 3: Integration (After all of Wave 2)

#### WS5: Tenant Contact Page + Cross-linking
**Agent D** - runs after WS2, WS3, WS4 all complete

**Files to modify**:
- `property-management-app.jsx` (TenantsPage at line 603, mappers, renderPage)
- `phase2-components.jsx` (add TenantContactPage)
- `app/api/auth/update-tenant/route.js`

**Changes to `property-management-app.jsx`**:

1. **Extend `mapTenant`** (line 1510): Add new fields:
```js
moveInDate: t.move_in_date, moveOutDate: t.move_out_date, hasCosigner: t.has_cosigner || false,
studentStatus: t.student_status, studentYear: t.student_year, zelleName: t.zelle_name,
homeAddress: t.home_address, age: t.age, unitId: t.unit_id
```

2. **Add `selectedTenantId` state** to App component.

3. **Make tenant names clickable in TenantsPage** (line 603 area): Wrap tenant name in a clickable element that sets `selectedTenantId` and navigates to `"tenant-detail"`.

4. **Add `"tenant-detail"` case to `renderPage`**: Render imported `TenantContactPage`.

5. **Import**: Add `TenantContactPage` to the import from `./phase2-components`.

**Changes to `app/api/auth/update-tenant/route.js`**:

Extend the update payload to include new fields:
```js
const { tenantId, name, phone, propertyId, unit, status, monthlyRent, password,
        moveInDate, moveOutDate, hasCosigner, studentStatus, studentYear,
        zelleName, homeAddress, age, unitId } = await request.json()

// In the .update() call, add:
move_in_date: moveInDate || null,
move_out_date: moveOutDate || null,
has_cosigner: hasCosigner || false,
student_status: studentStatus || null,
student_year: studentYear || null,
zelle_name: zelleName || null,
home_address: homeAddress || null,
age: age || null,
unit_id: unitId || null,
```

**Changes to `phase2-components.jsx`** (add to existing file):

1. **Create `TenantContactPage` component**:
   - Export: `export const TenantContactPage = ({ data, setData, refresh, user, tenantId, onBack, onNavigateToProperty })`
   - Header: tenant name + avatar + back button + "Edit" toggle button
   - Layout: 2-column grid of cards

   - **Contact Card**: email, phone, zelle name, home address
   - **Residence Card**: current unit (clickable -> property detail), property address, move-in/move-out dates, current rent
   - **Personal Card**: age, student status + year, has cosigner (yes/no badge)
   - **Housemates Card**: other tenants in the same unit (`data.tenants.filter(t => t.unitId === tenant.unitId && t.id !== tenant.id)`), each name is clickable (navigates to their contact page)
   - **Documents Card**: `data.documents.filter(d => d.tenantId === tenantId)` displayed as a list. Lease agreements get a special highlight/icon. Click to view (signed URL).
   - **"Import from Document" button**: dropdown of this tenant's documents that have `aiExtracted` data. Selecting one opens a preview of extracted fields with a "Apply" button. Applying fills the edit form and saves via `/api/auth/update-tenant`.

   - **Edit mode**: toggle that makes all fields editable inline. Save button calls `/api/auth/update-tenant` with all fields, then `refresh()`.

**Verification**: Click a tenant name from Tenants page. See full contact page. Edit a field and save. Go to Documents, upload a rental application for this tenant, parse it. Return to tenant contact page, click "Import from Document", select the parsed doc, apply. See fields auto-populate. Check housemates shows other tenants in same unit. Click unit link -> goes to property detail.

---

## Execution Order Summary

```
Wave 1:  WS1 (Schema + deps)                    [manual - Supabase SQL editor + npm install]
Wave 2a: WS2 (Units + Property Detail)  ←─┐     [Agent A - modifies monolith + creates phase2-components.jsx]
         WS3 (AI Parse API routes)       ←─┤     [Agent B - creates 3 new API files, no overlap]
Wave 2b: WS4 (Documents UI + wiring)      ─┘     [Agent C - after Agent A merges, adds to both files]
Wave 3:  WS5 (Tenant Contact Page)                [Agent D - after all above]
```

**Parallelism**: Agents A and B run simultaneously (zero file overlap). Agent C waits for A. Agent D waits for all.

---

## Shared Component Strategy

The reusable UI components (`Modal`, `Inp`, `Sel`, `Btn`, `Badge`, `Icon`, `PageHeader`) currently live inside `property-management-app.jsx` and are NOT exported.

**For `phase2-components.jsx` to use them**: Agent A (WS2) must add `export` to these components in `property-management-app.jsx` and import them in `phase2-components.jsx`. Specifically, add named exports:
```js
export { Modal, Inp, Sel, Btn, Badge, Icon, PageHeader };
```
at the end of the component declarations section (around line 230), and import in `phase2-components.jsx`:
```js
import { Modal, Inp, Sel, Btn, Badge, Icon, PageHeader } from './property-management-app';
```

The `supabase` client instance is also created inside the monolith. For `phase2-components.jsx`, import from the existing client module:
```js
import { createClient } from './lib/supabase/client';
const supabase = createClient();
```

---

## Verification Checklist

- [ ] Properties page shows "X/Y Occupied" per property
- [ ] Clicking property opens detail view with units grid
- [ ] Can add/edit units with bedrooms, bathrooms, rent
- [ ] Units show tenant names; clicking goes to tenant contact page
- [ ] Documents page allows file upload (PDF, DOCX)
- [ ] Uploaded documents appear in list with view/delete
- [ ] "Parse with AI" extracts tenant info from documents
- [ ] Tenant contact page shows all required fields
- [ ] "Import from Document" auto-fills tenant fields from AI extraction
- [ ] Housemates section shows other tenants in same unit
- [ ] Lease agreement link navigates to document within the app
- [ ] All fields manually editable
- [ ] Back navigation works from property detail and tenant contact pages
