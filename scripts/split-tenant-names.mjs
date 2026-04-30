/**
 * Splits tenant names: moves the second word of `name` into `last_name`.
 * Run AFTER adding the last_name column in Supabase:
 *   ALTER TABLE tenant_profiles ADD COLUMN last_name TEXT;
 *
 * Run: node scripts/split-tenant-names.mjs
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

const { data: tenants, error } = await supabase.from("tenant_profiles").select("id, name, last_name");
if (error) { console.error("Error fetching tenants:", error.message); process.exit(1); }

let updated = 0, skipped = 0;

for (const t of tenants) {
  const parts = (t.name || "").trim().split(/\s+/);
  if (parts.length < 2) { skipped++; continue; }
  if (t.last_name) { console.log(`  [SKIP] ${t.name} — last_name already set: "${t.last_name}"`); skipped++; continue; }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  const { error: upErr } = await supabase.from("tenant_profiles")
    .update({ name: firstName, last_name: lastName })
    .eq("id", t.id);
  if (upErr) { console.error(`  [ERR] ${t.name}: ${upErr.message}`); skipped++; continue; }
  console.log(`  [OK] "${t.name}" → first: "${firstName}", last: "${lastName}"`);
  updated++;
}

console.log(`\n✓ Split ${updated} names, skipped ${skipped}.`);
