import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { renderPageToPdf, requestCookiesFor } from "@/lib/pdf/renderPageToPdf";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const roleTitle = url.searchParams.get("role");

  let query = supabase
    .from("fitment_interviews")
    .select("role_title, status, report_raw")
    .eq("user_id", user.id);

  if (roleTitle) {
    query = query.eq("role_title", roleTitle);
  }

  const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!interview) {
    return Response.json({ error: "No AI interview found." }, { status: 404 });
  }
  if (interview.status !== "ready" || !interview.report_raw) {
    return Response.json({ error: "Interview report not ready yet." }, { status: 404 });
  }

  const pageCookies = requestCookiesFor(request, url.hostname);

  const buffer = await renderPageToPdf(
    `${url.origin}/hub/account/interview/print?role=${encodeURIComponent(interview.role_title)}`,
    pageCookies,
    { singlePage: true }
  );

  // ?inline=1 is used by ExportPreviewModal's <iframe> -- an "attachment"
  // disposition forces a download prompt instead of rendering in the iframe.
  const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="interview-report.pdf"`,
    },
  });
}
