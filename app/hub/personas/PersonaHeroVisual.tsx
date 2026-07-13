import type { PersonaKey } from "./data";

function FreshersVisual() {
  const stack = [
    { top: 24, left: 0, rot: -4 },
    { top: 0, left: 150, rot: 2 },
    { top: 36, right: 0, rot: 5 },
  ];
  return (
    <div className="relative hidden sm:block" style={{ minHeight: 420 }} aria-hidden="true">
      {stack.map((c, i) => (
        <div
          key={i}
          className="absolute bg-white border border-black/[0.08]"
          style={{
            top: c.top,
            left: "left" in c ? c.left : undefined,
            right: "right" in c ? c.right : undefined,
            width: 200,
            borderRadius: 14,
            padding: 16,
            opacity: 0.55,
            transform: `rotate(${c.rot}deg)`,
          }}
        >
          <div className="rounded-full bg-[#eceaef]" style={{ width: 34, height: 34 }} />
          <div className="rounded bg-[#eceaef]" style={{ height: 8, marginTop: 12, width: "70%" }} />
          <div className="rounded bg-[#f2f0f4]" style={{ height: 7, marginTop: 8 }} />
          <div className="rounded bg-[#f2f0f4]" style={{ height: 7, marginTop: 6, width: "85%" }} />
          <div className="rounded bg-[#f2f0f4]" style={{ height: 7, marginTop: 6, width: "60%" }} />
          <p className="text-[#9c9c9c]" style={{ fontSize: 10, margin: "12px 0 0" }}>B.Tech · 2026 · &ldquo;Eager to learn&rdquo;</p>
        </div>
      ))}
      <div
        className="absolute bg-white border border-[rgba(237,26,36,0.4)]"
        style={{ bottom: 0, left: "50%", transform: "translateX(-50%)", width: 280, borderRadius: 18, padding: 20, boxShadow: "0px 30px 80px rgba(237,26,36,0.14)", zIndex: 2 }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <div className="flex items-center justify-center rounded-full bg-[#fdeced] text-[#ed1a24] font-[family-name:var(--font-gabarito)] font-bold" style={{ width: 42, height: 42, fontSize: 16 }}>You</div>
          <div>
            <div className="rounded bg-[#0a0a0a]" style={{ height: 9, width: 110 }} />
            <div className="rounded bg-[#eceaef]" style={{ height: 7, width: 80, marginTop: 6 }} />
          </div>
          <span className="font-bold uppercase text-[#16803c] bg-[#eefdf1]" style={{ marginLeft: "auto", fontSize: 9, letterSpacing: "0.05em", borderRadius: 50, padding: "3px 9px" }}>✓ Verified</span>
        </div>
        <div className="flex items-baseline justify-between" style={{ marginTop: 16 }}>
          <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "2rem", lineHeight: 1 }}>
            8.2<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "0.95rem" }}> / 10</span>
          </span>
          <span className="font-semibold text-[#4b4b4d]" style={{ fontSize: 11.5 }}>fit for Graduate Analyst</span>
        </div>
        <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 10, height: 8, borderRadius: 5 }}>
          <div className="bg-[#ed1a24] h-full" style={{ width: "82%" }} />
        </div>
        <div className="flex justify-between" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <span className="text-[#4b4b4d]" style={{ fontSize: 11 }}>Mock interviews done</span><span className="font-bold text-black" style={{ fontSize: 11 }}>5</span>
        </div>
        <div className="flex justify-between" style={{ marginTop: 6 }}>
          <span className="text-[#4b4b4d]" style={{ fontSize: 11 }}>Personality fit</span><span className="font-bold text-black" style={{ fontSize: 11 }}>Explorer · 84%</span>
        </div>
      </div>
      <p className="absolute text-[#9c9c9c] whitespace-nowrap" style={{ bottom: -28, left: "50%", transform: "translateX(-50%)", fontSize: 11, margin: 0 }}>
        Same degree. Different signal.
      </p>
    </div>
  );
}

