# PropManager

## What This Is
A property management web application built with Next.js and Supabase. Provides landlords tools for managing rental properties, units, tenants, leases, payments, maintenance, and documents. Tenants get a separate portal for payments, maintenance requests, and profile management.

## Architecture
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database & Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Payments**: Stripe (ACH)
- **Email**: Resend
- **Styling**: Inline styles with Playfair Display / Crimson Pro fonts
- **UI monolith**: `property-management-app.jsx` contains all landlord and tenant UI components (~1600 lines)
- **Phase 2 components**: `phase2-components.jsx` (planned) will hold PropertyDetailPage, TenantContactPage, DocumentsPageV2
- **API routes**: `app/api/` for auth, payments, webhooks, and document operations
- **Supabase clients**: `lib/supabase/server.js` (service role), `lib/supabase/client.js` (anon key)
- **Auth callback**: `app/auth/callback/route.js` handles Supabase recovery/magic link flows

## Database Tables
- `landlord_profiles` - landlord accounts
- `tenant_profiles` - tenant accounts linked to landlords, properties, and units
- `properties` - rental properties with address, type, unit count, Google Drive link
- `contracts` - lease agreements between tenants and properties
- `payments` - payment records with Stripe integration
- `maintenance_requests` - tenant-submitted maintenance requests
- `email_settings` - landlord email automation config
- `units` (Phase 2) - individual units per property with bed/bath/rent
- `documents` (Phase 2) - uploaded files with AI-extracted metadata

## Key Conventions
- Naming: Next.js App Router conventions (page.js, layout.js, route.js)
- Files: pages in `app/`, API routes in `app/api/`, shared code in `lib/`
- Data mappers convert snake_case (Supabase) to camelCase (UI) in `property-management-app.jsx`
- Reusable UI components: Modal, Inp, Sel, Btn, Badge, Icon, PageHeader, StatCard, Toggle
- Bilingual support: English and Chinese via T object (landlord UI only)
- **Translation rule**: Every user-facing string in landlord UI JSX must be added to both `T.en` and `T.zh` in the T object at the top of `property-management-app.jsx` before use. Reference it as `t.keyName` — never hardcode visible text directly in JSX. When adding a new page or feature, add all its strings to both language blocks as the first step.
- Run dev server: `npm run dev` (localhost:3000)

## Non-Obvious Decisions
- All UI lives in a single JSX file (`property-management-app.jsx`) rather than separate route files. Navigation is state-driven (`page` state variable), not URL-driven.
- `lib/supabase/server.js` uses the service role key (not anon key) for admin operations like creating/updating auth users.
- Google Drive links are stored per-property in `properties.drive_link` and embedded as iframes. Phase 2 adds Supabase Storage for direct file uploads.
- Tenant accounts are created by landlords via API (not self-service signup).

## Common Tasks
- **Run locally**: `npm install && npm run dev`
- **Add a page**: Add a case to `renderPage()` in `property-management-app.jsx` and a nav entry in `Sidebar`
- **Add an API route**: Create `app/api/<route>/route.js`
- **Add a data entity**: Add Supabase table, mapper function, fetch in `fetchAllData()`, and entry in `data` state

## Do Not
- Do not create separate Next.js page files for app views - use the state-driven navigation pattern in the monolith
- Do not use the anon key in server-side API routes that need admin access (use service role key via `lib/supabase/server.js`)
- Do not drop existing `unit` text columns when adding `unit_id` foreign keys - keep both for backward compatibility
- Do not hardcode visible strings in JSX - always add to T.en and T.zh first, then reference via `t.keyName`
