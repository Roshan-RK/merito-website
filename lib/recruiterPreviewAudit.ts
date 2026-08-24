import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type AuditAction = 'sections_updated' | 'role_enabled' | 'role_disabled';

export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  leadId: string,
  action: AuditAction
): Promise<void> {
  const { error } = await supabase.from('recruiter_preview_audit').insert({
    user_id: userId,
    lead_id: leadId,
    action,
    timestamp: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}
