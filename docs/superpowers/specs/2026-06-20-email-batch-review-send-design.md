# Email Automation — Human-Review Batch Send (design)

Date: 2026-06-20
Status: Approved (pending spec review)
Branch: `feat/email-automation-schema`

## Problem

The Email Automation cron (`app/api/cron/email-automations/route.js`) sends emails
fully automatically: each day it finds matching tenants, renders the template
per-tenant, and sends immediately with no human in the loop. We want a
human-reviewed, manually triggered send: preview the template, review and edit
each recipient's email and the recipient list, then explicitly confirm before
anything goes out.

## Goals

- Manual, on-demand send launched from an automation ("Run now"). The daily cron
  stays off; nothing sends without a human.
- Two-step UX: preview the rendered template, then review/edit per recipient.
- Per-recipient editing of subject and body, plus add/remove recipients.
- Drafts persist (resumable across reload), with a full audit trail.
- A mandatory confirmation dialog listing recipients before the send fires.

## Non-Goals

- No env kill-switch (e.g. no `EMAIL_BATCH_SEND_ENABLED`). The human review +
  confirmation dialog is the safety gate by design.
- No changes to the cron's sending behavior (only a shared-logic extraction).
- No ad-hoc "template + arbitrary audience" entry point. Batches start from an
  automation's rule only.
- Verified-domain / `RESEND_FROM_EMAIL` setup is out of scope (see Preconditions).

## User Flow

Entry point: a **Run now** action on each row in the Automations tab.

1. **Step 1 — Preview.** Render the automation's template with merge fields
   filled using the first matched recipient's real data, with a "showing data
   for X" note. Confirms the template looks right. Actions: Cancel / Continue.
2. **Step 2 — Review & edit.** List every tenant matching the automation's
   `event_type` + `scope` (everyone matching the event, ignoring `offset_days`).
   Each row shows that recipient's individually rendered subject + body, editable
   inline. Remove recipients; add others from the landlord's tenant list. Visible
   recipient count. Primary action: **Send emails**.
3. **Step 3 — Confirmation dialog (mandatory).** Clicking Send emails opens a
   modal listing the N recipients (name + email). Actions: Cancel /
   Confirm & send. The Resend send fires only on Confirm.
4. **Result.** Summary of sent / failed / skipped; batch transitions to `sent`.

Drafts persist between Step 1 and the send, so the flow survives reload.

## Data Model

One new table + one new column. `email_messages` remains the single send log and
audit trail for both cron and batch sends.

### `email_batches` (new)

- `id` uuid pk
- `landlord_id` uuid not null → `landlord_profiles(id)` (RLS scope)
- `automation_id` uuid → `email_automations(id)` on delete set null (source rule)
- `status` text not null default `'draft'` — `draft` | `sent` | `cancelled`
- `created_at`, `updated_at`, `sent_at` timestamps
- RLS: `is_team_member(landlord_id)`, same pattern as the other tables.

### `email_messages` changes

- Add `batch_id` uuid → `email_batches(id)` on delete cascade, nullable. Cron
  sends leave it null; batch draft/sent rows set it.
- Allow `status = 'draft'` for staged, not-yet-sent rows. Draft rows hold the
  per-recipient editable `subject` / `body_html` / `body_text` / `to_email`.
- **Dedup index change.** Scope `email_messages_dedup_uidx` to exclude drafts:
  add `and status <> 'draft'` to its `where` clause. Drafts never claim the dedup
  slot; the claim happens when a draft flips to a sent state, which still blocks
  true double-sends across batches (23505 → treated as skipped).

Migration: `scripts/add-email-batches.sql`, idempotent (same convention as
`scripts/email-automation.sql`). Must be run in Supabase SQL Editor; flagged as
a deploy step.

## Shared Logic & API

### Extraction (anti-drift)

The cron inlines `candidates()` and `matchesScope()`. Extract both into
`lib/email/audience.js` (isomorphic ESM, same module conventions as the rest of
`lib/email`). The cron and the new batch route import from one source so
recipient matching never drifts. No behavior change to the cron.

### Routes (service-role, `landlordId`-scoped)

- `POST /api/email/batches` — Run now. Compute recipients matching the
  automation's `event_type` + `scope`, render each per-recipient, insert one
  `email_batches` row + draft `email_messages` rows, return the batch.
- `PATCH /api/email/batches/[id]` — persist edits: per-recipient subject/body,
  add/remove recipients.
- `POST /api/email/batches/[id]/send` — loop the batch's draft rows, send each
  via the shared `lib/email/send.js` wrapper, flip draft → `sent` / `failed`,
  set `resend_message_id`, transition the batch to `sent`. The dedup index
  guards double-send (23505 → skipped). Returns sent / failed / skipped counts.

## Safety

- The mandatory confirmation dialog (Step 3) plus per-recipient review is the
  send gate. No env flag.
- Send is idempotent at the message level via the dedup index, so a re-send of an
  already-sent slot is skipped rather than duplicated.

## Preconditions (out of scope, operational)

- `RESEND_FROM_EMAIL` is currently unset, so sends use Resend's sandbox sender
  (`onboarding@resend.dev`), which only delivers to the Resend account's own
  email. Real multi-recipient sends require a verified domain + `RESEND_FROM_EMAIL`.

## i18n

Every new landlord-facing string added to both `T.en` and `T.zh` in
`property-management-app.jsx` before use, referenced via `t.keyName` (project
rule). Covers: Run now, step titles, preview note, recipient count, add/remove
labels, send button, confirmation dialog title/body, result summary, errors.

## Testing

- Unit tests for `lib/email/audience.js` (extracted matching: each event_type's
  candidates, scope filtering) via the existing `npm test` Node test runner.
- `npm run build` for the UI. One targeted browser check on the review screen per
  the UI verification protocol (new interactive feature → golden path).

## Files (critical ones)

- `scripts/add-email-batches.sql` — `email_batches` + `email_messages.batch_id` + dedup index change
- `lib/email/audience.js` (new) — extracted `candidates` / `matchesScope`
- `app/api/cron/email-automations/route.js` — import from `lib/email/audience.js`
- `app/api/email/batches/route.js`, `app/api/email/batches/[id]/route.js`,
  `app/api/email/batches/[id]/send/route.js` (new)
- `email-automation-components.jsx` — Run now entry + preview/review/confirm UI
- `property-management-app.jsx` — `T.en` / `T.zh` strings; data wiring if needed
