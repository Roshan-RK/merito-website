"use client";

import { useState } from "react";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import PriceOptionTiles from "./PriceOptionTiles";
import type { CandidateLevel } from "@/lib/razorpay/pricing";

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script."));
    document.body.appendChild(script);
  });
}

export default function ReportPaywallModal({
  leadId,
  roleTitle,
  level,
  bundleEligible,
  onClose,
  onUnlocked,
}: {
  leadId: string;
  roleTitle: string;
  level: CandidateLevel;
  bundleEligible: boolean;
  onClose: () => void;
  onUnlocked: (report: ResumeMatchReportReady, selection: "solo" | "bundle") => void;
}) {
  const [paying, setPaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async (selection: "solo" | "bundle") => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/unlock-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, product: selection === "bundle" ? "bundle" : "report" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaying(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      if (data.status === "pending") {
        setPaying(false);
        setPending(true);
        return;
      }
      if (data.status === "checkout") {
        try {
          await loadRazorpayCheckoutScript();
        } catch {
          setPaying(false);
          setError("Could not load the payment form — please try again.");
          return;
        }
        if (!window.Razorpay) {
          setPaying(false);
          setError("Could not load the payment form — please try again.");
          return;
        }
        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.amountPaise,
          currency: data.currency,
          name: data.name,
          description: data.description,
          order_id: data.orderId,
          prefill: data.prefill,
          handler: async (response) => {
            try {
              const verifyRes = await fetch("/api/hub/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                }),
              });
              const verifyData = await verifyRes.json();
              setPaying(false);
              if (!verifyRes.ok) {
                setError(verifyData.error || "Payment succeeded but verification failed — please contact support.");
                return;
              }
              if (verifyData.status === "pending") {
                setPending(true);
                return;
              }
              onUnlocked(verifyData.report, selection);
            } catch {
              setPaying(false);
              setError("Payment succeeded but verification failed — please refresh.");
            }
          },
          modal: {
            ondismiss: () => setPaying(false),
          },
        });
        rzp.open();
        return;
      }
      setPaying(false);
      onUnlocked(data.report, selection);
    } catch {
      setPaying(false);
      setError("Something went wrong — please try again.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 520, width: "100%", borderRadius: 24, padding: 28, position: "relative", maxHeight: "92vh", overflowY: "auto" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c" }}
        >
          ✕
        </button>

        <span
          className="bg-[#fdeced] text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
          style={{ fontSize: 11, borderRadius: 50, padding: "4px 12px", display: "inline-block", marginBottom: 12 }}
        >
          Detailed Report
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          See exactly why you scored what you scored
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          Your strengths, your gaps, and exactly how to fix your CV for {roleTitle}.
        </p>

        {pending ? (
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Report unlocked — your resume-match score is still processing. Refresh this page in a moment to see it.
          </p>
        ) : (
          <>
            <div className="bg-[#fdf8fb]" style={{ borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <span
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c] bg-white border border-[#dcdcdc]"
                style={{ fontSize: 9, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
              >
                Sample
              </span>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
                ✓ Strong product sense across 3 launches
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                ✓ 5+ years B2B SaaS experience
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                ░░░░░░░░░░░░░░░░░░░░ (unlock for full breakdown)
              </p>
            </div>

            <PriceOptionTiles
              soloProduct="report"
              soloLabel="Just the Report"
              level={level}
              bundleEligible={bundleEligible}
              submitting={paying}
              onContinue={handlePay}
            />
          </>
        )}

        {error && (
          <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
