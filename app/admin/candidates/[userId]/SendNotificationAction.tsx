"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HUB_NOTIFICATION_CATEGORIES, type HubNotificationCategory } from "@/lib/hubNotifications";
import Button from "@/app/admin/_components/Button";
import { useToast } from "@/app/admin/_components/Toast";

const CATEGORY_LABEL: Record<HubNotificationCategory, string> = {
  general: "General",
  report: "Fitment report",
  personality: "Personality test",
  interview: "Mock interview",
  references: "Reference checks",
  payment: "Payment",
  recruiter: "Recruiter preview",
};

export default function SendNotificationAction({ userId }: { userId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<HubNotificationCategory>("general");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/candidates/${userId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), category }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      setMessage("");
      setCategory("general");
      showToast("success", "Notification sent.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message to send to this candidate..."
        className="font-[family-name:var(--font-poppins)]"
        style={{ border: "1px solid #dcdcdc", borderRadius: 7, padding: "8px 12px", fontSize: 13, height: 70, resize: "vertical" }}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as HubNotificationCategory)}
        className="font-[family-name:var(--font-poppins)]"
        style={{ border: "1px solid #dcdcdc", borderRadius: 7, padding: "8px 10px", fontSize: 13, width: 180 }}
      >
        {HUB_NOTIFICATION_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      <div>
        <Button variant="danger" onClick={send} disabled={busy || !message.trim()} loading={busy}>
          Send notification
        </Button>
      </div>
    </div>
  );
}
