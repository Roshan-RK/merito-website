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
  role: RefereeRole;
  organization: string | null;
  ratings: { category: string; value: number }[] | null;
  overall_feedback: string | null;
};

export const REFERENCE_CATEGORIES: { value: string; label: string }[] = [
  { value: "knowledge-application", label: "Knowledge application" },
  { value: "initiative", label: "Initiative" },
  { value: "teamwork", label: "Teamwork" },
  { value: "communication", label: "Communication" },
  { value: "discipline", label: "Discipline" },
  { value: "problem-solving", label: "Problem-solving" },
  { value: "leadership-skills", label: "Leadership skills" },
];

export type ReferenceReport = {
  overallScore: number;
  categoryScores: { category: string; label: string; value: number }[];
  referees: {
    name: string;
    role: RefereeRole;
    organization: string | null;
    overallFeedback: string | null;
  }[];
};

export function computeReferenceReport(referees: RefereeRow[]): ReferenceReport {
  const completed = referees.filter((r) => r.status === "completed" && r.ratings);

  const categoryScores = REFERENCE_CATEGORIES.map(({ value, label }) => {
    const values = completed
      .flatMap((r) => r.ratings ?? [])
      .filter((r) => r.category === value)
      .map((r) => r.value);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { category: value, label, value: Math.round(avg * 10) / 10 };
  });

  const scoredCategories = categoryScores.filter((c) => c.value > 0);
  const overallScore = scoredCategories.length
    ? Math.round((scoredCategories.reduce((a, c) => a + c.value, 0) / scoredCategories.length) * 10) / 10
    : 0;

  return {
    overallScore,
    categoryScores,
    referees: completed.map((r) => ({
      name: r.name,
      role: r.role,
      organization: r.organization,
      overallFeedback: r.overall_feedback,
    })),
  };
}

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
  checkStatus: "initiated" | "in_progress" | "completed" | "cancelled";
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
    .select("id, name, email, status, reminder_count, role, organization, ratings, overall_feedback")
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
    .select("id, name, email, status, reminder_count, reference_check_id, reference_checks!inner(user_id, status)")
    .eq("id", refereeId)
    .eq("reference_checks.user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  // Supabase's query-builder type inference defaults an embedded to-one relation to an
  // array shape when no generated Database types are supplied; at runtime a `referees ->
  // reference_checks` (many-to-one via reference_check_id) embed always resolves to a
  // single object, never an array. Cast to reflect the true runtime shape.
  const check = data.reference_checks as unknown as { status: RefereeForUser["checkStatus"] };

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    status: data.status,
    reminderCount: data.reminder_count,
    checkStatus: check.status,
  };
}

export async function recordRefereeFeedback(
  refereeId: string,
  input: { ratings: { category: string; value: number }[]; overallFeedback: string }
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: referee, error: refereeError } = await supabase
    .from("referees")
    .select("reference_check_id, status")
    .eq("id", refereeId)
    .single();

  if (refereeError || !referee) {
    throw new Error(`Referee not found: ${refereeError?.message}`);
  }
  if (referee.status !== "pending") {
    throw new Error("REFEREE_ALREADY_RESPONDED");
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

  const { data: referee, error: refereeError } = await supabase
    .from("referees")
    .select("status")
    .eq("id", refereeId)
    .single();

  if (refereeError || !referee) {
    throw new Error(`Referee not found: ${refereeError?.message}`);
  }
  if (referee.status !== "pending") {
    throw new Error("REFEREE_ALREADY_RESPONDED");
  }

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
    .select("id, name, email, reference_check_id, reference_checks!inner(status)")
    .eq("status", "pending")
    .lt("reminder_count", MAX_REMINDERS)
    .in("reference_checks.status", ["initiated", "in_progress"])
    .or(`last_reminded_at.lt.${cutoff},and(last_reminded_at.is.null,created_at.lt.${cutoff})`);

  if (error) {
    throw new Error(`Failed to load stale referees: ${error.message}`);
  }

  return data ?? [];
}

export async function getRefereeName(refereeId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("referees").select("name").eq("id", refereeId).maybeSingle();
  return data?.name ?? null;
}

export async function getReferenceCheckOwner(checkId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("reference_checks").select("user_id").eq("id", checkId).maybeSingle();
  return data?.user_id ?? null;
}
