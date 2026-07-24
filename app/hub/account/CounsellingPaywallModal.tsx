"use client";

import { useState } from "react";

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

export default function CounsellingPaywallModal({
  priceLabel,
  onClose,
  onRequested,
}: {
  priceLabel: string;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/razorpay/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "counselling" }),
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
            setPaying(false);
            if (!verifyRes.ok) {
              setError(verifyData.error || "Payment succeeded but verification failed — please contact support.");
              return;
            }
            onRequested();
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
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, position: "relative" }}
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
          1:1 guidance · Highest impact
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          A real expert, in your corner, telling you exactly what to do next.
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
          Book a one-on-one with a Merito career expert who reads your fitment and gives you a straight, personalised plan to improve your odds.
        </p>

        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 50, borderRadius: 8, fontSize: 15, background: paying ? "#dcdcdc" : "#ed1a24", border: "none", cursor: paying ? "default" : "pointer", boxShadow: paying ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
        >
          {paying ? "Redirecting…" : `Book my expert call — ${priceLabel}`}
        </button>
        <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
          One-time payment · No subscription · UPI, card & netbanking
        </p>

        {error && (
          <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
