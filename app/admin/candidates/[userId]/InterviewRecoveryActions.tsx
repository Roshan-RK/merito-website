"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

type Action = "generate" | "reinvite";

const ACTION_COPY: Record<Action, { title: string; message: string; confirmLabel: string }> = {
  generate: {
    title: "Generate interview report?",
    message: "Requests a report generation from IntervueBox for this interview. Only do this if the interview is stuck with no report.",
    confirmLabel: "Generate report",
  },
  reinvite: {
    title: "Reinvite candidate?",
    message: "Resends the interview invitation email to the candidate.",
    confirmLabel: "Reinvite",
  },
};

export default function InterviewRecoveryActions({ interviewId, status }: { interviewId: string; status: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);

  async function run(action: Action) {
    setPendingAction(null);
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}/${action}`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", action === "generate" ? "Report generation requested." : `Reinvited (${data.invited} sent).`);
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  const activeAction = pendingAction ?? "generate";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12 }}>
        Status: {status}
      </span>
      <Button variant="danger" onClick={() => setPendingAction("generate")} disabled={busy !== null} loading={busy === "generate"}>
        Generate report
      </Button>
      <Button variant="secondary" onClick={() => setPendingAction("reinvite")} disabled={busy !== null} loading={busy === "reinvite"}>
        Reinvite candidate
      </Button>

      <ConfirmDialog
        open={pendingAction !== null}
        title={ACTION_COPY[activeAction].title}
        message={ACTION_COPY[activeAction].message}
        confirmLabel={ACTION_COPY[activeAction].confirmLabel}
        danger={activeAction === "generate"}
        busy={busy === activeAction}
        onConfirm={() => pendingAction && run(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
