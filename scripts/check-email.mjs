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

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/check-email.mjs <email>");
  process.exit(1);
}
const lower = email.toLowerCase();

const supabase = createClient(
  envVars["NEXT_PUBLIC_SUPABASE_URL"],
  envVars["SUPABASE_SERVICE_ROLE_KEY"],
  { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log(`Checking ${email}\n`);

const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const authUser = list?.users?.find(u => u.email?.toLowerCase() === lower);
if (!authUser) {
  console.log("auth.users: NOT FOUND");
} else {
  console.log(`auth.users: id=${authUser.id} created=${authUser.created_at}`);
}

const { data: tenants } = await supabase
  .from("tenant_profiles")
  .select("id, name, last_name, email, status, landlord_id, property_id, unit")
  .or(`email.eq.${email},email.eq.${lower}`);
if (!tenants?.length) {
  console.log("tenant_profiles by email: NONE");
} else {
  for (const t of tenants) {
    console.log(`tenant_profiles by email: id=${t.id} name="${t.name} ${t.last_name || ""}" status=${t.status} landlord=${t.landlord_id} property=${t.property_id} unit=${t.unit}`);
  }
}

if (authUser) {
  const { data: byId } = await supabase
    .from("tenant_profiles")
    .select("id, name, last_name, email, status, landlord_id, property_id, unit")
    .eq("id", authUser.id);
  if (!byId?.length) {
    console.log("tenant_profiles by auth_id: NONE");
  } else {
    for (const t of byId) {
      console.log(`tenant_profiles by auth_id: name="${t.name} ${t.last_name || ""}" status=${t.status} landlord=${t.landlord_id} email=${t.email}`);
    }
  }

  const { data: landlordHit } = await supabase
    .from("landlord_profiles")
    .select("id, name, email")
    .eq("id", authUser.id);
  if (!landlordHit?.length) {
    console.log("landlord_profiles by auth_id: NONE");
  } else {
    for (const l of landlordHit) {
      console.log(`landlord_profiles by auth_id: name="${l.name}" email=${l.email}`);
    }
  }
}

const { data: landlords } = await supabase
  .from("landlord_profiles")
  .select("id, name")
  .limit(100);
const landlordById = Object.fromEntries((landlords || []).map(l => [l.id, l.name]));
console.log(`\nLandlord lookup (${landlords?.length || 0} loaded):`);
for (const l of landlords || []) console.log(`  ${l.id} → ${l.name}`);
