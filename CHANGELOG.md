# Changelog

## [2026-04-29]

### Added
- `data/tenants-upload.csv` template and `scripts/import-tenants.mjs` for bulk tenant onboarding (creates auth user + profile, recomputes unit occupancy)
- Add Tenant modal: `Status` dropdown with picklist values `Current Tenant`, `Future Tenant`, `Previous Tenant`
- Add Tenant modal: `Create portal login` toggle making email/password optional (placeholder email used when the tenant has no portal account)

### Changed
- `PaymentsPage` table now has 4 fixed columns: Tenant (clickable → tenant detail), Zelle Name, Rent, Move-out date (green when populated, green row tint); followed by 12 monthly checkboxes
- `PaymentsPage` adds a bold "Total" row after each unit group showing summed rent
- `mapTenant` normalizes legacy `active` → `current tenant` and `inactive` → `previous tenant` so old records render with the new picklist
- `app/api/auth/create-tenant/route.js` accepts `status` from the client and defaults to `current tenant`

## [2026-04-17]

### Changed
- `PaymentsPage` shows last 12 months of rent checkboxes (up from 6); Save button always visible and disabled when there are no pending changes

### Added
- `LandlordDashboard` "Unpaid Rent — <month>" panel lists active tenants with no `completed` payment for the current calendar month (replaces generic "Tenant Payment Status" list)
- `LandlordDashboard` "Vacancies — Now & Next 6 Months" panel lists `units` with `status === "vacant"` plus tenants whose `moveOutDate` falls within the next 6 months (replaces the "Recent Maintenance" panel)
- `PropertyDetailPage` unit cards now render a per-tenant rent split (tenant name + that tenant's `monthlyRent`) below the unit total, replacing the comma-separated tenant names
- `zelleName` field on the tenants add/edit modals in `property-management-app.jsx`; create-tenant API (`app/api/auth/create-tenant/route.js`) now persists `zelle_name`

## [2026-04-04] (fixes)

### Added
- Tenant unit field replaced with dropdown of real units from `units` table (fix: text input no longer accepted)
- Unit selection auto-syncs `unit_id` + `unit` text field; saving a tenant recomputes occupancy for all units in that property
- `app/api/documents/process-lease/route.js` — auto-creates/updates tenant profiles and contract records from AI-parsed lease documents
- "Create Lease Records" button in `DocumentsPageV2` after parsing a lease; confirmation modal with property/unit selectors and result summary
- `docs/phase2-fixes.md` — spec document for Phase 2 bug fixes

## [2026-04-04]

### Added
- `TenantContactPage` component in `phase2-components.jsx` - rich profile view with Contact, Residence, Personal Info, Housemates, Documents, and Import from Document cards
- Tenant names in `TenantsPage` are now clickable links that navigate to the `tenant-detail` page
- `tenant-detail` route case in `renderPage()` wired to `TenantContactPage`
- Extended `mapTenant` with Phase 2 fields: `moveInDate`, `moveOutDate`, `hasCosigner`, `studentStatus`, `studentYear`, `zelleName`, `homeAddress`, `age`, `unitId`
- Extended `app/api/auth/update-tenant/route.js` to persist all new Phase 2 tenant profile fields

### Changed
- `TenantsPage` now accepts `setPage` and `setSelectedTenantId` props for navigation
- Auth callback route (`app/auth/callback/route.js`) for Supabase password recovery and magic link flows
- Password reset page (`app/reset-password/page.js`) for setting new password after recovery
- Phase 2 sprint plan (`docs/phase2-sprint-plan.md`) covering units, documents, AI parsing, and tenant contact pages
- `phase2-components.jsx` with `PropertyDetailPage` component - unit cards grid, add/edit unit modal, tenant linking
- `units` table support: `mapUnit` mapper, units fetched in `fetchAllData`, units state initialized
- Named exports on reusable UI components (`Icon`, `Badge`, `Modal`, `Inp`, `Sel`, `Btn`, `PageHeader`) for cross-file use

### Changed
- `PropertiesPage` cards are now clickable, navigate to `property-detail` page
- `PropertiesPage` stat changed from tenant count to occupied/total units
- `renderPage()` handles new `property-detail` case via `PropertyDetailPage`

## [2026-03-26]

### Added
- Begin tracking changes
