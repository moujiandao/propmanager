# SPEC: DocuSeal Tenant Lease-Renewal Workflow

**Status:** Draft spec — approved for build, v1 scope defined below
**Date:** 2026-06-19
**Owner:** Brian
**Type:** Feature spec (not yet implemented)

---

## 1. Summary

Automate the annual lease-renewal signing flow. The system detects 12-month
leases nearing expiry, pre-fills a renewal/extension addendum from existing
PropManager data, lets the landlord review the filled draft, then sends it via
DocuSeal for the tenant(s) to sign and the landlord to countersign. Tenants sign
directly from their email — **no tenant portal login**. Signed results are matched
back to tenant records by email.

This is a **deliberate, low-volume** workflow: ~8 renewals/year, ~20 signatures
total. It is intentionally *not* wired into the high-volume cron/email-automation
system (Resend), which handles date-triggered reminders to many tenants.

---

## 2. Locked Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| DocuSeal deployment | **Cloud, free tier** | ~20 sigs/yr fits free tier; self-hosting is all ops cost, no benefit at this volume. Stack is already all-SaaS. |
| Document model | **Reusable template + pre-fill** | Renewal is the same form 8×/year with different values; clean structured data already exists. |
| Renewal type | **Extension addendum, same rate** | Addendum references the original lease on "X date", extends 12 months, keeps the existing rent. No new-rent input required. |
| Signers | **All housemates parallel → landlord countersigns last (sequential)** | DocuSeal `order` groups: tenants share order `0`, landlord is order `1`. Cosigners deferred to v2. |
| Sender | **DocuSeal sends signer emails** (not Resend) | Reuses DocuSeal's native signing-link emails + reminders; keeps Resend system separate. |
| Trigger | **Date-surfaced review queue + confirm-to-send gate** | Leases ~3–5 months from `end_date` surface for review; nothing emails until the landlord confirms. |
| Review UX | **DocuSeal-rendered preview** | Create submission with emails suppressed; landlord previews the filled doc; confirm releases invites. |
| "X date" stability | **Immutable `original_lease_date` pinned at chain root** | Addendum reference must never drift across multiple renewals. |
| Signed-doc filing | **Google Drive (property folder) + link in PropManager** *(deferred to v2 — see §6)* | Matches existing Drive-based document handling. |
| Lease term advance | **Manual confirm, never auto** | Don't mutate governing lease dates off a webhook. |
| Bad emails | **Block + flag renewals with placeholder/missing signer emails** | Placeholder `@placeholder.local` addresses can't receive or be matched; silent partial-send is the failure mode to avoid. |

---

## 3. Data Model — `lease_renewals` (new table)

First-class record of each renewal attempt; serves as the **review queue**, the
**renewal chain**, and the **audit trail**. Conceptual fields (DDL at build time):

- Identity & links: renewal id, contract id, property id, landlord id, signer tenant ids
- `original_lease_date` — immutable "X date", copied to every renewal in the chain
- New term: `new_term_start`, `new_term_end` (derived: start = current `end_date` + 1 day, end = +12 months), carried-over `rent_amount`
- Workflow `status`: `draft → pending_review → sent → signed → countersigned` (+ `declined`/`blocked`)
- DocuSeal linkage: `submission_id`, per-submitter ids, per-signer signed timestamps
- Result: signed-doc link (v2 Drive link), `applied_to_contract` flag

The existing `contracts` table is unchanged. Renewals live alongside it. The chain
is walked (ordered by term) to compute the next renewal from the latest signed one.

---

## 4. DocuSeal API Contract (verified 2026-06-19)

- **Create submission:** `POST /submissions` — `template_id`, `submitters[]` each with
  `email`, `values{}` (pre-fill by field name), `order`. Global `order: "preserved"`
  = sequential; same submitter `order` number = a parallel group.
- **Suppress emails:** `send_email: false` on create (enables the review gate).
- **Release invite (the gate):** `PUT /submitters/{id}` with `send_email: true` after
  landlord confirms. Higher-order countersigner is auto-notified once tenants finish.
- **Signed PDF:** `GET /submissions/{id}/documents?merge=true`.
- **Webhooks:** `form.completed` (+ related) events. HMAC-SHA256 via
  `X-Docuseal-Signature` header (`timestamp.signature`), secret `whsec_…` — same
  verification shape as the existing Resend webhook (`app/api/webhooks/resend`).

---

## 5. Phases (v1)

**Phase 1 — Data + detection**
- Add `lease_renewals` table + snake→camel mapper.
- Surface a "Renewals due" queue: leases within the window of `end_date`.
- Compute next term from the latest signed renewal in the chain.
- Flag rows with placeholder/missing signer emails as not-sendable.

**Phase 2 — Draft + review gate**
- "Prepare renewal" builds a DocuSeal submission (`send_email: false`) with pre-filled
  fields (names, derived term dates, carried rate, original lease date).
- Landlord previews the DocuSeal-rendered filled addendum.
- Confirm releases tenant invites (`PUT /submitters`); status `draft → pending_review → sent`.

**Phase 3 — Signing + webhook**
- New webhook route (same shape as Resend/Stripe) advancing per-signer status.
- Enforce tenants-then-landlord ordering via DocuSeal order groups.
- Match signer emails back to `tenant_profiles`; stamp signed timestamps; status → `signed`/`countersigned`.

**Phase 5 — Polish**
- Bilingual strings (`T.en`/`T.zh`) for all new UI (per project translation rule).
- Status badges; build + one targeted browser check.

---

## 6. Phase 4 — Filing + lease advance (DEFERRED, nice-to-have)

Out of v1 scope. When picked up:
- On all-complete: `GET /submissions/{id}/documents?merge=true` → upload signed PDF to the
  **property's Drive folder** → record link as a `documents` row (`document_type: 'lease_renewal'`).
- **Prerequisite:** elevate Google service-account scope from `drive.readonly` → `drive.file`
  (auth in `app/api/documents/sync-drive-folder/route.js`). Confirm the Drive repository is a
  **Shared Drive** (not a shared My-Drive folder) to avoid service-account ownership/quota quirks.
- Surface "signed, ready to advance"; landlord **manually** confirms to roll `contracts.end_date`
  and the renewal chain to the new term.

**v1 behavior without Phase 4:** the signed PDF lives in DocuSeal; landlord downloads/files it
manually, and advances the lease term by hand.

---

## 7. External Prerequisites (manual, not code)

- DocuSeal Cloud account; build the renewal template once (place name / date / term /
  signature fields); obtain API key.
- New env vars: DocuSeal API key + webhook secret (`whsec_…`).
- (v2) Elevated Google Drive write scope; confirm Shared Drive destination.

---

## 8. Risks

- **Email matching is the fragile seam.** DocuSeal returns whoever signed; matching on email
  is only as good as tenant email hygiene. Blocking placeholders up front is the main defense.
- **Webhook payload shape** must be confirmed against DocuSeal's live `form.completed` payload
  before Phase 3 (does it carry submitter email + submission id directly).
- **Service-account → Drive write** (v2) is the likeliest "works in theory, fails on quota" spot;
  the Shared Drive check de-risks it.

---

## Sources
- [DocuSeal API Reference](https://www.docuseal.com/docs/api)
- [Send documents for signature via API](https://www.docuseal.com/guides/send-documents-for-signature-via-api)
- [Pre-fill PDF form fields with API](https://www.docuseal.com/guides/pre-fill-pdf-document-form-fields-with-api)
- [Download Signed Documents](https://www.docuseal.com/guides/download-signed-documents)
- [Use Webhooks](https://www.docuseal.com/resources/use-webhooks)
