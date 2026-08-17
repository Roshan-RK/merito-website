"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle = { fontSize: 12, padding: "5px 8px", border: "1px solid #dcdcdc", borderRadius: 6, width: "100%" } as const;
const textareaStyle = { ...inputStyle, minHeight: 120, fontFamily: "monospace" } as const;

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
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (!window.confirm("Save this email template? It goes live immediately.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/email-templates/${templateKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText, bodyHtml }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/email-templates/${templateKey}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText, bodyHtml }),
      });
      const data = await response.json();
      setMessage(response.ok ? "Test email sent to your inbox." : data.error || "Test send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
      <label style={{ fontSize: 11.5, color: "#4b4b4d" }}>
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ fontSize: 11.5, color: "#4b4b4d" }}>
        Text body
        <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} style={textareaStyle} />
      </label>
      <label style={{ fontSize: 11.5, color: "#4b4b4d" }}>
        HTML body
        <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} style={textareaStyle} />
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={busy}
          style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 11.5, padding: "5px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "…" : "Save"}
        </button>
        <button
          onClick={sendTest}
          disabled={busy}
          style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 11.5, padding: "5px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "…" : "Send test email to myself"}
        </button>
        {message && <span style={{ fontSize: 11.5, color: "#4b4b4d" }}>{message}</span>}
      </div>
    </div>
  );
}
