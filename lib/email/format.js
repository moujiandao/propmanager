// Formatting helpers moved to the canonical lib/format module (shared by the UI
// monolith, renewals, and this email module). Re-exported here so the email
// module's existing `./format.js` imports keep working unchanged.
export { fmt, fmtDate, daysBetween } from "../format/index.js";
