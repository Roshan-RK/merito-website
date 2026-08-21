"use client";

import { useCallback, useEffect, useState } from "react";
import { HUB_NOTIFICATION_CATEGORIES, type HubNotificationCategory } from "@/lib/hubNotifications";
import { FUNNEL_STAGE_LABEL, type FunnelStage } from "@/lib/adminCandidates";
import Button from "@/app/admin/_components/Button";
import { useToast } from "@/app/admin/_components/Toast";

const ALL_STAGES = Object.keys(FUNNEL_STAGE_LABEL) as FunnelStage[];

const CATEGORY_LABEL: Record<HubNotificationCategory, string> = {
  general: "General",
  report: "Fitment report",
  personality: "Personality test",
  interview: "Mock interview",
  references: "Reference checks",
  payment: "Payment",
  recruiter: "Recruiter preview",
};

export default function BroadcastNotificationPage() {
  const { showToast } = useToast();
  const [stages, setStages] = useState<Set<FunnelStage>>(new Set());
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<HubNotificationCategory>("general");
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const fetchPreview = useCallback(async (nextStages: Set<FunnelStage>, nextRoles: Set<string>) => {
    setCounting(true);
    const params = new URLSearchParams();
    nextStages.forEach((s) => params.append("funnelStage", s));
    nextRoles.forEach((r) => params.append("roleTitle", r));
    try {
      const response = await fetch(`/api/admin/notifications/broadcast/preview?${params.toString()}`);
      const data = await response.json();
      setCount(typeof data.count === "number" ? data.count : 0);
      if (Array.isArray(data.roleTitleOptions)) setRoleOptions(data.roleTitleOptions);
    } catch {
      setCount(null);
    } finally {
      setCounting(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview(stages, roles);
    }, 300);
    return () => clearTimeout(timer);
  }, [stages, roles, fetchPreview]);

  function toggleStage(stage: FunnelStage) {
    setStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  function toggleRole(role: string) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  async function send() {
    if (!message.trim() || !count) return;
    setSending(true);
    try {
      const response = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelStages: Array.from(stages),
          roleTitles: Array.from(roles),
          message: message.trim(),
          category,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", `Sent to ${data.sent} candidate${data.sent === 1 ? "" : "s"}${data.failed ? ` (${data.failed} failed)` : ""}.`);
      setMessage("");
      setCategory("general");
      setStages(new Set());
      setRoles(new Set());
      fetchPreview(new Set(), new Set());
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold" style={{ fontSize: 20, margin: 0 }}>
        Broadcast notification
      </p>

      <div>
        <p className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 13, margin: "0 0 8px" }}>
          Funnel stage (none selected = all)
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ALL_STAGES.map((stage) => (
            <label key={stage} className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={stages.has(stage)} onChange={() => toggleStage(stage)} />
              {FUNNEL_STAGE_LABEL[stage]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 13, margin: "0 0 8px" }}>
          Role (none selected = all)
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
          {roleOptions.map((role) => (
            <label key={role} className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={roles.has(role)} onChange={() => toggleRole(role)} />
              {role}
            </label>
          ))}
          {roleOptions.length === 0 && (
            <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, color: "#9c9c9c", margin: 0 }}>
              No roles yet.
            </p>
          )}
        </div>
      </div>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as HubNotificationCategory)}
        className="font-[family-name:var(--font-poppins)]"
        style={{ border: "1px solid #dcdcdc", borderRadius: 7, padding: "8px 10px", fontSize: 13, width: 200 }}
      >
        {HUB_NOTIFICATION_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message to broadcast..."
        maxLength={2000}
        className="font-[family-name:var(--font-poppins)]"
        style={{ border: "1px solid #dcdcdc", borderRadius: 7, padding: "8px 12px", fontSize: 13, height: 100, resize: "vertical" }}
      />

      <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, color: "#9c9c9c", margin: 0 }}>
        {counting ? "Counting…" : count === null ? "" : `${count} candidate${count === 1 ? "" : "s"} match${count === 1 ? "es" : ""}.`}
      </p>

      {!confirming ? (
        <div>
          <Button variant="primary" onClick={() => setConfirming(true)} disabled={!message.trim() || !count}>
            Send broadcast
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <p className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 13, margin: 0 }}>
            Send to {count} candidate{count === 1 ? "" : "s"}?
          </p>
          <Button variant="primary" onClick={send} loading={sending}>
            Confirm send
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={sending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
