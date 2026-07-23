import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { nameFromEmail, type Scores, type Validity } from "@/lib/personality";
import PersonalityReportPdf from "./PersonalityReportPdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  let roleTitle = url.searchParams.get("role");

  if (!roleTitle) {
    const { data: lead } = await supabase
      .from("fitment_leads")
      .select("role_title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    roleTitle = lead?.role_title ?? null;
  }

  if (!roleTitle) {
    return Response.json({ error: "No target role found." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("personality_tests")
    .select("scores, validity")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (!existing || !existing.scores || !existing.validity) {
    return Response.json({ error: "Personality test not completed yet." }, { status: 404 });
  }

  const candidateName = nameFromEmail(user.email ?? "");

  const buffer = await renderToBuffer(
    <PersonalityReportPdf
      candidateName={candidateName}
      roleTitle={roleTitle}
      scores={existing.scores as Scores}
      validity={existing.validity as Validity}
    />
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="personality-report.pdf"`,
    },
  });
}
