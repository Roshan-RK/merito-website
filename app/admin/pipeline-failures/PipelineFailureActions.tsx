"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

type Label = "retry" | "discard";

export default function PipelineFailureActions({ id, kind }: { id: string; kind: "interview_invite_after_payment" | "orphaned_ib_job" | "interview_invite_failed" }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<Label | null>(null);
  const [pending, setPending] = useState<{ action: "retry-interview" | "discard"; label: Label } | null>(null);

  async function run(action: "retry-interview" | "discard", label: Label) {
    setPending(null);
    setBusy(label);
    try {
      const response = await fetch(`/api/admin/pipeline-failures/${id}/${action}`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Done.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {kind === "interview_invite_after_payment" && (
        <Button variant="danger" onClick={() => setPending({ action: "retry-interview", label: "retry" })} disabled={busy !== null} loading={busy === "retry"}>
          Retry interview
        </Button>
      )}
      <Button variant="secondary" onClick={() => setPending({ action: "discard", label: "discard" })} disabled={busy !== null} loading={busy === "discard"}>
        Discard
      </Button>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.label === "retry" ? "Retry this pipeline failure?" : "Discard this pipeline failure?"}
        message={pending?.label === "retry" ? "Re-attempts the interview invite for this candidate." : "Marks this failure as resolved without retrying."}
        confirmLabel={pending?.label === "retry" ? "Retry" : "Discard"}
        danger={pending?.label === "retry"}
        busy={busy === pending?.label}
        onConfirm={() => pending && run(pending.action, pending.label)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
