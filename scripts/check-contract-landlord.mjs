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

const { data: contracts } = await supabase.from("contracts").select("id, landlord_id, property_id, unit, start_date");
const { data: landlords } = await supabase.from("landlord_profiles").select("id, name, email");
const { data: properties } = await supabase.from("properties").select("id, landlord_id, address");

console.log(`Contracts: ${contracts.length}`);
const byLandlord = new Map();
for (const c of contracts) {
  const k = c.landlord_id || "(null)";
  byLandlord.set(k, (byLandlord.get(k) || 0) + 1);
}
console.log("\nContracts grouped by landlord_id:");
for (const [lid, count] of byLandlord) {
  const l = landlords.find(x => x.id === lid);
  console.log(`  ${lid}  →  ${count} contracts  ${l ? `(${l.name || l.email})` : "(unmatched)"}`);
}

console.log("\nLandlord profiles:");
for (const l of landlords) {
  console.log(`  ${l.id}  ${l.name || ""}  ${l.email || ""}`);
}

console.log("\nProperties (id, landlord_id, address):");
for (const p of properties) {
  console.log(`  ${p.id}  landlord=${p.landlord_id}  ${p.address}`);
}
