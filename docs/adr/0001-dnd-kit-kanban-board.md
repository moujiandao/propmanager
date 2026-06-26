---
status: accepted
---

# Use @dnd-kit for the landlord To Do List kanban board

The landlord maintenance view is being reskinned as a Trello-style kanban board
("To Do List") where dragging a card between New / In Progress / Closed columns sets its
status. We added **@dnd-kit** for this rather than hand-rolling HTML5 drag events or
avoiding drag entirely. @dnd-kit gives accessible keyboard/touch dragging and an
activation-distance constraint that cleanly separates a click (open the card detail) from
a drag (move the card) — both fiddly to get right by hand.

This is the first runtime UI dependency added to an otherwise dependency-light,
inline-styled monolith (`property-management-app.jsx`), so it's worth recording why the
deviation was deliberate.

## Considered options

- **Status dropdown / move buttons (no library).** Reuses the existing `updateStatus`,
  zero dependency, but doesn't deliver the "similar to Trello" drag interaction that was
  the explicit goal.
- **Hand-rolled HTML5 drag-and-drop.** No dependency, but poor touch support and no
  accessibility, and the click-vs-drag disambiguation is exactly the part @dnd-kit solves.

## Consequences

- Drag-to-move reuses the existing optimistic `updateStatus` (local state first, then
  Supabase write) — no new persistence path. Stored status values are unchanged
  (`new` / `in-progress` / `closed`, plus legacy `resolved` shown under Closed).
- Scope is landlord-only; the tenant portal keeps its plain maintenance-request list.
