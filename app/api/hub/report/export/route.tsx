import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
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

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, resume_match_status, resume_match_raw")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const current = leads?.[0];
  if (!current) {
    return Response.json({ error: "No fitment report found." }, { status: 404 });
  }

  const unlocked = await isReportUnlocked(user.id, current.role_title);
  if (!unlocked) {
    return Response.json({ error: "Report not unlocked." }, { status: 403 });
  }

  if (current.resume_match_status !== "READY" || !current.resume_match_raw) {
    return Response.json({ error: "Report not ready yet." }, { status: 404 });
  }

  const url = new URL(request.url);
  const pageCookies = requestCookiesFor(request, url.hostname);

  const buffer = await renderPageToPdf(`${url.origin}/hub/account/report/print`, pageCookies, { singlePage: true });
  // ?inline=1 is used by ExportPreviewModal's <iframe> -- an "attachment"
  // disposition makes the browser try to download instead of rendering the
  // PDF in the frame, which is why the preview modal showed nothing.
  const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="fitment-report.pdf"`,
    },
  });
}
