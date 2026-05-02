import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
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

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(__dir, `../data/snapshots/${stamp}`);
mkdirSync(outDir, { recursive: true });

const tables = [
  "landlord_profiles",
  "tenant_profiles",
  "properties",
  "contracts",
  "contract_tenants",
  "payments",
  "maintenance_requests",
  "email_settings",
  "documents",
  "units",
];

console.log(`Snapshotting → ${outDir}\n`);
for (const t of tables) {
  const { data, error } = await supabase.from(t).select("*");
  if (error) {
    console.log(`  ${t}: ERROR — ${error.message}`);
    continue;
  }
  const path = resolve(outDir, `${t}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  ${t}: ${data.length} rows → ${path}`);
}
console.log("\nDone.");
