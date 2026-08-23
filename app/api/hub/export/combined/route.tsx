import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import { renderPageToPdf, requestCookiesFor } from "@/lib/pdf/renderPageToPdf";
import { leadIdOrRoleTitleFilter } from "@/lib/postgrestIdentityFilter";

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

  // Gated on fitment OR interview: the fitment block below needs `current`
  // for its own unlock/status check, and the fitment_interviews query
  // further down needs `current.id` for its lead_id identity-match .or()
  // clause -- that's the only reason this runs for "interview" requests
  // too. Requests for personality or references alone never read
  // `current`, so this fetch is skipped for them.
  let current = null;
  if (include.has("fitment") || include.has("interview")) {
    const { data: leads } = await supabase
      .from("fitment_leads")
      .select("id, role_title, resume_match_status, resume_match_raw")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    current = leads?.[0] ?? null;
  }

  if (include.has("fitment") && current) {
    const unlocked = await isReportUnlocked(user.id, current.role_title);
    if (unlocked && current.resume_match_status === "READY" && current.resume_match_raw) {
      anyReady = true;
    }
  }

  if (include.has("personality")) {
    const { data: existing } = await supabase
      .from("personality_tests")
      .select("scores, validity")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing?.scores && existing?.validity) {
      anyReady = true;
    }
  }

  // current is always the candidate's LATEST lead, but roleTitle is a
  // caller-supplied query param that can name a DIFFERENT, older role.
  // OR-ing current.id together with a roleTitle that belongs to a different
  // lead would match "interview linked to the LATEST lead OR interview
  // matching the REQUESTED role" -- two different leads' identities ORed
  // together -- and .order("updated_at").limit(1) could then return the
  // latest lead's interview instead of the requested role's. Only use the
  // lead_id half of the identity match when `current` actually IS the lead
  // being asked about; otherwise fall back to a plain role_title match.
  const identityLeadId = current && current.role_title === roleTitle ? current.id : null;

  if (include.has("interview")) {
    let query = supabase
      .from("fitment_interviews")
      .select("role_title, status, report_raw")
      .eq("user_id", user.id);
    if (roleTitle) {
      query = identityLeadId
        ? query.or(leadIdOrRoleTitleFilter(identityLeadId, roleTitle))
        : query.eq("role_title", roleTitle);
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

  // The dashboard's /hub/account/combined-report route is now the dark
  // summary panel, not the printable document -- the full report this PDF
  // needs to screenshot lives at its /print sibling instead.
  const targetUrl = new URL("/hub/account/combined-report/print", url.origin);
  targetUrl.searchParams.set("include", Array.from(include).join(","));
  if (roleTitle) targetUrl.searchParams.set("role", roleTitle);
  const interviewSections = url.searchParams.get("interviewSections");
  if (interviewSections) targetUrl.searchParams.set("interviewSections", interviewSections);

  let buffer: Buffer;
  try {
    buffer = await renderPageToPdf(targetUrl.toString(), pageCookies, { singlePage: true });
  } catch (err) {
    console.error("Combined report PDF render failed", {
      targetUrl: targetUrl.toString(),
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return Response.json({ error: "Could not generate the PDF. Please try again." }, { status: 502 });
  }

  // ?inline=1 is used by ExportPreviewModal's <iframe> -- an "attachment"
  // disposition makes the browser try to download instead of rendering the
  // PDF in the frame, which is why the preview modal would show nothing.
  const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="merito-report.pdf"`,
    },
  });
}
