/**
 * Prints the SQL needed to add `notes` and `security_deposit` to tenant_profiles.
 * Run this output in your Supabase dashboard → SQL Editor.
 */

console.log(`\nRun the following SQL in Supabase dashboard → SQL Editor:\n`);
console.log(`ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS notes TEXT;`);
console.log(`ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(12, 2);`);
console.log(`\nBoth columns are nullable. security_deposit uses NUMERIC(12,2) for currency precision.`);
