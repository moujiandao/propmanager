/**
 * Upserts tenants from data/tenants-upload.csv into Supabase.
 *   - Existing tenant (matched by unit + first name, or by email): UPDATE non-blank fields only
 *   - New tenant: create auth user + profile
 *   - Blank CSV cells are skipped — they never clear existing DB values
 *
 * Run from project root:
 *   node scripts/upsert-tenants.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { isCurrentRow } from "../lib/tenant/status.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

function parseCSV(content) {
  const [headerLine, ...rows] = content.trim().split("\n");
  const headers = headerLine.split(",").map(h => h.trim());
  return rows
    .filter(r => r.trim())
    .map(r => {
      const cols = r.split(",");
      return Object.fromEntries(headers.map((h, i) => [h, (cols[i] || "").trim()]));
    });
}

// Converts "M/D/YY" or "M/D/YYYY" → "YYYY-MM-DD". Returns null if blank/invalid.
function parseDate(val) {
  if (!val?.trim()) return null;
  const parts = val.trim().split("/");
  if (parts.length !== 3) return null;
  let [m, d, y] = parts.map(Number);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  if (y < 100) y += 2000;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const notBlank = v => v !== undefined && v !== null && String(v).trim() !== "";

// Build the patch object — only include fields that have a value in the CSV row.
function buildPatch(row) {
  const patch = {};
  if (notBlank(row.last_name))     patch.last_name     = row.last_name.trim();
  if (notBlank(row.email))         patch.email         = row.email.trim();
  if (notBlank(row.phone))         patch.phone         = row.phone.trim();
  if (notBlank(row.status))        patch.status        = row.status.trim().toLowerCase();
  if (notBlank(row.zelle_name))    patch.zelle_name    = row.zelle_name.trim();
  if (notBlank(row.monthly_rent))  patch.monthly_rent  = parseFloat(row.monthly_rent);
  if (notBlank(row.student_status))patch.student_status= row.student_status.trim();
  if (notBlank(row.student_year))  patch.student_year  = row.student_year.trim();
  if (notBlank(row.home_address))  patch.home_address  = row.home_address.trim();
  if (notBlank(row.age))           patch.age           = parseInt(row.age);
  if (notBlank(row.has_cosigner))  patch.has_cosigner  = row.has_cosigner.trim().toLowerCase() === "true";
  const moveIn  = parseDate(row.move_in_date);
  const moveOut = parseDate(row.move_out_date);
  if (moveIn)  patch.move_in_date  = moveIn;
  if (moveOut) patch.move_out_date = moveOut;
  return patch;
}

async function findExisting(firstName, email, unitId) {
  // 1. Try unit + first name (case-insensitive)
  const { data: byName } = await supabase
    .from("tenant_profiles")
    .select("id, name, email")
    .eq("unit_id", unitId)
    .ilike("name", firstName)
    .maybeSingle();
  if (byName) return byName;

  // 2. Fall back to email match (catches renamed first names)
  if (notBlank(email)) {
    const { data: byEmail } = await supabase
      .from("tenant_profiles")
      .select("id, name, email")
      .eq("email", email.trim())
      .maybeSingle();
    if (byEmail) return byEmail;
  }

  return null;
}

async function main() {
  const rows = parseCSV(readFileSync(resolve(__dir, "../data/tenants-upload.csv"), "utf8"));
  console.log(`Loaded ${rows.length} rows.\n`);

  const { data: landlords } = await supabase.from("landlord_profiles").select("id").limit(1);
  if (!landlords?.length) { console.error("No landlord found"); process.exit(1); }
  const landlordId = landlords[0].id;

  const { data: units } = await supabase.from("units").select("id, unit_number, property_id");
  const unitByNumber = Object.fromEntries(units.map(u => [String(u.unit_number), u]));

  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    const firstName = row.name?.trim();
    const lastName  = row.last_name?.trim() || "";
    const label     = `"${firstName}${lastName ? " " + lastName : ""}" unit ${row.unit_number}`;

    if (!firstName) { console.warn("  [SKIP] Row with no name"); skipped++; continue; }

    const unitRecord = unitByNumber[String(row.unit_number)];
    if (!unitRecord) { console.warn(`  [SKIP] ${label} — unit not found in DB`); skipped++; continue; }

    const patch = buildPatch(row);
    const existing = await findExisting(firstName, row.email, unitRecord.id);

    if (existing) {
      // ── UPDATE ───────────────────────────────────────────────────────────────
      if (Object.keys(patch).length === 0) {
        console.log(`  [SKIP] ${label} — no new data`);
        skipped++;
        continue;
      }
      const { error } = await supabase.from("tenant_profiles").update(patch).eq("id", existing.id);
      if (error) { console.error(`  [ERROR] ${label} update: ${error.message}`); skipped++; }
      else        { console.log(`  [UPDATED] ${label}`); updated++; }

    } else {
      // ── CREATE ───────────────────────────────────────────────────────────────
      const realEmail = notBlank(row.email) ? row.email.trim() : null;
      const authEmail = realEmail || `${firstName.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@placeholder.local`;

      const createPayload = { email: authEmail, email_confirm: true, user_metadata: { role: "tenant", name: firstName } };
      if (notBlank(row.password)) createPayload.password = row.password.trim();

      let userId;
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser(createPayload);

      if (authErr) {
        // Email already exists in auth — look up the existing auth user
        if (authErr.message?.toLowerCase().includes("already") || authErr.message?.toLowerCase().includes("exist")) {
          const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const existingAuth = userList?.users?.find(u => u.email === authEmail);
          if (existingAuth) {
            userId = existingAuth.id;
            console.log(`  [AUTH EXISTS] ${label} — reusing auth user`);
          } else {
            console.error(`  [ERROR] ${label} — auth: ${authErr.message}`);
            skipped++; continue;
          }
        } else {
          console.error(`  [ERROR] ${label} — auth: ${authErr.message}`);
          skipped++; continue;
        }
      } else {
        userId = authData.user.id;
      }

      const profile = {
        id: userId,
        landlord_id: landlordId,
        name: firstName,
        email: authEmail,
        property_id: unitRecord.property_id,
        unit: String(row.unit_number),
        unit_id: unitRecord.id,
        ...patch,
      };

      const { error: profileErr } = await supabase.from("tenant_profiles").insert(profile);
      if (profileErr) {
        // Profile already exists for this auth user — update instead
        if (profileErr.code === "23505" || profileErr.message?.includes("duplicate") || profileErr.message?.includes("already exists")) {
          const { error: upErr } = await supabase.from("tenant_profiles").update(patch).eq("id", userId);
          if (upErr) { console.error(`  [ERROR] ${label} profile update: ${upErr.message}`); skipped++; }
          else        { console.log(`  [UPDATED] ${label} (profile existed)`); updated++; }
        } else {
          console.error(`  [ERROR] ${label} profile insert: ${profileErr.message}`);
          await supabase.auth.admin.deleteUser(userId).catch(() => {});
          skipped++;
        }
      } else {
        console.log(`  [CREATED] ${label}`);
        created++;
      }
    }
  }

  // ── Recompute unit occupancy ─────────────────────────────────────────────────
  console.log("\nRecomputing unit occupancy...");
  // Status is derived from the dates, so it can't be filtered in SQL — pull the dates
  // back and apply isCurrentRow here. See lib/tenant/status.js.
  const { data: activeTenants } = await supabase
    .from("tenant_profiles")
    .select("unit_id, move_in_date, move_out_date")
    .not("unit_id", "is", null);
  const occupiedIds = new Set((activeTenants || []).filter(t => isCurrentRow(t)).map(t => t.unit_id));
  for (const u of units) {
    await supabase.from("units").update({ status: occupiedIds.has(u.id) ? "occupied" : "vacant" }).eq("id", u.id);
  }

  console.log(`\n✓ Done.  Created: ${created}  Updated: ${updated}  Skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
