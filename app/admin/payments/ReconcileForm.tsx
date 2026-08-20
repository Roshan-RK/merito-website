"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

export default function ReconcileForm({ userId, leadId, product }: { userId: string; leadId: string | null; product: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function handleSubmitClick() {
    const amountPaise = Math.round(parseFloat(amount) * 100);
    if (!amountPaise || amountPaise <= 0) {
      showToast("error", "Enter a valid amount.");
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    setConfirming(false);
    const amountPaise = Math.round(parseFloat(amount) * 100);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, leadId, product, amountPaise }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Reconciled.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        placeholder="Amount (₹)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="font-[family-name:var(--font-poppins)]"
        style={{ fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7, width: 100 }}
      />
      <Button variant="secondary" onClick={handleSubmitClick} disabled={busy} loading={busy}>
        Reconcile
      </Button>

      <ConfirmDialog
        open={confirming}
        title="Record manual reconciliation?"
        message={`Records a manual reconciliation of ₹${amount} for this ${product} unlock.`}
        confirmLabel="Reconcile"
        busy={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
