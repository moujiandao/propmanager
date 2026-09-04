# PropManager

PropManager is a multi-tenant property operations application for landlords and tenants. It brings property records, leases, payments, maintenance, parking, documents, renewals, and scheduled communication into one authenticated system.

[Open the deployed application](https://propmanager-rho.vercel.app)

The application is built for a small property portfolio and remains under active development. There is no public demo account, and the repository should be run with synthetic data.

## What it does

### Landlord workspace

- Tracks properties, units, tenants, leases, and payment records.
- Derives occupancy and tenant status from lease dates instead of relying on manually maintained status fields.
- Provides a drag-and-drop maintenance board with comments, attachments, translation, and closure tracking.
- Manages parking spots and leases while preventing overlapping bookings at the database layer.
- Stages automated email batches for human review before sending and records delivery activity.
- Prepares lease renewals through DocuSeal with an explicit review and confirmation step.
- Supports property documents, Google Drive links, and document metadata extraction.
- Supports multiple landlord-team members through row-level security.

### Tenant portal

- Shows payment history and recurring-payment state.
- Accepts and tracks maintenance requests.
- Exposes profile and account settings separately from the landlord workspace.

The landlord interface supports English and Chinese.

## System shape

```text
Next.js App Router
    |
    +-- public marketing and authentication routes
    +-- protected landlord routes
    +-- protected tenant portal routes
    +-- server API routes and webhooks
            |
            +-- Supabase Postgres, Auth, Storage, and RLS
            +-- Stripe ACH integration
            +-- Resend email delivery
            +-- DocuSeal document signing
            +-- Google Drive integration
            +-- Anthropic document processing
```

The authenticated layout resolves the current user and team on the server before mounting the client-side application store. Database reads use the session-carrying Supabase client so row-level security remains the tenant boundary. Service-role access is limited to server routes that require administrative operations.

## Engineering decisions

- **Derived status:** tenant and unit status comes from dates and current relationships, avoiding stored values that become stale at midnight.
- **Database-backed invariants:** parking leases use exclusion and check constraints to prevent double booking and ambiguous renters.
- **Review before external effects:** email batches and lease renewals are staged and confirmed before sending.
- **Idempotent email processing:** unique delivery keys and atomic state transitions prevent duplicate sends.
- **Per-entity persistence seams:** high-change areas isolate business rules from Supabase adapters and in-memory test doubles.
- **Real URLs:** every application view has a route, which keeps navigation linkable and removes page-state routing.
- **Optimistic updates with rollback:** failed writes restore the affected client state instead of leaving the interface ahead of the database.

## Local development

Requirements:

- Node.js 20+
- A Supabase project

```bash
npm ci
npm run dev
```

The application runs at [http://localhost:3000](http://localhost:3000).

Local configuration is supplied through `.env.local`. The application references these integration groups:

- Supabase public, server, and service-role configuration
- Application URL and scheduled-task secret
- Resend delivery and webhook configuration
- DocuSeal API, template, and webhook configuration
- Stripe server and webhook configuration
- Google service-account configuration
- Anthropic API configuration

Keep service-role keys, signing secrets, and provider credentials on the server and outside Git.

## Verification

```bash
npm test
npm run lint
npm run build
```

The Node test suite covers email rules, document signing, maintenance, tenants, properties, units, payments, parking, formatting, and the adapter boundaries used by those modules.

## Technology

- Next.js 16 and React 19
- Supabase Postgres, Auth, Storage, and row-level security
- Stripe, Resend, DocuSeal, Google APIs, and Anthropic
- Node's built-in test runner
- Vercel

## Current limitations

- Subscription billing and plan enforcement are not implemented, even though pricing and plan fields exist.
- Some older entities still write directly to Supabase rather than through the newer per-entity seams.
- The signed-renewal workflow does not yet file completed documents into Google Drive or automatically advance the lease term.
- Several older interface sections remain in large shared component files.
- The test suite passes, but ESLint currently reports existing React hook, state-update, and memoization cleanup work.
- A production build requires valid Supabase configuration because server routes initialize the Supabase client during page-data collection.
- A local setup currently requires the developer to create `.env.local` manually.
