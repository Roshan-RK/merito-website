CREATE TABLE recruiter_preview_sections (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES fitment_leads(id) ON DELETE CASCADE,
  sections text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lead_id)
);

ALTER TABLE recruiter_preview_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sections" ON recruiter_preview_sections
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_recruiter_preview_sections_user_id ON recruiter_preview_sections(user_id);
