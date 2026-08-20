"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

const PRODUCTS = ["report", "personality", "references", "interview", "counselling", "bundle"] as const;
const LEVELS = ["entry", "mid", "senior"] as const;

const inputStyle = { fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7 } as const;

export default function GrantForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [product, setProduct] = useState<(typeof PRODUCTS)[number]>("personality");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("entry");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function handleSubmitClick() {
    if (!email || !reason) {
      showToast("error", "Email and reason are required.");
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    setConfirming(false);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/payments/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, product, level, reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      setEmail("");
      setReason("");
      showToast("success", "Access granted.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-black/[0.08]" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 24, padding: 16, borderRadius: 14 }}>
      <input placeholder="Candidate email" value={email} onChange={(e) => setEmail(e.target.value)} className="font-[family-name:var(--font-poppins)]" style={{ ...inputStyle, width: 220 }} />
      <select value={product} onChange={(e) => setProduct(e.target.value as (typeof PRODUCTS)[number])} className="font-[family-name:var(--font-poppins)]" style={inputStyle}>
        {PRODUCTS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select value={level} onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])} className="font-[family-name:var(--font-poppins)]" style={inputStyle}>
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="font-[family-name:var(--font-poppins)]" style={{ ...inputStyle, width: 200 }} />
      <Button variant="secondary" onClick={handleSubmitClick} disabled={busy} loading={busy}>
        Grant free access
      </Button>

      <ConfirmDialog
        open={confirming}
        title="Grant free access?"
        message={`Grants free ${product} access (${level}) to ${email}, with no payment record.`}
        confirmLabel="Grant"
        busy={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
