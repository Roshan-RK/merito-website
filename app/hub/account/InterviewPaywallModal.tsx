"use client";

import { useState } from "react";
import type { InterviewStatus } from "./ProgressRail";
import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";

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

export default function InterviewPaywallModal({
  roleTitle,
  level,
  userEmail,
  alreadyInvited = false,
  onClose,
  onStarted,
}: {
  roleTitle: string;
  level: CandidateLevel;
  userEmail: string;
  // True when the row was already "invited" and the candidate is just
  // rechecking what's happening — skips straight to the confirmation view
  // instead of the payment screen (no new invite is sent).
  alreadyInvited?: boolean;
  onClose: () => void;
  onStarted: (status: InterviewStatus) => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the invite is actually sent — while set, the modal shows a
  // confirmation instead of closing immediately, so the candidate doesn't
  // lose track of the fact that the next step is checking their email, not
  // sitting on this page waiting.
  const [invitedStatus, setInvitedStatus] = useState<InterviewStatus | null>(alreadyInvited ? "invited" : null);

  const startInterview = async () => {
    const res = await fetch("/api/hub/start-ai-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleTitle }),
    });
    const data = await res.json();
    setPaying(false);
    if (!res.ok) {
      setError(data.error || "Payment succeeded but starting the interview failed — please contact support.");
      return;
    }
    setInvitedStatus(data.status as InterviewStatus);
  };

  // Once the invite is sent, dismissing the modal (✕ or backdrop click)
  // should still commit the new status to the dashboard — the interview
  // already happened server-side, this is just closing the confirmation.
  const handleDismiss = () => {
    if (invitedStatus) {
      onStarted(invitedStatus);
    } else {
      onClose();
    }
  };

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/razorpay/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "interview" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaying(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }

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
            if (!verifyRes.ok) {
              setPaying(false);
              setError(verifyData.error || "Payment succeeded but verification failed — please contact support.");
              return;
            }
            await startInterview();
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
    } catch {
      setPaying(false);
      setError("Something went wrong — please try again.");
    }
  };

  return (
    <div
      onClick={handleDismiss}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, position: "relative" }}
      >
        <button
          onClick={handleDismiss}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c" }}
        >
          ✕
        </button>

        {invitedStatus ? (
          <>
            <div
              className="bg-[#eefdf1]"
              style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}
            >
              <span style={{ color: "#16803c", fontSize: 20, fontWeight: 700 }}>✓</span>
            </div>
            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
              Check your email
            </h2>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
              We&apos;ve sent your AI interview invite for {roleTitle} to{" "}
              <strong className="text-black">{userEmail}</strong>. Open it whenever you&apos;re ready to start.
            </p>
            <button
              onClick={handleDismiss}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{ height: 50, borderRadius: 8, fontSize: 15, background: "#ed1a24", border: "none", cursor: "pointer", boxShadow: "0 4px 6px rgba(236,34,40,0.3)" }}
            >
              Got it
            </button>
          </>
        ) : (
          <>
            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
              Ready for a real AI interview?
            </h2>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
              We&apos;ll send you an email with a link to start your AI interview for {roleTitle}. Complete it whenever you&apos;re ready.
            </p>

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{ height: 50, borderRadius: 8, fontSize: 15, background: paying ? "#dcdcdc" : "#ed1a24", border: "none", cursor: paying ? "default" : "pointer", boxShadow: paying ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
            >
              {paying ? "Processing…" : `Pay ${formatPrice(PRODUCT_PRICING.interview[level])} and send me my interview invite`}
            </button>
            <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
              One-time payment per attempt · UPI, card & netbanking
            </p>
          </>
        )}

        {error && (
          <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
