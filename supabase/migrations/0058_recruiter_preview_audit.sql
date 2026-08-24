CREATE TABLE recruiter_preview_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES fitment_leads(id) ON DELETE CASCADE,
  action text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE recruiter_preview_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit" ON recruiter_preview_audit
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_recruiter_preview_audit_user_id ON recruiter_preview_audit(user_id);
CREATE INDEX idx_recruiter_preview_audit_timestamp ON recruiter_preview_audit(timestamp);
