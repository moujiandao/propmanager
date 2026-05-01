/**
 * Backfill missing contract_tenants links by matching contracts to tenants
 * via (property_id, unit, start_date == tenant.move_in_date).
 *
 * Reports three buckets:
 *   1. AUTO-LINKED  - contract has 0 existing links and exactly the set of
 *                     tenants whose (property, unit, move_in_date) match.
 *   2. ALREADY OK   - contract already has at least one contract_tenants row.
 *   3. AMBIGUOUS    - 0 matching tenants, OR move-in dates conflict with the
 *                     lease start_date even though tenants live at that unit.
 *                     These are NOT linked; user must resolve manually.
 *
 * Pass --apply to actually insert. Default is dry-run.
 *
 * Run: node scripts/backfill-contract-tenants.mjs            # dry run
 *      node scripts/backfill-contract-tenants.mjs --apply    # write
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

const norm = (v) => (v == null ? "" : String(v).trim());

const [{ data: contracts, error: cErr }, { data: tenants, error: tErr }, { data: links, error: lErr }, { data: properties }] = await Promise.all([
  supabase.from("contracts").select("id, property_id, unit, start_date, end_date, rent_amount"),
  supabase.from("tenant_profiles").select("id, name, last_name, property_id, unit, unit_id, move_in_date, move_out_date, status"),
  supabase.from("contract_tenants").select("contract_id, tenant_id"),
  supabase.from("properties").select("id, address"),
]);

if (cErr || tErr || lErr) {
  console.error("Fetch error:", cErr || tErr || lErr);
  process.exit(1);
}

const propAddr = (id) => properties.find(p => p.id === id)?.address || "(unknown property)";
const tenantLabel = (t) => `${t.name || ""}${t.last_name ? " " + t.last_name : ""}`.trim() || t.id;

const linksByContract = new Map();
for (const l of links) {
  if (!linksByContract.has(l.contract_id)) linksByContract.set(l.contract_id, []);
  linksByContract.get(l.contract_id).push(l.tenant_id);
}

const auto = [];
const already = [];
const ambiguous = [];

for (const c of contracts) {
  const existing = linksByContract.get(c.id) || [];
  if (existing.length > 0) {
    already.push(c);
    continue;
  }

  // Tenants who live (or will live) at this unit
  const tenantsAtUnit = tenants.filter(t =>
    norm(t.property_id) === norm(c.property_id) && norm(t.unit) === norm(c.unit)
  );

  if (tenantsAtUnit.length === 0) {
    ambiguous.push({ contract: c, reason: "no tenants at this unit", candidates: [] });
    continue;
  }

  // Exact-match: tenants whose move_in_date == contract.start_date
  const exact = tenantsAtUnit.filter(t => norm(t.move_in_date) === norm(c.start_date));

  if (exact.length > 0) {
    auto.push({ contract: c, tenants: exact });
    continue;
  }

  // No exact match — flag with all candidates so user can pick
  ambiguous.push({
    contract: c,
    reason: `no tenants whose move_in_date matches lease start (${c.start_date || "—"})`,
    candidates: tenantsAtUnit.map(t => ({
      id: t.id, name: tenantLabel(t), status: t.status,
      moveInDate: t.move_in_date, moveOutDate: t.move_out_date,
    })),
  });
}

console.log(`\n=== SUMMARY ===`);
console.log(`Contracts:           ${contracts.length}`);
console.log(`Already linked:      ${already.length}`);
console.log(`Auto-linkable:       ${auto.length}  ← will be linked`);
console.log(`Ambiguous (manual):  ${ambiguous.length}`);
console.log(`Mode:                ${APPLY ? "APPLY (writing)" : "dry-run (use --apply to write)"}\n`);

if (auto.length > 0) {
  console.log(`=== AUTO-LINK ===`);
  for (const { contract, tenants: ts } of auto) {
    console.log(`  ${propAddr(contract.property_id)} · Unit ${contract.unit}  start ${contract.start_date}`);
    for (const t of ts) console.log(`    → ${tenantLabel(t)} (${t.status}, move-in ${t.move_in_date})`);
  }
  console.log();
}

if (ambiguous.length > 0) {
  console.log(`=== AMBIGUOUS — needs your review ===`);
  for (const { contract, reason, candidates } of ambiguous) {
    console.log(`  ${propAddr(contract.property_id)} · Unit ${contract.unit}  ${contract.start_date} → ${contract.end_date || "—"}  rent $${contract.rent_amount}`);
    console.log(`    reason: ${reason}`);
    if (candidates.length > 0) {
      console.log(`    candidates at this unit:`);
      for (const c of candidates) {
        console.log(`      • ${c.name} (${c.status}, move-in ${c.moveInDate || "—"}, move-out ${c.moveOutDate || "—"})`);
      }
    }
  }
  console.log();
}

if (!APPLY) {
  console.log(`Dry run complete. Re-run with --apply to insert ${auto.length} contract_tenants rows.`);
  process.exit(0);
}

if (auto.length === 0) {
  console.log(`Nothing to insert.`);
  process.exit(0);
}

const rows = auto.flatMap(({ contract, tenants: ts }) =>
  ts.map(t => ({ contract_id: contract.id, tenant_id: t.id }))
);

const { error: insertErr } = await supabase.from("contract_tenants").insert(rows);
if (insertErr) {
  console.error("Insert failed:", insertErr.message);
  process.exit(1);
}

console.log(`✓ Inserted ${rows.length} contract_tenants rows across ${auto.length} contracts.`);
