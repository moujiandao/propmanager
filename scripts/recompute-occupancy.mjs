/**
 * 1. Resyncs the legacy tenant_profiles.status column to the value DERIVED from each
 *    tenant's move-in/move-out dates (lib/tenant/status.js). Nothing in the app reads
 *    that column anymore, but keeping it truthful means SQL-console queries and the
 *    other ops scripts aren't looking at stale or legacy ("active"/"inactive") values.
 * 2. Recomputes units.status: "occupied" iff at least one tenant on the unit derives
 *    as a current tenant today; otherwise "vacant".
 *
 * Run: node scripts/recompute-occupancy.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { statusForRow, isCurrentRow } from "../lib/tenant/status.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const envVars = Object.fromEntries(
  readFileSync(resolve(__dir, "../.env.local"), "utf8")
    .split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(envVars["NEXT_PUBLIC_SUPABASE_URL"], envVars["SUPABASE_SERVICE_ROLE_KEY"], {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: tenants } = await supabase
  .from("tenant_profiles")
  .select("id, unit_id, status, name, move_in_date, move_out_date");
const { data: units } = await supabase.from("units").select("id, unit_number, status");

// 1. Resync the legacy status column where it disagrees with the derived value.
let resynced = 0;
for (const t of tenants) {
  const derived = statusForRow(t);
  if (t.status !== derived) {
    await supabase.from("tenant_profiles").update({ status: derived }).eq("id", t.id);
    console.log(`  ${t.name || t.id}: ${t.status || "(null)"} → ${derived}`);
    resynced++;
  }
}
console.log(`Resynced legacy status column on ${resynced}/${tenants.length} tenants.\n`);

// 2. Recompute occupancy from derived status.
const occupiedIds = new Set(tenants.filter(t => t.unit_id && isCurrentRow(t)).map(t => t.unit_id));

let changed = 0;
for (const u of units) {
  const newStatus = occupiedIds.has(u.id) ? "occupied" : "vacant";
  if (newStatus !== u.status) {
    await supabase.from("units").update({ status: newStatus }).eq("id", u.id);
    console.log(`  Unit ${u.unit_number}: ${u.status} → ${newStatus}`);
    changed++;
  }
}

console.log(`\n✓ Updated ${changed} units. ${occupiedIds.size}/${units.length} occupied (have ≥1 current tenant).`);
