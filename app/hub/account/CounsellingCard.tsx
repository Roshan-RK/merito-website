"use client";

export default function CounsellingCard({
  priceLabel,
  requested,
  onOpenPaywall,
}: {
  priceLabel: string;
  requested: boolean;
  onOpenPaywall: () => void;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(to bottom right,#000,#1a1a1a,#2d0a0c)",
        borderRadius: 20,
        padding: "24px 22px",
        marginTop: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          borderRadius: 50,
          background: "#ed1a24",
          padding: "4px 12px",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#fff",
        }}
      >
        1:1 guidance · Highest impact
      </span>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.2rem", lineHeight: 1.3, margin: "12px 0 0" }}>
        A real expert, in your corner, telling you exactly what to do next.
      </p>
      <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, margin: "10px 0 18px" }}>
        A Merito career expert reads your fitment, personality fit, and mock interview — then gives you a straight, personalised plan.
      </p>

      {requested ? (
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13 }}>
          Request sent — we&apos;ll confirm your slot.
        </p>
      ) : (
        <button
          onClick={onOpenPaywall}
          className="font-[family-name:var(--font-poppins)] font-semibold"
          style={{ background: "#fff", color: "#0a0a0a", border: "none", borderRadius: 8, padding: "12px 18px", fontSize: 13.5, cursor: "pointer" }}
        >
          Book my expert call — {priceLabel}
        </button>
      )}
    </div>
  );
}
