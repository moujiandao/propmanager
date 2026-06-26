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
