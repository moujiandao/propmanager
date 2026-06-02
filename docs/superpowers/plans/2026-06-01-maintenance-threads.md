# Maintenance Threads Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
> Per project CLAUDE.md this plan is intentionally high-level (phases + key decisions,
> no code snippets). No unit-test framework exists; verification is `npm run build`,
> `npm run lint`, and targeted browser checks per the UI Verification Protocol.

**Goal:** Add a two-way, one-level-nested comment thread (with per-comment Chinese
translation and delete-own) to each maintenance request, visible to both the landlord
team and the request's tenant.

**Architecture:** New `maintenance_comments` table (RLS scoped like maintenance_requests),
read via `fetchAllData`, written via direct supabase client under RLS. One shared
`CommentThread` component rendered in both `MaintenancePage` and `TenantMaintenancePage`.
Translation reuses `/api/maintenance/translate`.

**Tech stack:** Next.js 16, Supabase (Postgres + RLS), React 19, inline styles.

**Spec:** `docs/superpowers/specs/2026-06-01-maintenance-comments-design.md`

---

### Phase 1: Database migration

- [ ] Create `scripts/add-maintenance-comments.mjs` following the printed-SQL pattern of
  `add-maintenance-types-attachments.mjs` (console.log the SQL for the Supabase SQL Editor).
- [ ] SQL: `maintenance_comments` table per the spec's data-model table (id, request fk,
  nullable parent fk, landlord_id, body, body_zh, author_type, author_id, author_name,
  deleted_at, created_at), index on `maintenance_request_id`, `ENABLE ROW LEVEL SECURITY`.
- [ ] RLS policies: landlord team read/insert/update/delete via `is_team_member(landlord_id)`;
  tenant read/insert/update/delete gated on the parent request's `tenant_id = auth.uid()`
  (model the tenant policy on the existing maintenance_requests tenant policy).
- [ ] **Decision:** keep it backwards-compatible/additive — new table only, no changes to
  existing columns. Run the printed SQL in Supabase before UI testing.
- [ ] Verify: `node scripts/add-maintenance-comments.mjs` prints valid SQL; run it in Supabase; commit the script.

### Phase 2: Data layer

- [ ] Add `mapMaintenanceComment` (snake→camel) mirroring `mapMaintenanceAttachment`;
  add `maintenanceComments: []` to the initial `data` state.
- [ ] Load `maintenance_comments` in both `fetchAllData` branches (landlord: all team rows;
  tenant: rows for own requests — RLS enforces both), ordered by `created_at` ascending.
- [ ] Verify: `npm run build` clean; commit.

### Phase 3: Bilingual strings

- [ ] Add every landlord-side comment string to **both** `T.en` and `T.zh` first
  (comments heading, reply, post/send, composer placeholder, translate/translating,
  delete + confirm, deleted placeholder, empty state, comment-count). Reference via `t.*`.
- [ ] Tenant portal keeps the existing hardcoded-English convention; collect those literals
  into one English labels object so the shared component stays identity/locale-agnostic.
- [ ] Verify: grep the diff for hardcoded JSX strings on the landlord path; commit.

### Phase 4: Shared CommentThread component

- [ ] Build one `CommentThread` component that takes the request, its comments, the current
  viewer identity (author_type/author_id/author_name + landlord_id), `data`/`setData`, and a
  `labels` object. It owns: collapsed header w/ count, top-level + indented replies, top-level
  composer, inline reply composer, per-comment translate button, delete control on own comments.
- [ ] Behavior decisions baked in: replies attach only to top-level comments (one level);
  delete = hard-delete leaves, soft-delete (`deleted_at`, render `[deleted]`) parents with
  replies; translate writes `body_zh` back like the description translate button; optimistic
  `setData` updates.
- [ ] Landlord author_name = signed-in member email via `supabase.auth.getUser()`,
  `landlord_id = user.id`; tenant author_name = `tenantFullName`, `author_id = user.id`.
- [ ] Verify: `npm run build` clean; commit.

### Phase 5: Wire into both pages

- [ ] Render `CommentThread` inside the landlord `MaintenancePage` request card (pass t-derived
  labels) and the `TenantMaintenancePage` request card (pass English labels).
- [ ] Verify: `npm run build` + `npm run lint`; commit.

### Phase 6: Verification

- [ ] Full browser pass (golden path + edge cases): post top-level comment, post a reply,
  translate a comment, delete own leaf, soft-delete a parent-with-replies; confirm landlord
  sees tenant comments and the tenant portal sees landlord comments.
- [ ] Invoke `code-reviewer` per the post-task review gate; address blocking issues.
- [ ] Update CHANGELOG.md (Added: maintenance request comment threads) and any affected docs.

---

## Self-review (plan vs. spec)

- **Coverage:** table+RLS (P1), reads (P2), strings (P3), UI/translate/delete (P4), both
  portals (P5), verification + review + changelog (P6). All spec sections mapped.
- **Non-goals respected:** no edit, no notifications, no realtime, no deep nesting.
- **Open risk** (stale denormalized `author_name`) is accepted per spec.
