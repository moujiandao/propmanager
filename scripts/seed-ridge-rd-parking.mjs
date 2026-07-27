/**
 * Seeds the 14 Ridge Rd parking spots with their layout types.
 *
 * Labels 1-7   -> "right side (diagonal)"
 * Labels 8-9   -> "back side (straight)"
 * Labels 10-14 -> "left side (straight)"
 *
 * Idempotent: reads existing spots for the property first and only inserts
 * labels that are missing, so re-running is a no-op rather than tripping the
 * unique (property_id, label) constraint. Spots that already exist with a
 * different type are reported, not silently overwritten.
 *
 * Prerequisite: scripts/add-parking-spot-type.sql must be run first.
 *
 * Run: node scripts/seed-ridge-rd-parking.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const PROPERTY_ADDRESS = "Ridge Rd";

const SPOTS = [
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ label: String(n), type: "right side (diagonal)" })),
  ...[8, 9].map((n) => ({ label: String(n), type: "back side (straight)" })),
  ...[10, 11, 12, 13, 14].map((n) => ({ label: String(n), type: "left side (straight)" })),
];

const __dir = dirname(fileURLToPath(import.meta.url));
const envVars = Object.fromEntries(
  readFileSync(resolve(__dir, "../.env.local"), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(envVars["NEXT_PUBLIC_SUPABASE_URL"], envVars["SUPABASE_SERVICE_ROLE_KEY"], {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Resolve the property by address rather than hardcoding a UUID, so the
//    script stays readable and survives a database reseed.
const { data: props, error: propErr } = await supabase
  .from("properties")
  .select("id, address, landlord_id")
  .eq("address", PROPERTY_ADDRESS);

if (propErr) { console.error(`Property lookup failed: ${propErr.message}`); process.exit(1); }
if (!props?.length) { console.error(`No property found with address "${PROPERTY_ADDRESS}".`); process.exit(1); }
if (props.length > 1) { console.error(`Ambiguous: ${props.length} properties named "${PROPERTY_ADDRESS}".`); process.exit(1); }

const { id: propertyId, landlord_id: landlordId } = props[0];
console.log(`Property: ${PROPERTY_ADDRESS} (${propertyId})\n`);

// 2. Existing spots on this property, so the insert only covers what's missing.
const { data: existing, error: exErr } = await supabase
  .from("parking_spots")
  .select("id, label, type")
  .eq("property_id", propertyId);

if (exErr) {
  console.error(`Existing-spot lookup failed: ${exErr.message}`);
  if (/column .*type.* does not exist/i.test(exErr.message)) {
    console.error("\nRun scripts/add-parking-spot-type.sql first — the type column is missing.");
  }
  process.exit(1);
}

const byLabel = new Map((existing || []).map((s) => [s.label, s]));

const toInsert = [];
for (const spot of SPOTS) {
  const found = byLabel.get(spot.label);
  if (!found) {
    toInsert.push({ landlord_id: landlordId, property_id: propertyId, label: spot.label, type: spot.type });
  } else if (found.type !== spot.type) {
    console.log(`  SKIP "${spot.label}" — already exists with type "${found.type || "(none)"}", wanted "${spot.type}"`);
  } else {
    console.log(`  ok   "${spot.label}" — already correct`);
  }
}

if (!toInsert.length) {
  console.log("\nNothing to insert; all 14 spots already present.");
  process.exit(0);
}

const { data: inserted, error: insErr } = await supabase
  .from("parking_spots")
  .insert(toInsert)
  .select("label, type");

if (insErr) { console.error(`\nInsert failed: ${insErr.message}`); process.exit(1); }

console.log(`\nInserted ${inserted.length} spots:`);
for (const s of inserted.sort((a, b) => Number(a.label) - Number(b.label))) {
  console.log(`  ${s.label.padStart(2)} -> ${s.type}`);
}
