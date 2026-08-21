"use client";

import { useState } from "react";
import Button from "@/app/admin/_components/Button";
import { useToast } from "@/app/admin/_components/Toast";

const paneStyle = {
  fontSize: 11,
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
  maxHeight: 320,
  overflow: "auto",
  margin: 0,
  padding: 10,
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: 8,
  flex: 1,
  minWidth: 0,
};

export default function VendorCompare({ compareUrl }: { compareUrl: string }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ stored: unknown; live: unknown; liveStatus: string } | null>(null);

  async function load() {
    setOpen(true);
    if (result) return;
    setBusy(true);
    try {
      const response = await fetch(compareUrl);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        setOpen(false);
        return;
      }
      setResult(data);
    } catch {
      showToast("error", "Something went wrong — try again.");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => (open ? setOpen(false) : load())}
        className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
        style={{ fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        {open ? "Hide vendor comparison" : "Compare with vendor"}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {busy && (
            <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12 }}>
              Fetching live vendor report…
            </p>
          )}
          {result && (
            <>
              {result.liveStatus !== "READY" && (
                <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, marginBottom: 8 }}>
                  Vendor currently reports this as {result.liveStatus}.
                </p>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11, margin: "0 0 4px" }}>
                    Mirror (stored)
                  </p>
                  <pre className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={paneStyle}>
                    {JSON.stringify(result.stored, null, 2)}
                  </pre>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11, margin: "0 0 4px" }}>
                    Live (vendor, right now)
                  </p>
                  <pre className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={paneStyle}>
                    {result.live ? JSON.stringify(result.live, null, 2) : "—"}
                  </pre>
                </div>
              </div>
            </>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              load();
            }}
            disabled={busy}
            loading={busy}
            style={{ marginTop: 8 }}
          >
            Refresh
          </Button>
        </div>
      )}
    </div>
  );
}
