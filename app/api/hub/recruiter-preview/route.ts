import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { ReportType } from "@/app/hub/account/reportSections";

export const runtime = "nodejs";

const VALID_SECTIONS: ReportType[] = ["fitment", "personality", "interview", "references"];

export async function GET(_request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data } = await supabase
    .from("recruiter_preview_settings")
    .select("enabled, sections")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({
    enabled: data?.enabled ?? false,
    sections: data?.sections ?? [],
  });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { enabled?: unknown; sections?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  if (
    !Array.isArray(body.sections) ||
    body.sections.some((s) => typeof s !== "string" || !VALID_SECTIONS.includes(s as ReportType))
  ) {
    return Response.json(
      { error: "sections must only contain fitment, personality, interview, or references." },
      { status: 400 }
    );
  }

  const admin = getSupabaseServerClient();
  const { error: upsertError } = await admin.from("recruiter_preview_settings").upsert(
    {
      user_id: user.id,
      enabled: body.enabled,
      sections: body.sections,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    console.error("recruiter_preview_settings upsert failed", { user_id: user.id, error: upsertError });
    return Response.json(
      { error: "Something went wrong saving your preview settings — please try again." },
      { status: 500 }
    );
  }

  return Response.json({ enabled: body.enabled, sections: body.sections });
}
