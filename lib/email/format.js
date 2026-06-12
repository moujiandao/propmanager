// Isomorphic formatting helpers shared by the UI (property-management-app.jsx)
// and the server (cron / test-send routes) so emails render dates and currency
// identically on both sides. Pure JS, no React or server-only deps.

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
// Positive when `target` is in the future relative to `from`. Used for {days_until}.
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
