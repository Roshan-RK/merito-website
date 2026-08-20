import { listUnresolvedPipelineFailures } from "@/lib/pipelineFailures";
import PipelineFailureActions from "./PipelineFailureActions";
import EmptyState from "@/app/admin/_components/EmptyState";

const KIND_LABEL: Record<string, string> = {
  interview_invite_after_payment: "Payment consumed, no interview created",
  orphaned_ib_job: "Orphaned IntervueBox job",
  interview_invite_failed: "Interview invite failed, candidate can retry free",
};

export default async function AdminPipelineFailuresPage() {
  const failures = await listUnresolvedPipelineFailures();

  if (failures.length === 0) {
    return (
      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14 }}>
        <EmptyState message="None — good." tone="success" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {failures.map((f) => (
        <div key={f.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: "14px 16px" }}>
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, marginBottom: 6 }}>
            {KIND_LABEL[f.kind] ?? f.kind}
          </p>
          <pre className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12, whiteSpace: "pre-wrap", marginBottom: 10 }}>
            {JSON.stringify(f.detail, null, 2)}
          </pre>
          <PipelineFailureActions id={f.id} kind={f.kind} />
        </div>
      ))}
    </div>
  );
}
