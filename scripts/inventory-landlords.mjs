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

const { data: landlords } = await supabase.from("landlord_profiles").select("id, name, email");
const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const authById = Object.fromEntries((list?.users || []).map(u => [u.id, u]));

const tables = ["properties", "tenant_profiles", "contracts", "payments", "maintenance_requests", "email_settings", "units", "documents"];

console.log("Landlords + auth + record counts\n");
for (const l of landlords) {
  const a = authById[l.id];
  console.log(`landlord_id=${l.id}`);
  console.log(`  name="${l.name}" profile_email=${l.email}`);
  console.log(`  auth.users: email=${a?.email || "MISSING"} created=${a?.created_at || "?"}`);
  for (const t of tables) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true }).eq("landlord_id", l.id);
    console.log(`  ${t}: ${count}`);
  }
  console.log("");
}
