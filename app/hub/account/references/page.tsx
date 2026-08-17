import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus, MIN_REFERENCES, REFERENCE_CATEGORIES } from "@/lib/referenceChecks";
import ReferencesClient from "./ReferencesClient";
import ExportPreviewButton from "../ExportPreviewButton";

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
          {status?.status === "completed" && (
            <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <ExportPreviewButton
                exportUrl="/api/hub/references/export"
                downloadFilename="reference-check-report.pdf"
                title="Reference check — export preview"
              />
              <a
                href="/api/hub/references/export"
                download
                className="flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
                style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Download size={13} strokeWidth={2} /> Download PDF
              </a>
            </div>
          )}
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
            Reference checks
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: 0 }}>
            Invite people who&apos;ve worked with you to rate you across {REFERENCE_CATEGORIES.length} categories. {MIN_REFERENCES}{" "}
            completed references unlock this step.
          </p>
        </div>
        <ReferencesClient initialStatus={status} />
      </div>
    </main>
  );
}
