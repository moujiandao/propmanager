/**
 * Imports tenants from data/tenants-upload.csv into Supabase.
 *
 * Run from the project root:
 *   node scripts/import-tenants.mjs
 *
 * Reads credentials from .env.local automatically.
 * Requires: node 18+, @supabase/supabase-js already installed.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Load .env.local ──────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = envVars["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(content) {
  const [headerLine, ...rows] = content.trim().split("\n");
  const headers = headerLine.split(",").map(h => h.trim());
  return rows
    .filter(r => r.trim())
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r.split(",")[i] || "").trim()])));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = resolve(__dir, "../data/tenants-upload.csv");
  const rows = parseCSV(readFileSync(csvPath, "utf8"));
  console.log(`Found ${rows.length} rows in CSV.\n`);

  // Fetch the landlord (first landlord_profiles row)
  const { data: landlords, error: llErr } = await supabase.from("landlord_profiles").select("id").limit(1);
  if (llErr || !landlords?.length) { console.error("Could not fetch landlord:", llErr?.message); process.exit(1); }
  const landlordId = landlords[0].id;
  console.log(`Landlord ID: ${landlordId}`);

  // Fetch all units so we can match unit_number → unit id + property id
  const { data: units, error: uErr } = await supabase.from("units").select("id, unit_number, property_id");
  if (uErr) { console.error("Could not fetch units:", uErr.message); process.exit(1); }
  console.log(`Loaded ${units.length} units from DB.\n`);

  const unitByNumber = Object.fromEntries(units.map(u => [String(u.unit_number), u]));

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) { console.warn("  Skipping row with no name"); skipped++; continue; }

    const unitRecord = unitByNumber[row.unit_number];
    if (!unitRecord) {
      console.warn(`  [SKIP] "${name}" — unit "${row.unit_number}" not found in DB`);
      skipped++;
      continue;
    }

    // Use real email if provided; otherwise generate a placeholder for both auth + profile
    const realEmail = row.email?.trim() || null;
    const authEmail = realEmail || `${name.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@placeholder.local`;

    // Create auth user (required — tenant_profiles.id is a FK to auth.users)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      user_metadata: { role: "tenant", name },
    });

    if (authErr) {
      console.error(`  [ERROR] "${name}" — auth user creation failed: ${authErr.message}`);
      skipped++;
      continue;
    }

    const userId = authData.user.id;

    // Insert tenant profile with all available fields
    const profile = {
      id: userId,
      landlord_id: landlordId,
      name,
      email: realEmail || authEmail,
      phone: row.phone?.trim() || null,
      property_id: unitRecord.property_id,
      unit: row.unit_number,
      unit_id: unitRecord.id,
      zelle_name: row.zelle_name?.trim() || null,
      monthly_rent: row.monthly_rent ? parseFloat(row.monthly_rent) : null,
      move_in_date: row.move_in_date?.trim() || null,
      move_out_date: row.move_out_date?.trim() || null,
      student_status: row.student_status?.trim() || null,
      student_year: row.student_year?.trim() || null,
      has_cosigner: row.has_cosigner?.trim().toLowerCase() === "true",
      home_address: row.home_address?.trim() || null,
      age: row.age ? parseInt(row.age) : null,
      status: "active",
    };

    const { error: profileErr } = await supabase.from("tenant_profiles").insert(profile);

    if (profileErr) {
      console.error(`  [ERROR] "${name}" — profile insert failed: ${profileErr.message}`);
      // Clean up the auth user we just created
      await supabase.auth.admin.deleteUser(userId);
      skipped++;
      continue;
    }

    console.log(`  [OK] "${name}" → unit ${row.unit_number} (${userId.slice(0, 8)}...)`);
    created++;
  }

  // Recompute occupancy for all units after import
  console.log("\nRecomputing unit occupancy...");
  const { data: allTenants } = await supabase.from("tenant_profiles").select("unit_id").not("unit_id", "is", null);
  const occupiedUnitIds = new Set((allTenants || []).map(t => t.unit_id));
  for (const unit of units) {
    const newStatus = occupiedUnitIds.has(unit.id) ? "occupied" : "vacant";
    await supabase.from("units").update({ status: newStatus }).eq("id", unit.id);
  }

  console.log(`\n✓ Done. Created: ${created}, Skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
