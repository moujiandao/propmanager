# Maintenance Request Comments — Design

**Date:** 2026-06-01
**Status:** Approved for planning

## Summary

Add a Facebook-style comment thread to each maintenance request. Both the
landlord (team) and the tenant who owns the request can converse. Threads
support one level of nesting (a top-level comment plus replies to it). Each
comment can be translated to Chinese on demand, reusing the existing
maintenance translation route. Authors can delete their own comments.

## Goals

- Two-way conversation between landlord team and the request's tenant.
- One-level reply nesting (reply to a top-level comment; replies are not
  themselves replyable).
- Per-comment "Translate to Chinese" using the existing
  `/api/maintenance/translate` route and a cached `body_zh`.
- Authors can delete their own comments.
- Visible on both the landlord `MaintenancePage` and the tenant
  `TenantMaintenancePage`.

## Non-Goals (v1)

- Editing comments after posting.
- Email / push notifications on new comments.
- Real-time live updates (thread refreshes on load and after posting).
- Nesting deeper than one level.

## Architecture

Follows existing patterns in the monolith. No new architectural concepts.

### Data model — new table `maintenance_comments`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `maintenance_request_id` | uuid fk → `maintenance_requests.id` | the thread |
| `parent_comment_id` | uuid fk → `maintenance_comments.id`, nullable | null = top-level; set = reply. Enforce one level in code. |
| `landlord_id` | uuid | team scoping for RLS (`is_team_member`) |
| `body` | text | comment text |
| `body_zh` | text, nullable | cached Chinese translation, mirrors `description_zh` |
| `author_type` | text | `'landlord'` or `'tenant'` |
| `author_id` | uuid | tenant: `tenant_profiles.id`; landlord: `auth.uid()` of the poster |
| `author_name` | text | denormalized display name (see Identity) — avoids per-render joins |
| `deleted_at` | timestamptz, nullable | soft-delete marker for top-level comments that have replies |
| `created_at` | timestamptz default now() | ordering |

### Identity / author_name

- **Tenant comment:** `author_type='tenant'`, `author_id = tenant.id`,
  `author_name = tenantFullName(tenant)`.
- **Landlord comment:** `author_type='landlord'`,
  `author_id = auth.uid()` (the actual signed-in team member),
  `author_name` = the member's email from `supabase.auth.getUser()` at post
  time. Available client-side already; no extra lookup. `landlord_id`
  on the row is `user.id` (the team id), per the team-landlord convention.

### RLS policies

Mirror the maintenance_requests / attachments scoping.

- **SELECT / INSERT (landlord):** `is_team_member(landlord_id)`.
- **SELECT / INSERT (tenant):** allowed when the parent
  `maintenance_request.tenant_id = auth.uid()`.
- **DELETE (hard, leaf comments):** author may delete own row
  (`author_id = auth.uid()` for landlord; tenant equivalent).
- **UPDATE (soft-delete + translation cache write):** author may update own
  row; landlord team may write `body_zh`.

### Delete behavior

- Author sees a small delete control on their own comments only.
- **Leaf comment (no replies):** hard delete (row removed).
- **Top-level comment with replies:** soft delete — set `deleted_at`,
  render body as a localized `[deleted]` placeholder so replies stay
  readable.

### Reads / data flow

- Add `maintenance_comments` to `fetchAllData` (both landlord and tenant
  branches), mapped snake→camel like `mapMaintenanceAttachment`, stored as
  `data.maintenanceComments`.
- Landlord branch loads all team comments; tenant branch loads comments for
  the tenant's own requests (RLS enforces both).

### Writes

- **Post / reply:** direct `supabase.from('maintenance_comments').insert(...)`
  under RLS — same pattern tenants already use to insert maintenance
  requests. Optimistic update of `data.maintenanceComments`.
- **Translate:** reuse `/api/maintenance/translate`; on success write
  `body_zh` back via supabase update and update local state, exactly like the
  description translate button.

## UI

A collapsible **Comments** section under each request card, implemented once
as a shared component and rendered in both `MaintenancePage` and
`TenantMaintenancePage`.

- Top-level comments in chronological order; replies indented beneath their
  parent.
- Each comment: `author_name`, relative/short date, body, optional `body_zh`
  block, a "Translate to Chinese" button when `body_zh` is empty, a "Reply"
  affordance on top-level comments, and a delete control on the viewer's own
  comments.
- A comment composer at the bottom for new top-level comments; an inline
  composer appears when "Reply" is clicked.
- Comment count shown on the collapsed header.

### Bilingual strings

All landlord-side visible strings (Comments, Reply, Post, Translate to
Chinese, Translating…, deleted placeholder, delete confirm, empty state,
composer placeholder) added to both `T.en` and `T.zh` first, referenced via
`t.keyName`. Tenant portal strings follow the existing hardcoded-English
convention used in `TenantMaintenancePage`.

## Testing / Verification

- `npm run build` clean.
- Targeted browser check: post a top-level comment, post a reply, translate a
  comment, delete own leaf comment, confirm soft-delete on a parent with
  replies. Verify tenant portal sees landlord comments and vice versa.

## Open risks

- Denormalized `author_name` can go stale if a tenant is renamed; acceptable
  for a conversation log (the name reflects who posted at the time).
