import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { nameFromEmail, type Scores, type Validity } from "@/lib/personality";
import PersonalityTestClient from "./PersonalityTestClient";

export default async function PersonalityTestPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { role } = await searchParams;
  let roleTitle = typeof role === "string" ? role : null;

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
    redirect("/hub/account");
  }

  const { data: existing } = await supabase
    .from("personality_tests")
    .select("scores, validity")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .maybeSingle();

  const initialResult =
    existing && existing.scores && existing.validity
      ? { scores: existing.scores as Scores, validity: existing.validity as Validity }
      : null;

  const candidateName = nameFromEmail(user.email ?? "");

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="print:hidden flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
          <Link
            href="/hub/account"
            className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white/55 hover:text-white transition-colors"
            style={{ gap: 6, fontSize: 13 }}
          >
            <ArrowLeft size={14} strokeWidth={2} /> Back to dashboard
          </Link>
          <a
            href={`/api/hub/personality/export?role=${encodeURIComponent(roleTitle)}`}
            download
            className="flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Download size={13} strokeWidth={2} /> Download PDF
          </a>
        </div>
        <PersonalityTestClient roleTitle={roleTitle} candidateName={candidateName} initialResult={initialResult} />
      </div>
    </main>
  );
}
