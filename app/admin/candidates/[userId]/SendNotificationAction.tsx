"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SendNotificationAction({ userId }: { userId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/candidates/${userId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || "Something went wrong.");
        return;
      }
      setMessage("");
      setStatus("Notification sent.");
      router.refresh();
    } catch {
      setStatus("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message to send to this candidate..."
        className="font-[family-name:var(--font-poppins)]"
        style={{ border: "1px solid #dcdcdc", borderRadius: 8, padding: "8px 10px", fontSize: 13, height: 70, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={send}
          disabled={busy || !message.trim()}
          className="font-[family-name:var(--font-poppins)] font-semibold"
          style={{ background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "…" : "Send notification"}
        </button>
        {status && (
          <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, color: "#4b4b4d" }}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
