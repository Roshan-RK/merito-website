import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import { renderPageToPdf, requestCookiesFor } from "@/lib/pdf/renderPageToPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const include = new Set((url.searchParams.get("include") ?? "").split(",").filter(Boolean));
  const roleTitle = url.searchParams.get("role");

  const pageCookies = requestCookiesFor(request, url.hostname);

  let anyReady = false;

  if (include.has("fitment")) {
    const { data: leads } = await supabase
      .from("fitment_leads")
      .select("id, role_title, resume_match_status, resume_match_raw")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const current = leads?.[0];
    if (current) {
      const unlocked = await isReportUnlocked(user.id, current.id);
      if (unlocked && current.resume_match_status === "READY" && current.resume_match_raw) {
        anyReady = true;
      }
    }
  }

  if (include.has("personality") && roleTitle) {
    const { data: existing } = await supabase
      .from("personality_tests")
      .select("scores, validity")
      .eq("user_id", user.id)
      .eq("role_title", roleTitle)
      .maybeSingle();
    if (existing?.scores && existing?.validity) {
      anyReady = true;
    }
  }

  if (include.has("interview")) {
    let query = supabase
      .from("fitment_interviews")
      .select("role_title, status, report_raw")
      .eq("user_id", user.id);
    if (roleTitle) {
      query = query.eq("role_title", roleTitle);
    }
    const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (interview && interview.status === "ready" && interview.report_raw) {
      anyReady = true;
    }
  }

  if (include.has("references")) {
    const status = await getReferenceCheckStatus(user.id);
    if (status?.status === "completed") {
      anyReady = true;
    }
  }

  if (!anyReady) {
    return Response.json({ error: "None of the requested reports are ready yet." }, { status: 404 });
  }

  const targetUrl = new URL("/hub/account/combined-report", url.origin);
  targetUrl.searchParams.set("include", Array.from(include).join(","));
  if (roleTitle) targetUrl.searchParams.set("role", roleTitle);

  const buffer = await renderPageToPdf(targetUrl.toString(), pageCookies);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="merito-report.pdf"`,
    },
  });
}
