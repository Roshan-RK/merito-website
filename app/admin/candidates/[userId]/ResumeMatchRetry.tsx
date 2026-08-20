"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import { useToast } from "@/app/admin/_components/Toast";

export default function ResumeMatchRetry({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/retry-resume-match`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Retry requested.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <Button variant="danger" onClick={retry} disabled={busy} loading={busy}>
        Retry
      </Button>
    </div>
  );
}
