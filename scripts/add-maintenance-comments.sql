-- Threaded comments on maintenance requests
CREATE TABLE IF NOT EXISTS maintenance_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES maintenance_comments(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES landlord_profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  body_zh TEXT,
  author_type TEXT NOT NULL CHECK (author_type IN ('landlord', 'tenant')),
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maintenance_comments_request_idx
  ON maintenance_comments (maintenance_request_id, created_at);

ALTER TABLE maintenance_comments ENABLE ROW LEVEL SECURITY;

-- Read: landlord team members, or the tenant who owns the parent request.
CREATE POLICY "Read maintenance comments" ON maintenance_comments
  FOR SELECT USING (
    is_team_member(landlord_id)
    OR EXISTS (
      SELECT 1 FROM maintenance_requests r
      WHERE r.id = maintenance_request_id AND r.tenant_id = auth.uid()
    )
  );

-- Insert: a landlord team member posting as 'landlord', or the request's
-- tenant posting as 'tenant'. author_id must be the caller.
CREATE POLICY "Insert maintenance comments" ON maintenance_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      (author_type = 'landlord' AND is_team_member(landlord_id))
      OR (
        author_type = 'tenant'
        AND EXISTS (
          SELECT 1 FROM maintenance_requests r
          WHERE r.id = maintenance_request_id AND r.tenant_id = auth.uid()
        )
      )
    )
  );

-- Update: body_zh translation cache + soft-delete. Author or landlord team only.
CREATE POLICY "Update maintenance comments" ON maintenance_comments
  FOR UPDATE USING (
    author_id = auth.uid()
    OR is_team_member(landlord_id)
  );

-- Hard delete: only the comment's own author.
CREATE POLICY "Delete own maintenance comments" ON maintenance_comments
  FOR DELETE USING (author_id = auth.uid());
