/**
 * Prints the Email Automation schema SQL.
 * Run the output in your Supabase dashboard → SQL Editor (or apply scripts/email-automation.sql).
 */
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, "email-automation.sql"), "utf8");

console.log("\nRun the following SQL in Supabase dashboard → SQL Editor:\n");
console.log(sql);
console.log("\nDone. Creates email_templates, email_automations, email_messages (is_team_member RLS).");