function ManagersVisual() {
  return (
    <div className="relative hidden sm:flex items-center justify-center" style={{ minHeight: 420 }} aria-hidden="true">
      <div className="absolute bg-white border border-black/[0.08]" style={{ top: 16, left: 8, width: 230, borderRadius: 14, padding: 18, opacity: 0.6, transform: "rotate(-3deg)" }}>
        <p className="font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: 0 }}>What recruiters see today</p>
        <div className="rounded bg-[#0a0a0a]" style={{ height: 9, width: "65%", marginTop: 12 }} />
        <p className="text-[#4b4b4d]" style={{ fontSize: 11, margin: "8px 0 0", lineHeight: 1.6 }}>Strong individual contributor.<br />5 years. Delivers every quarter.</p>
        <div className="text-center text-[#9c9c9c]" style={{ marginTop: 12, border: "1.5px dashed #dcdcdc", borderRadius: 8, padding: 8, fontSize: 10.5 }}>Managerial potential: no evidence</div>
      </div>
      <div className="relative bg-white border border-[rgba(237,26,36,0.4)]" style={{ width: 290, borderRadius: 18, padding: 22, boxShadow: "0px 30px 80px rgba(237,26,36,0.14)", zIndex: 2, marginLeft: 120, marginTop: 100 }}>
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase text-[#4b4b4d]" style={{ fontSize: 10, letterSpacing: "0.06em" }}>Managerial Readiness</span>
          <span className="font-bold uppercase text-[#16803c] bg-[#eefdf1]" style={{ fontSize: 9, letterSpacing: "0.05em", borderRadius: 50, padding: "3px 9px" }}>✓ Verified</span>
        </div>
        <div className="flex items-baseline justify-between" style={{ marginTop: 14 }}>
          <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "2.2rem", lineHeight: 1 }}>
            7.9<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "1rem" }}> / 10</span>
          </span>
          <span className="font-semibold text-[#4b4b4d]" style={{ fontSize: 11.5 }}>ready to lead</span>
        </div>
        <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 10, height: 8, borderRadius: 5 }}>
          <div className="bg-[#ed1a24] h-full" style={{ width: "79%" }} />
        </div>
        {[
          { l: "People decisions", v: "8.4", w: "84%" },
          { l: "Prioritisation", v: "7.8", w: "78%" },
          { l: "Stakeholder handling", v: "7.5", w: "75%" },
        ].map((row) => (
          <div key={row.l} className="flex items-center" style={{ gap: 10, marginTop: 8 }}>
            <span className="text-[#4b4b4d] flex-shrink-0" style={{ fontSize: 11, width: 118 }}>{row.l}</span>
            <div className="flex-1 bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 4 }}>
              <div className="bg-[#ed1a24] h-full" style={{ width: row.w }} />
            </div>
            <span className="font-bold text-right" style={{ fontSize: 11, width: 26 }}>{row.v}</span>
          </div>
        ))}
        <p className="text-[#9c9c9c]" style={{ fontSize: 10.5, margin: "14px 0 0", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10 }}>
          Evidence a hiring manager can trust - not &ldquo;I think I&apos;m ready.&rdquo;
        </p>
      </div>
    </div>
  );
}

function LeadersVisual() {
  return (
    <div className="relative hidden sm:flex items-center justify-center" style={{ minHeight: 420 }} aria-hidden="true">
      <div className="absolute bg-white border border-black/[0.08]" style={{ top: 10, right: 14, width: 210, borderRadius: 14, padding: 16, opacity: 0.6, transform: "rotate(3deg)" }}>
        <p className="font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: 0 }}>The impressive CV</p>
        <div className="rounded bg-[#0a0a0a]" style={{ height: 9, width: "70%", marginTop: 12 }} />
        <p className="text-[#4b4b4d]" style={{ fontSize: 11, margin: "8px 0 0", lineHeight: 1.6 }}>18 years. P&amp;L owner.<br />Same seat since 2019.</p>
        <div className="text-center text-[#9c9c9c]" style={{ marginTop: 12, border: "1.5px dashed #dcdcdc", borderRadius: 8, padding: 8, fontSize: 10.5 }}>C-suite readiness: unseen</div>
      </div>
      <div className="relative bg-[#0a0a0a]" style={{ width: 300, borderRadius: 18, padding: 22, boxShadow: "0px 30px 80px rgba(0,0,0,0.3)", zIndex: 2, marginRight: 90, marginTop: 80 }}>
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: "0.06em", color: "rgba(255,255,255,0.6)" }}>Leadership Assessment</span>
          <span className="font-bold uppercase text-white bg-[#ed1a24]" style={{ fontSize: 9, letterSpacing: "0.05em", borderRadius: 50, padding: "3px 9px" }}>CXO traits</span>
        </div>
        <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.25rem", lineHeight: 1.25, margin: "14px 0 0" }}>
          What the board looks for - made visible.
        </p>
        {[
          { l: "Vision & narrative", v: "8.8", w: "88%" },
          { l: "Judgement", v: "8.2", w: "82%" },
          { l: "Business breadth", v: "7.6", w: "76%" },
          { l: "Executive presence", v: "8.4", w: "84%" },
        ].map((row) => (
          <div key={row.l} className="flex items-center" style={{ gap: 10, marginTop: 8 }}>
            <span className="flex-shrink-0" style={{ fontSize: 11, width: 120, color: "rgba(255,255,255,0.7)" }}>{row.l}</span>
            <div className="flex-1 overflow-hidden" style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.12)" }}>
              <div className="bg-[#ed1a24] h-full" style={{ width: row.w }} />
            </div>
            <span className="font-bold text-white text-right" style={{ fontSize: 11, width: 26 }}>{row.v}</span>
          </div>
        ))}
        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", margin: "14px 0 0", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10 }}>
          Leadership evidence - not just a long tenure.
        </p>
      </div>
    </div>
  );
}

export default function PersonaHeroVisual({ persona }: { persona: PersonaKey }) {
  if (persona === "managers") return <ManagersVisual />;
  if (persona === "leaders") return <LeadersVisual />;
  return <FreshersVisual />;
}
