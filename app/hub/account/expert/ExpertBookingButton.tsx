"use client";

import { useState } from "react";
import CounsellingPaywallModal from "../CounsellingPaywallModal";

// Shared button + paywall-modal trigger for the expert-guidance page's two
// booking CTAs (the card under the bio, and the closing gradient CTA card).
// Extracted from ExpertBookingCard so both placements share one booking flow
// instead of each wiring its own modal state.
export default function ExpertBookingButton({
  priceLabel,
  initialRequested,
}: {
  priceLabel: string;
  initialRequested: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [requested, setRequested] = useState(initialRequested);

  if (requested) {
    return (
      <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13 }}>
        Request sent. We&apos;ll confirm your slot.
      </p>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
        style={{ border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Book my expert call for {priceLabel}
      </button>

      {modalOpen && (
        <CounsellingPaywallModal
          priceLabel={priceLabel}
          onClose={() => setModalOpen(false)}
          onRequested={() => {
            setModalOpen(false);
            setRequested(true);
          }}
        />
      )}
    </>
  );
}
