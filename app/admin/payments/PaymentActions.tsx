"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TransactionStatus } from "@/lib/adminPayments";

export default function PaymentActions({ orderId, status, amountPaise }: { orderId: string; status: TransactionStatus; amountPaise: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refund() {
    const reason = window.prompt(`Refund ₹${(amountPaise / 100).toLocaleString("en-IN")} for this transaction? Enter a reason:`);
    if (!reason) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/payments/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function voidTransaction() {
    if (!window.confirm("Void this stuck transaction? This does not move any money, it only marks the row as failed.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/payments/${orderId}/void`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = { background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 11.5, padding: "3px 8px", borderRadius: 6, cursor: busy ? "default" : "pointer" } as const;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {status === "success" && (
        <button onClick={refund} disabled={busy} style={buttonStyle}>
          {busy ? "…" : "Refund"}
        </button>
      )}
      {status === "initiated" && (
        <button onClick={voidTransaction} disabled={busy} style={buttonStyle}>
          {busy ? "…" : "Void"}
        </button>
      )}
      {message && <span style={{ fontSize: 11.5, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}
