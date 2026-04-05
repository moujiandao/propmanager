# Changelog

## [2026-04-04]

### Added
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
