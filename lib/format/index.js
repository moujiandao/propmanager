// Canonical isomorphic formatting helpers — the one home for currency/date
// formatting shared by the UI monolith, renewal components, and the email
// module (server + client). Pure JS, no React or server-only deps.
//
// These were previously duplicated in three places; the date helper in
// particular carries a subtle timezone rule (below) that must not drift.

export const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (d) => {
  if (!d) return "—";
  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight by default, which renders as the previous day
  // in negative-offset timezones. Append T00:00:00 so the value is interpreted as local midnight.
  const iso = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Whole-day difference between two YYYY-MM-DD (or Date) values, normalized to local midnight.
// Positive when `target` is in the future relative to `from`.
export const daysBetween = (from, target) => {
  if (!from || !target) return null;
  const norm = (d) => {
    const iso = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d;
    const dt = new Date(iso);
    dt.setHours(0, 0, 0, 0);
    return dt;
  };
  const ms = norm(target).getTime() - norm(from).getTime();
  return Math.round(ms / 86400000);
};
