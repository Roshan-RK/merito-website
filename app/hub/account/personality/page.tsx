import { redirect } from "next/navigation";
import Link from "next/link";
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
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "48px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 820 }}>
        <Link
          href="/hub/account"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13, display: "inline-block", marginBottom: 16 }}
        >
          ← Back to dashboard
        </Link>
        <a
          href={`/api/hub/personality/export?role=${encodeURIComponent(roleTitle)}`}
          download
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13, display: "inline-block", marginBottom: 16, marginLeft: 16 }}
        >
          Download PDF
        </a>
        <PersonalityTestClient roleTitle={roleTitle} candidateName={candidateName} initialResult={initialResult} />
      </div>
    </main>
  );
}
