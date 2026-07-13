import type { PersonaContent } from "./data";

export default function PersonaLinkedInMockup({ p }: { p: PersonaContent }) {
  return (
    <div className="bg-[#fdf8fb] border border-black/[0.08]" style={{ borderRadius: 18, padding: 18, boxShadow: "0px 30px 80px rgba(17,35,89,0.08)" }}>
      <div className="bg-white border border-black/[0.08] overflow-hidden" style={{ borderRadius: 12 }}>
        <div className="flex items-center bg-[#0a0a0a]" style={{ height: 44, padding: "0 14px" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>linkedin.com/in/your-profile</span>
        </div>
        <div className="flex items-start" style={{ padding: 16, gap: 14 }}>
          <div className="flex-1">
            <div className="rounded-full bg-[#eceaef]" style={{ width: 48, height: 48 }} />
            <div className="rounded bg-[#0a0a0a]" style={{ height: 9, width: "60%", marginTop: 10 }} />
            <div className="rounded bg-[#eceaef]" style={{ height: 7, width: "80%", marginTop: 8 }} />
            <div className="rounded bg-[#eceaef]" style={{ height: 7, width: "45%", marginTop: 6 }} />
            <p className="text-[#9c9c9c]" style={{ fontSize: 10, margin: "12px 0 0" }}>{p.linkedinProfileCaption}</p>
          </div>
          <div className="flex-1 overflow-hidden border border-[rgba(237,26,36,0.35)]" style={{ borderRadius: 10, boxShadow: "0px 12px 36px rgba(237,26,36,0.10)" }}>
            <div className="bg-[#ed1a24]" style={{ height: 4 }} />
            <div style={{ padding: 12 }}>
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-gabarito)] font-bold" style={{ fontSize: 12 }}>
                  Merito <span className="text-[#ed1a24]">HUB</span>
                </span>
                <span className="font-bold uppercase text-[#16803c] bg-[#eefdf1]" style={{ fontSize: 8, borderRadius: 50, padding: "2px 7px" }}>✓ Verified</span>
              </div>
              <div className="flex items-baseline justify-between" style={{ marginTop: 10 }}>
                <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "1.4rem", lineHeight: 1 }}>{p.linkedinMetricValue}</span>
                <span className="font-semibold text-[#4b4b4d]" style={{ fontSize: 9 }}>{p.linkedinMetricLabel}</span>
              </div>
              <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 6, height: 6, borderRadius: 4 }}>
                <div className="bg-[#ed1a24] h-full" style={{ width: `${Math.round(parseFloat(p.linkedinMetricValue) * 10)}%` }} />
              </div>
              <div className="flex justify-between" style={{ marginTop: 10 }}>
                <span className="text-[#4b4b4d]" style={{ fontSize: 9 }}>{p.linkedinFitLabel}</span>
                <span className="font-bold" style={{ fontSize: 9 }}>{p.linkedinFitValue}</span>
              </div>
              <div className="flex justify-between" style={{ marginTop: 5 }}>
                <span className="text-[#4b4b4d]" style={{ fontSize: 9 }}>References</span>
                <span className="font-bold text-[#16803c]" style={{ fontSize: 9 }}>3 verified ✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-[#9c9c9c]" style={{ fontSize: 10.5, margin: "12px 0 0" }}>
        The Merito HUB layer, as {p.key === "leaders" ? "a hiring board" : "a recruiter"} sees it. Illustrative.
      </p>
    </div>
  );
}
