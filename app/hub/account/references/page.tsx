import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import ReferencesClient from "./ReferencesClient";

export default async function ReferencesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const status = await getReferenceCheckStatus(user.id);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
      <div className="print:hidden">
        <Link
          href="/hub/account"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13, display: "inline-block", marginBottom: 16 }}
        >
          ← Back to dashboard
        </Link>
        {status?.status === "completed" && (
          <a
            href="/api/hub/references/export"
            download
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ fontSize: 13, display: "inline-block", marginBottom: 16, marginLeft: 16 }}
          >
            Download PDF
          </a>
        )}
      </div>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
        Reference checks
      </h1>
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "0 0 24px" }}>
        Invite people who&apos;ve worked with you to rate you across 7 categories. 3 completed references unlock this step.
      </p>
      <ReferencesClient initialStatus={status} />
    </main>
  );
}
