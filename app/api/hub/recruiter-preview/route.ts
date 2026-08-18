import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { LINKEDIN_URL_PATTERN, normalizeLinkedinUrl } from "@/lib/linkedinUrl";
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
    .select("enabled, sections, linkedin_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({
    enabled: data?.enabled ?? false,
    sections: data?.sections ?? [],
    linkedinUrl: data?.linkedin_url ?? null,
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

  let body: { enabled?: unknown; sections?: unknown; linkedinUrl?: unknown };
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

  let linkedinUrl: string | null = null;
  if (typeof body.linkedinUrl === "string" && body.linkedinUrl.trim().length > 0) {
    linkedinUrl = normalizeLinkedinUrl(body.linkedinUrl.trim());
    if (!LINKEDIN_URL_PATTERN.test(linkedinUrl)) {
      return Response.json(
        { error: "linkedinUrl must be a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/your-name)." },
        { status: 400 }
      );
    }
  }

  if (body.enabled && !linkedinUrl) {
    return Response.json(
      { error: "A LinkedIn profile URL is required before visibility can be turned on." },
      { status: 400 }
    );
  }

  const admin = getSupabaseServerClient();
  const { error: upsertError } = await admin.from("recruiter_preview_settings").upsert(
    {
      user_id: user.id,
      enabled: body.enabled,
      sections: body.sections,
      linkedin_url: linkedinUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    console.error("recruiter_preview_settings upsert failed", { user_id: user.id, error: upsertError });
    return Response.json(
      { error: "Something went wrong saving your preview settings. Please try again." },
      { status: 500 }
    );
  }

  return Response.json({ enabled: body.enabled, sections: body.sections, linkedinUrl });
}
