import { getSupabaseServerClient } from "@/lib/supabase";

// Keep in sync with the check constraint in
// supabase/migrations/0038_hub_notifications_category.sql.
export const HUB_NOTIFICATION_CATEGORIES = [
  "general",
  "report",
  "personality",
  "interview",
  "references",
  "payment",
  "recruiter",
] as const;

export type HubNotificationCategory = (typeof HUB_NOTIFICATION_CATEGORIES)[number];

export type HubNotification = {
  id: string;
  message: string;
  category: HubNotificationCategory;
  createdAt: string;
  readAt: string | null;
};

type HubNotificationRow = {
  id: string;
  message: string;
  category: string;
  created_at: string;
  read_at: string | null;
};

function mapRow(row: HubNotificationRow): HubNotification {
  return {
    id: row.id,
    message: row.message,
    category: row.category as HubNotificationCategory,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function getUnreadNotifications(userId: string): Promise<HubNotification[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("hub_notifications")
    .select("id, message, category, created_at, read_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load unread notifications: ${error.message}`);
  }
  return (data ?? []).map(mapRow);
}

export async function getAllNotifications(userId: string, limit = 20): Promise<HubNotification[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("hub_notifications")
    .select("id, message, category, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load notifications: ${error.message}`);
  }
  return (data ?? []).map(mapRow);
}

// Scoped by user_id so a candidate can never mark someone else's row read --
// service-role client bypasses RLS, so this filter is the only thing
// enforcing that, same as every other candidate-scoped lib function in
// this codebase (see lib/referenceChecks.ts).
export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("hub_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to mark notification read: ${error.message}`);
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("hub_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw new Error(`Failed to mark notifications read: ${error.message}`);
  }
}
