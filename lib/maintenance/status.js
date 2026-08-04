// The home for the maintenance Status vocabulary. Previously this knowledge was
// scattered: the board's column mapping lived inline in the monolith, the "open"
// filter (`status !== closed && !== resolved`) was copy-pasted in three places,
// and the create route accepted any string. Centralizing it here lets the board,
// the dashboard counts, and the server create route share one definition so they
// can't drift. React-free + isomorphic (client board + server route both import).
//
// See CONTEXT.md › Status. Stored values are unchanged by the board redesign.

// The statuses the UI writes. Legacy values `open`/`resolved` may still exist on
// old rows (read-only) — they are NOT written anymore but ARE mapped/handled.
export const WRITE_STATUSES = ["new", "in-progress", "closed"];

// The board columns (one per status the landlord triages).
export const COLUMNS = ["new", "in-progress", "closed"];

// Map any stored status (incl. legacy/unknown) to its board column.
// in-progress → In Progress; closed/resolved → Closed; everything else → New.
export const columnOf = (status) =>
  status === "in-progress" ? "in-progress"
  : (status === "closed" || status === "resolved") ? "closed"
  : "new";

// "Open" = still needs attention: anything not Closed/Resolved. Used by the board
// subtitle count and the landlord/tenant dashboard "open requests" counts.
export const isOpen = (status) => status !== "closed" && status !== "resolved";

// Is this status one of the closed ones? The complement of isOpen, named
// positively so the closed_at rule below reads as intent rather than negation.
export const isClosedStatus = (status) => !isOpen(status);

// The close-timestamp rule, in one place because both the board drag and the
// detail-modal dropdown write status and must agree.
//
//   moving INTO closed  -> keep an existing timestamp, otherwise stamp `now`
//   staying closed      -> unchanged (re-dropping on the Closed column must not
//                          rewrite the date the work actually finished)
//   moving OUT of closed-> null (a reopened ticket has no close date)
//
// Returns the value to persist in maintenance_requests.closed_at.
export const nextClosedAt = (status, existingClosedAt, now) =>
  isClosedStatus(status) ? (existingClosedAt || now) : null;

// Server-side guard: is this a status the client is allowed to write?
export const isWritableStatus = (status) => WRITE_STATUSES.includes(status);

// Normalize an incoming write status to a valid one, defaulting to "new".
export const normalizeWriteStatus = (status) => (isWritableStatus(status) ? status : "new");
