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

  const pageCookies = requestCookiesFor(request, url.hostname);

  let anyReady = false;

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, resume_match_status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const currentLead = leads?.[0];

  if (include.has("fitment") && currentLead) {
    const unlocked = await isReportUnlocked(user.id, currentLead.role_title);
    if (unlocked && currentLead.resume_match_status === "READY") {
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

  if (include.has("interview")) {
    let query = supabase.from("fitment_interviews").select("status").eq("user_id", user.id);
    if (currentLead) query = query.eq("role_title", currentLead.role_title);
    const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (interview && interview.status === "ready") {
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
    return Response.json({ error: "None of the requested sections are ready yet." }, { status: 404 });
  }

  const targetUrl = new URL("/hub/account/share-summary", url.origin);
  targetUrl.searchParams.set("include", Array.from(include).join(","));

  let buffer: Buffer;
  try {
    buffer = await renderPageToPdf(targetUrl.toString(), pageCookies);
  } catch (err) {
    console.error("LinkedIn share-summary PDF render failed", {
      targetUrl: targetUrl.toString(),
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return Response.json({ error: "Could not generate the PDF. Please try again." }, { status: 502 });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="merito-hub-linkedin-share.pdf"`,
    },
  });
}
