import { getSupabaseServerClient } from "@/lib/supabase";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_EVENTS_PER_WINDOW = 20;

export class RateLimitExceededError extends Error {
  constructor(actionKey: string) {
    super(`Too many "${actionKey}" actions in the last 10 minutes. Wait a moment and try again.`);
    this.name = "RateLimitExceededError";
  }
}

/** Throws RateLimitExceededError if the admin has hit the burst cap for this action in the last 10 minutes. */
export async function enforceAdminRateLimit(adminEmail: string, actionKey: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count, error: countError } = await supabase
    .from("admin_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("admin_email", adminEmail)
    .eq("action_key", actionKey)
    .gte("created_at", windowStart);

  if (countError) {
    throw new Error(`Failed to check rate limit: ${countError.message}`);
  }
  if ((count ?? 0) >= MAX_EVENTS_PER_WINDOW) {
    throw new RateLimitExceededError(actionKey);
  }

  const { error: insertError } = await supabase.from("admin_rate_limit_events").insert({ admin_email: adminEmail, action_key: actionKey });
  if (insertError) {
    throw new Error(`Failed to record rate limit event: ${insertError.message}`);
  }
}
