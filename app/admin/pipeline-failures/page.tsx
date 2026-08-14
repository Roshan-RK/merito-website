import { requireAdmin } from "@/lib/adminAuth";
import { listUnresolvedPipelineFailures } from "@/lib/pipelineFailures";
import PipelineFailureActions from "./PipelineFailureActions";

const KIND_LABEL: Record<string, string> = {
  interview_invite_after_payment: "Payment consumed, no interview created",
  orphaned_ib_job: "Orphaned IntervueBox job",
};

export default async function AdminPipelineFailuresPage() {
  await requireAdmin();
  const failures = await listUnresolvedPipelineFailures();

  return (
    <div style={{ padding: 24 }}>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 22, marginBottom: 16 }}>
        Pipeline Failures
      </h2>
      {failures.length === 0 ? (
        <p style={{ fontSize: 14, color: "#9c9c9c" }}>None — good.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {failures.map((f) => (
            <div key={f.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{KIND_LABEL[f.kind] ?? f.kind}</p>
              <pre style={{ fontSize: 12, color: "#4b4b4d", whiteSpace: "pre-wrap", marginBottom: 10 }}>
                {JSON.stringify(f.detail, null, 2)}
              </pre>
              <PipelineFailureActions id={f.id} kind={f.kind} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
