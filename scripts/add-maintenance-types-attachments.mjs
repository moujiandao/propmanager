/**
 * Prints the SQL needed to add maintenance types, attachments, and description_zh.
 * Run this output in your Supabase dashboard → SQL Editor.
 */
console.log(`\nRun the following SQL in Supabase dashboard → SQL Editor:\n`);
console.log(`-- Add type and Chinese description columns to maintenance_requests
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS description_zh TEXT;

-- Migrate status values (open → new, resolved → closed)
UPDATE maintenance_requests SET status = 'new' WHERE status = 'open';
UPDATE maintenance_requests SET status = 'closed' WHERE status = 'resolved';

-- Maintenance types per landlord
CREATE TABLE IF NOT EXISTS maintenance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlord_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (landlord_id, name)
);
ALTER TABLE maintenance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage types" ON maintenance_types
  FOR ALL USING (is_team_member(landlord_id));

-- Maintenance attachments
CREATE TABLE IF NOT EXISTS maintenance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES landlord_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE maintenance_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members manage attachments" ON maintenance_attachments
  FOR ALL USING (is_team_member(landlord_id));
`);
console.log(`\nDone. Both tables use the existing is_team_member() RLS helper.`);
