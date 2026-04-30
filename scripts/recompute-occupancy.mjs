/**
 * 1. Normalizes any legacy tenant statuses ("active" → "current tenant",
 *    "inactive" → "previous tenant") in the DB.
 * 2. Recomputes units.status: "occupied" iff at least one tenant on the
 *    unit has status = "current tenant"; otherwise "vacant".
 *
 * Run: node scripts/recompute-occupancy.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envVars = Object.fromEntries(
  readFileSync(resolve(__dir, "../.env.local"), "utf8")
    .split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(envVars["NEXT_PUBLIC_SUPABASE_URL"], envVars["SUPABASE_SERVICE_ROLE_KEY"], {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Normalize legacy statuses
const { data: legacyActive } = await supabase.from("tenant_profiles").update({ status: "current tenant" }).eq("status", "active").select("id");
const { data: legacyInactive } = await supabase.from("tenant_profiles").update({ status: "previous tenant" }).eq("status", "inactive").select("id");
console.log(`Normalized statuses → ${legacyActive?.length || 0} active→current, ${legacyInactive?.length || 0} inactive→previous`);

// 2. Recompute occupancy from current-tenant rows only
const { data: tenants } = await supabase.from("tenant_profiles").select("unit_id, status, name");
const { data: units } = await supabase.from("units").select("id, unit_number, status");

const occupiedIds = new Set(tenants.filter(t => t.unit_id && t.status === "current tenant").map(t => t.unit_id));

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
