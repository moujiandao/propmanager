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

const { data: contracts } = await supabase
  .from("contracts")
  .select("id, property_id, unit, start_date, end_date, rent_amount, landlord_id");
const { data: links } = await supabase
  .from("contract_tenants")
  .select("contract_id, tenant_id");
const { data: tenants } = await supabase
  .from("tenant_profiles")
  .select("id, name, last_name");

const linksByContract = new Map();
for (const l of links) {
  if (!linksByContract.has(l.contract_id)) linksByContract.set(l.contract_id, []);
  linksByContract.get(l.contract_id).push(l.tenant_id);
}

const groups = new Map();
for (const c of contracts) {
  const k = `${c.property_id}|${c.unit}|${c.start_date}|${c.end_date}|${c.rent_amount}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(c);
}

console.log(`Total contracts: ${contracts.length}\n`);
console.log(`=== DUPLICATE LEASES (same property+unit+dates+rent) ===`);
let dupCount = 0;
for (const [key, group] of groups) {
  if (group.length > 1) {
    dupCount++;
    console.log(`\n  ${key}  (${group.length} duplicate rows):`);
    for (const c of group) {
      const tIds = linksByContract.get(c.id) || [];
      const tNames = tIds.map(tid => {
        const t = tenants.find(x => x.id === tid);
        return t ? `${t.name || ""} ${t.last_name || ""}`.trim() : tid;
      });
      console.log(`    contract ${c.id}  tenants: [${tNames.join(", ") || "(none)"}]`);
    }
  }
}
if (dupCount === 0) console.log("  none");

console.log(`\n=== UNIQUE LEASES vs contract rows ===`);
console.log(`  unique (property+unit+dates+rent): ${groups.size}`);
console.log(`  contract rows:                    ${contracts.length}`);
