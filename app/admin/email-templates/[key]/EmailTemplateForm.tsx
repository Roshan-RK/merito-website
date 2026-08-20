"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

const labelStyle = { fontSize: 11.5, color: "#4b4b4d" } as const;
const inputStyle = { fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7, width: "100%", marginTop: 4, boxSizing: "border-box" } as const;
const textareaStyle = { ...inputStyle, minHeight: 140, fontFamily: "monospace" } as const;

export default function EmailTemplateForm({
  templateKey,
  initialSubject,
  initialBodyText,
  initialBodyHtml,
}: {
  templateKey: string;
  initialSubject: string;
  initialBodyText: string;
  initialBodyHtml: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [confirmingSave, setConfirmingSave] = useState(false);

  async function save() {
    setConfirmingSave(false);
    setBusy("save");
    try {
      const response = await fetch(`/api/admin/email-templates/${templateKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText, bodyHtml }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Saved — live now.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      const response = await fetch(`/api/admin/email-templates/${templateKey}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText, bodyHtml }),
      });
      const data = await response.json().catch(() => null);
      showToast(response.ok ? "success" : "error", response.ok ? "Test email sent to your inbox." : data?.error || "Test send failed.");
    } catch {
      showToast("error", "Test send failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <label className="font-[family-name:var(--font-poppins)]" style={labelStyle}>
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
      </label>
      <label className="font-[family-name:var(--font-poppins)]" style={labelStyle}>
        Text body
        <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} style={textareaStyle} />
      </label>
      <label className="font-[family-name:var(--font-poppins)]" style={labelStyle}>
        HTML body
        <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} style={textareaStyle} />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Button variant="primary" onClick={() => setConfirmingSave(true)} disabled={busy !== null} loading={busy === "save"}>
          Save
        </Button>
        <Button variant="secondary" onClick={sendTest} disabled={busy !== null} loading={busy === "test"}>
          Send test email to myself
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingSave}
        title="Save this email template?"
        message="It goes live immediately for all future sends."
        confirmLabel="Save"
        busy={busy === "save"}
        onConfirm={save}
        onCancel={() => setConfirmingSave(false)}
      />
    </div>
  );
}
