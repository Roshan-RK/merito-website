"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRODUCTS = ["report", "personality", "references", "interview", "counselling", "bundle"] as const;
const LEVELS = ["entry", "mid", "senior"] as const;

export default function GrantForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [product, setProduct] = useState<(typeof PRODUCTS)[number]>("personality");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("entry");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!email || !reason) {
      setMessage("Email and reason are required.");
      return;
    }
    if (!window.confirm(`Grant free ${product} access (${level}) to ${email}?`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/payments/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, product, level, reason }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setEmail("");
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { fontSize: 12, padding: "5px 8px", border: "1px solid #dcdcdc", borderRadius: 6 } as const;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 24, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
      <input placeholder="Candidate email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, width: 200 }} />
      <select value={product} onChange={(e) => setProduct(e.target.value as (typeof PRODUCTS)[number])} style={inputStyle}>
        {PRODUCTS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select value={level} onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])} style={inputStyle}>
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, width: 180 }} />
      <button onClick={submit} disabled={busy} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 11.5, padding: "5px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
        {busy ? "…" : "Grant free access"}
      </button>
      {message && <span style={{ fontSize: 11.5, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}
