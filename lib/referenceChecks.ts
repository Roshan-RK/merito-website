import { getSupabaseServerClient } from "@/lib/supabase";

export const MIN_REFERENCES = 3;
export const MAX_REFEREES = 10;
export const MAX_REMINDERS = 3;
export const REMINDER_INTERVAL_DAYS = 3;

export type RefereeRole =
  | "faculty"
  | "classmate"
  | "internship-colleague"
  | "internship-manager"
  | "manager"
  | "team-lead"
  | "teammate"
  | "client"
  | "other";

export type RefereeInput = {
  name: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  organization?: string;
  experienceLevel?: "fresher" | "experienced";
  role: RefereeRole;
  customRole?: string;
};

export type RefereeRow = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "completed" | "rejected";
  reminder_count: number;
};

export type ReferenceCheckStatusResult = {
  checkId: string;
  status: "initiated" | "in_progress" | "completed" | "cancelled";
  minReferences: number;
  referees: RefereeRow[];
};

export type RefereeForUser = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "completed" | "rejected";
  reminderCount: number;
};

export async function initiateReferenceCheck(userId: string): Promise<{ id: string }> {
  const supabase = getSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("reference_checks")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["initiated", "in_progress"])
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check for an existing reference check: ${existingError.message}`);
  }
  if (existing) {
    throw new Error("ALREADY_ACTIVE");
  }

  const { data, error } = await supabase
    .from("reference_checks")
    .insert({ user_id: userId, min_references: MIN_REFERENCES })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to initiate reference check: ${error?.message}`);
  }

  return { id: data.id };
}

export async function getActiveReferenceCheckId(userId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reference_checks")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["initiated", "in_progress"])
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up active reference check: ${error.message}`);
  }
  return data?.id ?? null;
}

export async function addReferee(checkId: string, input: RefereeInput): Promise<{ id: string }> {
  const supabase = getSupabaseServerClient();

  const { count, error: countError } = await supabase
    .from("referees")
    .select("id", { count: "exact", head: true })
    .eq("reference_check_id", checkId);

  if (countError) {
    throw new Error(`Failed to count referees: ${countError.message}`);
  }
  if ((count ?? 0) >= MAX_REFEREES) {
    throw new Error("MAX_REFEREES_REACHED");
  }

  const { data, error } = await supabase
    .from("referees")
    .insert({
      reference_check_id: checkId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      linkedin_url: input.linkedinUrl ?? null,
      organization: input.organization ?? null,
      experience_level: input.experienceLevel ?? null,
      role: input.role,
      custom_role: input.customRole ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to add referee: ${error?.message}`);
  }

  await supabase.from("reference_checks").update({ status: "in_progress" }).eq("id", checkId).eq("status", "initiated");

  return { id: data.id };
}

export async function getReferenceCheckStatus(userId: string): Promise<ReferenceCheckStatusResult | null> {
  const supabase = getSupabaseServerClient();

  const { data: check, error: checkError } = await supabase
    .from("reference_checks")
    .select("id, status, min_references")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to load reference check: ${checkError.message}`);
  }
  if (!check) return null;

  const { data: referees, error: refereesError } = await supabase
    .from("referees")
    .select("id, name, email, status, reminder_count")
    .eq("reference_check_id", check.id)
    .order("created_at", { ascending: true });

  if (refereesError) {
    throw new Error(`Failed to load referees: ${refereesError.message}`);
  }

  return {
    checkId: check.id,
    status: check.status,
    minReferences: check.min_references,
    referees: (referees ?? []) as RefereeRow[],
  };
}

export async function getRefereeForUser(userId: string, refereeId: string): Promise<RefereeForUser | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("referees")
    .select("id, name, email, status, reminder_count, reference_check_id, reference_checks!inner(user_id)")
    .eq("id", refereeId)
    .eq("reference_checks.user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    status: data.status,
    reminderCount: data.reminder_count,
  };
}

export async function recordRefereeFeedback(
  refereeId: string,
  input: { ratings: { category: string; value: number }[]; overallFeedback: string }
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: referee, error: refereeError } = await supabase
    .from("referees")
    .select("reference_check_id")
    .eq("id", refereeId)
    .single();

  if (refereeError || !referee) {
    throw new Error(`Referee not found: ${refereeError?.message}`);
  }

  const { error } = await supabase
    .from("referees")
    .update({
      ratings: input.ratings,
      overall_feedback: input.overallFeedback,
      status: "completed",
      feedback_opened_at: new Date().toISOString(),
    })
    .eq("id", refereeId);

  if (error) {
    throw new Error(`Failed to record referee feedback: ${error.message}`);
  }

  await maybeCompleteCheck(referee.reference_check_id);
}

export async function recordRefereeDecline(refereeId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("referees").update({ status: "rejected" }).eq("id", refereeId);

  if (error) {
    throw new Error(`Failed to record referee decline: ${error.message}`);
  }
}

async function maybeCompleteCheck(checkId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: check, error: checkError } = await supabase
    .from("reference_checks")
    .select("min_references, status")
    .eq("id", checkId)
    .single();

  if (checkError || !check || check.status === "completed") return;

  const { count, error: countError } = await supabase
    .from("referees")
    .select("id", { count: "exact", head: true })
    .eq("reference_check_id", checkId)
    .eq("status", "completed");

  if (countError) return;

  if ((count ?? 0) >= check.min_references) {
    await supabase
      .from("reference_checks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", checkId);
  }
}

export async function incrementReminderCount(refereeId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("referees").select("reminder_count").eq("id", refereeId).single();

  if (error || !data) {
    throw new Error(`Referee not found: ${error?.message}`);
  }

  const { error: updateError } = await supabase
    .from("referees")
    .update({ reminder_count: data.reminder_count + 1, last_reminded_at: new Date().toISOString() })
    .eq("id", refereeId);

  if (updateError) {
    throw new Error(`Failed to increment reminder count: ${updateError.message}`);
  }
}

export async function getCandidateDisplayName(userId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("fitment_leads")
    .select("name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.name?.trim() || "A Merito candidate";
}

export async function getStaleRefereesForReminder(): Promise<
  { id: string; name: string; email: string; reference_check_id: string }[]
> {
  const supabase = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("referees")
    .select("id, name, email, reference_check_id")
    .eq("status", "pending")
    .lt("reminder_count", MAX_REMINDERS)
    .or(`last_reminded_at.lt.${cutoff},and(last_reminded_at.is.null,created_at.lt.${cutoff})`);

  if (error) {
    throw new Error(`Failed to load stale referees: ${error.message}`);
  }

  return data ?? [];
}
