/**
 * Prints the SQL needed to add contract_id and drive_link to the documents table.
 * Run this output in your Supabase dashboard → SQL Editor.
 */

console.log(`\nRun the following SQL in Supabase dashboard → SQL Editor:\n`);
console.log(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;`);
console.log(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS drive_link TEXT;`);
console.log(`ALTER TABLE documents ALTER COLUMN file_path DROP NOT NULL;`);
console.log(`ALTER TABLE documents ALTER COLUMN file_type DROP NOT NULL;`);
console.log(`\nThe DROP NOT NULL changes are needed for Drive-only documents (no uploaded file).`);
