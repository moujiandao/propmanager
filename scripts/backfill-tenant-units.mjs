/**
 * Diagnoses tenant_profiles.unit_id state, then backfills any rows where
 * unit_id is NULL but the `unit` text column matches a units.unit_number
 * within the tenant's property. Also recomputes units.status.
 *
 * Run from project root: node scripts/backfill-tenant-units.mjs
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

const { data: tenants } = await supabase.from("tenant_profiles").select("id, name, unit, unit_id, property_id, status");
const { data: units } = await supabase.from("units").select("id, unit_number, property_id, status");

console.log(`Tenants: ${tenants.length}, Units: ${units.length}\n`);

// Diagnostic
const missing = tenants.filter(t => !t.unit_id);
console.log(`Tenants with NO unit_id: ${missing.length}`);
console.log(`Tenants WITH unit_id:    ${tenants.length - missing.length}\n`);

// Build lookup: (property_id, unit_number) → unit
const unitsByPropAndNumber = new Map();
for (const u of units) {
  unitsByPropAndNumber.set(`${u.property_id}::${String(u.unit_number)}`, u);
}

// Backfill
let fixed = 0, skipped = 0;
for (const t of missing) {
  if (!t.unit || !t.property_id) { skipped++; continue; }
  const key = `${t.property_id}::${String(t.unit).trim()}`;
  const match = unitsByPropAndNumber.get(key);
  if (!match) {
    console.log(`  [SKIP] ${t.name} — unit "${t.unit}" not found in property ${t.property_id.slice(0,8)}`);
    skipped++;
    continue;
  }
  const { error } = await supabase.from("tenant_profiles").update({ unit_id: match.id }).eq("id", t.id);
  if (error) { console.log(`  [ERR] ${t.name}: ${error.message}`); skipped++; continue; }
  console.log(`  [FIX] ${t.name} → unit ${t.unit} (${match.id.slice(0,8)})`);
  fixed++;
}

// Recompute occupancy
const { data: refreshed } = await supabase.from("tenant_profiles").select("unit_id, status").not("unit_id", "is", null);
const occupiedIds = new Set(refreshed.filter(t => t.status === "current tenant").map(t => t.unit_id));
let occChanged = 0;
for (const u of units) {
  const newStatus = occupiedIds.has(u.id) ? "occupied" : "vacant";
  if (newStatus !== u.status) {
    await supabase.from("units").update({ status: newStatus }).eq("id", u.id);
    occChanged++;
  }
}

console.log(`\n✓ Backfilled ${fixed} tenant unit_ids, skipped ${skipped}, updated occupancy on ${occChanged} units.`);
