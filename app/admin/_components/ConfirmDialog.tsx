"use client";

import { useEffect, useState } from "react";
import Button from "@/app/admin/_components/Button";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  confirmText,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /** When set, the confirm button stays disabled until the admin retypes this exact text. */
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  if (!open) return null;

  const locked = Boolean(confirmText) && typed !== confirmText;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onCancel}
    >
      <div className="bg-white" style={{ borderRadius: 14, padding: 24, maxWidth: 360, width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 17, margin: "0 0 8px" }}>
          {title}
        </h3>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: confirmText ? "0 0 12px" : "0 0 20px" }}>
          {message}
        </p>
        {confirmText && (
          <div style={{ margin: "0 0 20px" }}>
            <label className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ display: "block", fontSize: 12, margin: "0 0 6px" }}>
              Type <strong className="text-black">{confirmText}</strong> to confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="font-[family-name:var(--font-poppins)]"
              style={{ fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7, width: "100%", boxSizing: "border-box" }}
            />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy} disabled={locked}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
