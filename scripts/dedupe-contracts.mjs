/**
 * Consolidate duplicate contract rows that represent the same lease.
 *
 * A "duplicate group" = contracts sharing property_id + unit + start_date +
 * end_date + rent_amount. For each group with >1 row:
 *   1. Pick a keeper (lowest id alphabetically, deterministic).
 *   2. Reassign payments.contract_id from duplicates → keeper.
 *   3. Insert missing contract_tenants rows so the keeper has all tenants.
 *   4. Delete contract_tenants rows for the discarded contracts.
 *   5. Delete the discarded contract rows.
 *
 * The script also checks for divergent due_day / status across the group
 * and reports them — you must approve before --apply.
 *
 * Run: node scripts/dedupe-contracts.mjs            # dry run (default)
 *      node scripts/dedupe-contracts.mjs --apply    # write
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

const supabase = createClient(
  envVars["NEXT_PUBLIC_SUPABASE_URL"],
  envVars["SUPABASE_SERVICE_ROLE_KEY"],
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");

const [{ data: contracts }, { data: links }, { data: tenants }, { data: properties }, { data: payments }] = await Promise.all([
  supabase.from("contracts").select("id, property_id, unit, start_date, end_date, rent_amount, due_day, status, landlord_id"),
  supabase.from("contract_tenants").select("contract_id, tenant_id"),
  supabase.from("tenant_profiles").select("id, name, last_name"),
  supabase.from("properties").select("id, address"),
  supabase.from("payments").select("id, contract_id"),
]);

const tenantLabel = (id) => {
  const t = tenants.find(x => x.id === id);
  return t ? `${t.name || ""} ${t.last_name || ""}`.trim() : id;
};
const propLabel = (id) => properties.find(p => p.id === id)?.address || "(unknown)";

const linksByContract = new Map();
for (const l of links) {
  if (!linksByContract.has(l.contract_id)) linksByContract.set(l.contract_id, new Set());
  linksByContract.get(l.contract_id).add(l.tenant_id);
}

const paymentsByContract = new Map();
for (const p of payments) {
  if (!p.contract_id) continue;
  if (!paymentsByContract.has(p.contract_id)) paymentsByContract.set(p.contract_id, []);
  paymentsByContract.get(p.contract_id).push(p.id);
}

const groups = new Map();
for (const c of contracts) {
  const k = `${c.property_id}|${c.unit}|${c.start_date}|${c.end_date}|${c.rent_amount}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(c);
}

const dupGroups = [...groups.values()].filter(g => g.length > 1);

console.log(`\nContracts:            ${contracts.length}`);
console.log(`Unique leases:        ${groups.size}`);
console.log(`Duplicate groups:     ${dupGroups.length}`);
console.log(`Rows to remove:       ${dupGroups.reduce((s, g) => s + (g.length - 1), 0)}`);
console.log(`Mode:                 ${APPLY ? "APPLY (writing)" : "dry-run (use --apply to write)"}\n`);

const warnings = [];
const plans = [];

for (const group of dupGroups) {
  group.sort((a, b) => a.id.localeCompare(b.id));
  const keeper = group[0];
  const discards = group.slice(1);

  // Check divergent due_day or status — if they differ, warn the user
  const dueDays = new Set(group.map(c => c.due_day));
  const statuses = new Set(group.map(c => c.status));
  const landlords = new Set(group.map(c => c.landlord_id));
  if (dueDays.size > 1) warnings.push(`Group ${propLabel(keeper.property_id)} unit ${keeper.unit} ${keeper.start_date}: due_day differs ${[...dueDays].join("/")}`);
  if (statuses.size > 1) warnings.push(`Group ${propLabel(keeper.property_id)} unit ${keeper.unit} ${keeper.start_date}: status differs ${[...statuses].join("/")}`);
  if (landlords.size > 1) warnings.push(`Group ${propLabel(keeper.property_id)} unit ${keeper.unit} ${keeper.start_date}: landlord_id differs ${[...landlords].join("/")}`);

  const keeperTenants = linksByContract.get(keeper.id) || new Set();
  const allTenants = new Set(keeperTenants);
  for (const d of discards) {
    for (const tid of (linksByContract.get(d.id) || new Set())) allTenants.add(tid);
  }
  const newTenantsForKeeper = [...allTenants].filter(tid => !keeperTenants.has(tid));

  let paymentMoves = 0;
  for (const d of discards) paymentMoves += (paymentsByContract.get(d.id) || []).length;

  plans.push({ keeper, discards, newTenantsForKeeper, paymentMoves, allTenants: [...allTenants] });
}

console.log(`=== PLAN ===`);
for (const p of plans) {
  console.log(`\n  ${propLabel(p.keeper.property_id)} · Unit ${p.keeper.unit}  ${p.keeper.start_date} → ${p.keeper.end_date}  $${p.keeper.rent_amount}`);
  console.log(`    keep:    ${p.keeper.id}`);
  console.log(`    drop:    ${p.discards.map(d => d.id).join(", ")}`);
  console.log(`    tenants: ${p.allTenants.map(tenantLabel).join(", ")}`);
  if (p.newTenantsForKeeper.length > 0) {
    console.log(`    add to keeper: ${p.newTenantsForKeeper.map(tenantLabel).join(", ")}`);
  }
  if (p.paymentMoves > 0) {
    console.log(`    reassign ${p.paymentMoves} payment(s) from discarded contracts to keeper`);
  }
}

if (warnings.length > 0) {
  console.log(`\n=== WARNINGS — review before --apply ===`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (!APPLY) {
  console.log(`\nDry run complete. Re-run with --apply to consolidate.`);
  process.exit(0);
}

console.log(`\nApplying...`);
for (const p of plans) {
  // 1. Reassign payments
  if (p.paymentMoves > 0) {
    const dropIds = p.discards.map(d => d.id);
    const { error } = await supabase.from("payments").update({ contract_id: p.keeper.id }).in("contract_id", dropIds);
    if (error) { console.error(`Reassign payments failed:`, error.message); process.exit(1); }
  }

  // 2. Add missing tenant links to keeper
  if (p.newTenantsForKeeper.length > 0) {
    const rows = p.newTenantsForKeeper.map(tid => ({ contract_id: p.keeper.id, tenant_id: tid }));
    const { error } = await supabase.from("contract_tenants").insert(rows);
    if (error) { console.error(`Insert keeper links failed:`, error.message); process.exit(1); }
  }

  // 3. Delete contract_tenants for discards
  const dropIds = p.discards.map(d => d.id);
  {
    const { error } = await supabase.from("contract_tenants").delete().in("contract_id", dropIds);
    if (error) { console.error(`Delete dup links failed:`, error.message); process.exit(1); }
  }

  // 4. Delete discard contract rows
  {
    const { error } = await supabase.from("contracts").delete().in("id", dropIds);
    if (error) { console.error(`Delete dup contracts failed:`, error.message); process.exit(1); }
  }

  console.log(`  ✓ ${propLabel(p.keeper.property_id)} unit ${p.keeper.unit}: kept ${p.keeper.id}, removed ${p.discards.length} dup(s), tenants now ${p.allTenants.length}`);
}

console.log(`\n✓ Done. ${contracts.length - dupGroups.reduce((s, g) => s + (g.length - 1), 0)} contracts remain.`);
