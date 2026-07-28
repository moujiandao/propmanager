# PropManager — Domain Glossary

A shared vocabulary for the domain. Glossary only — no implementation details.

## Terms

### To Do List
The landlord-facing name and board view for **maintenance requests**. A presentation
layer over the existing maintenance-request data — same records, same tenant-submission
flow. It is *not* a general-purpose task list: every item is still a tenant-linked
maintenance request (a tenant, property, and unit). The landlord works the queue as a
kanban board; the tenant continues to see "Maintenance Requests," not a to-do list.

Synonyms in code/UI: the underlying entity remains a **maintenance request**
(`maintenance_requests`). "To Do List" is the landlord nav label and page title only.

### Lease
The **residential** agreement between a landlord and one or more tenants for a unit
(`contracts`). Carries the property, unit, term dates, rent amount, and due day. Joins to
tenants **many-to-many** through `contract_tenants`, so housemates and co-signers share a
single lease. This is the "Leases" nav item.

Unqualified, "lease" always means this one. A parking lease is always said in full.

### Parking Lease
The agreement for a single **parking spot** (`parking_leases`). Carries the spot, a rate,
and its own start/end dates. Held by exactly one party — either a tenant or a
**market renter** — enforced by a CHECK constraint.

**A parking lease is a different record from a Lease, and there is no link between them.**
That is deliberate, not an oversight:

- A spot can be rented by a market renter who is not a tenant and has no residential lease
  to attach to.
- Parking terms run independently — month-to-month parking under a 12-month lease is
  normal, and a tenant can add or drop a spot mid-term.
- One tenant can hold two spots; one lease row could not express that.
- A Lease has several responsible parties; a parking spot has exactly one.

The rule of thumb: model two agreements as one record only when they always start, end,
and change together for the same parties. Parking fails all three.

Consequences worth knowing: a tenant's move-out does **not** end their parking lease (the
two have separate end dates and nothing syncs them), lease renewal does not carry parking
forward, and parking rent is not billed through `payments`. If those ever need to connect,
the shape is a nullable `parking_leases.contract_id` — null for a market renter or a
standalone rental, set when the spot is an addendum to that residential lease.

### Market Renter
Someone who leases a parking spot but is **not** a tenant (`parking_renters`). Deliberately
has no `auth.users` link, so nothing in the write path can give a market renter portal
access.

### Maintenance Request
A repair/issue record submitted (usually by a tenant) against a unit. Carries a tenant,
property, unit, priority, type, optional attachments, a free-form description, and a
**status**. The canonical entity — "To Do List" is just how the landlord views it.

### Status
The workflow state of a maintenance request. Stored values are unchanged by the board
redesign: `new`, `in-progress`, `closed` (plus legacy `resolved`). On the landlord board
these map to three columns labeled **New / In Progress / Closed**; legacy `resolved` rows
live alongside `closed` in the Closed column.

### Column (board)
A vertical lane on the landlord To Do List board, one per status the landlord triages:
New, In Progress, Closed. Dragging a card to another column sets its status.

### Card
A single maintenance request as shown on the board. Clicking a card opens its detail
(description, tenant/property/unit, priority, type, attachments, and the comment chain).

### Comment Thread
An existing threaded-comment chain attached to a maintenance request, shared by the
landlord and tenant views. Unchanged by the board redesign — it moves from inline under
each list row into the card's detail view.
