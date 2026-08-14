"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReconcileForm({ userId, leadId, product }: { userId: string; leadId: string | null; product: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    const amountPaise = Math.round(parseFloat(amount) * 100);
    if (!amountPaise || amountPaise <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }
    if (!window.confirm(`Record a manual reconciliation of ₹${amount} for this ${product} unlock?`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, leadId, product, amountPaise }),
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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        placeholder="Amount (₹)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ fontSize: 12, padding: "3px 8px", border: "1px solid #dcdcdc", borderRadius: 6, width: 90 }}
      />
      <button onClick={submit} disabled={busy} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 11.5, padding: "3px 8px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
        {busy ? "…" : "Reconcile"}
      </button>
      {message && <span style={{ fontSize: 11.5, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}
