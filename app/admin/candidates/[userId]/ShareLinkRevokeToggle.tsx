"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ShareLinkRevokeToggle({ token, revoked }: { token: string; revoked: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/share-links/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoked: !revoked }),
      });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="font-[family-name:var(--font-poppins)] font-semibold"
      style={{
        background: "transparent",
        color: revoked ? "#16803c" : "#ed1a24",
        border: `1px solid ${revoked ? "#16803c" : "#ed1a24"}`,
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {saving ? "…" : revoked ? "Restore" : "Revoke"}
    </button>
  );
}
