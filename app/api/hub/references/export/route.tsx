import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
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

  const status = await getReferenceCheckStatus(user.id);
  if (!status || status.status !== "completed") {
    return Response.json({ error: "Reference check not completed yet." }, { status: 404 });
  }

  const url = new URL(request.url);
  const pageCookies = requestCookiesFor(request, url.hostname);

  const buffer = await renderPageToPdf(`${url.origin}/hub/account/references/print`, pageCookies, { singlePage: true });
  // ?inline=1 is used by ExportPreviewModal's <iframe> -- an "attachment"
  // disposition makes the browser try to download instead of rendering the
  // PDF in the frame, which is why the preview modal showed nothing.
  const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="reference-check-report.pdf"`,
    },
  });
}
