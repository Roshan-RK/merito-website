"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error";
type ToastMessage = { id: number; variant: ToastVariant; text: string };
type ToastContextValue = { showToast: (variant: ToastVariant, text: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { background: string; color: string }> = {
  success: { background: "#16803c", color: "#fff" },
  error: { background: "#ed1a24", color: "#fff" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((variant: ToastVariant, text: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, variant, text }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 10, zIndex: 200 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="font-[family-name:var(--font-poppins)] font-semibold"
            style={{ ...VARIANT_STYLE[t.variant], fontSize: 13, padding: "10px 16px", borderRadius: 8, boxShadow: "0 8px 22px rgba(17,35,89,0.16)" }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
