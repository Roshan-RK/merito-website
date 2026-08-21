"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import { useToast } from "@/app/admin/_components/Toast";

export default function InterviewResync({ interviewRowId }: { interviewRowId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function resync() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/interviews/${interviewRowId}/resync`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Resynced with vendor.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={resync} disabled={busy} loading={busy}>
      Resync from vendor
    </Button>
  );
}
