"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TransactionStatus } from "@/lib/adminPayments";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

export default function PaymentActions({ orderId, status, amountPaise }: { orderId: string; status: TransactionStatus; amountPaise: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"refund" | "void" | null>(null);
  const [refundReason, setRefundReason] = useState<string | null>(null);
  const [confirmingVoid, setConfirmingVoid] = useState(false);

  function handleRefundClick() {
    const reason = window.prompt(`Refund ₹${(amountPaise / 100).toLocaleString("en-IN")} for this transaction? Enter a reason:`);
    if (!reason) return;
    setRefundReason(reason);
  }

  async function refund() {
    if (!refundReason) return;
    setBusy("refund");
    try {
      const response = await fetch(`/api/admin/payments/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Refunded.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
      setRefundReason(null);
    }
  }

  async function voidTransaction() {
    setConfirmingVoid(false);
    setBusy("void");
    try {
      const response = await fetch(`/api/admin/payments/${orderId}/void`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Voided.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {status === "success" && (
        <Button variant="secondary" onClick={handleRefundClick} disabled={busy !== null} loading={busy === "refund"}>
          Refund
        </Button>
      )}
      {status === "initiated" && (
        <Button variant="secondary" onClick={() => setConfirmingVoid(true)} disabled={busy !== null} loading={busy === "void"}>
          Void
        </Button>
      )}

      <ConfirmDialog
        open={refundReason !== null}
        title="Refund this transaction?"
        message={`Refunds ₹${(amountPaise / 100).toLocaleString("en-IN")}. Reason: "${refundReason}"`}
        confirmLabel="Refund"
        danger
        busy={busy === "refund"}
        onConfirm={refund}
        onCancel={() => setRefundReason(null)}
      />
      <ConfirmDialog
        open={confirmingVoid}
        title="Void this transaction?"
        message="Does not move any money — only marks the row as failed."
        confirmLabel="Void"
        busy={busy === "void"}
        onConfirm={voidTransaction}
        onCancel={() => setConfirmingVoid(false)}
      />
    </div>
  );
}
