"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Play } from "lucide-react";
import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import InterviewPaywallModal from "../InterviewPaywallModal";

const CARD = "bg-[#141416] border border-white/[0.08]";

// Same success/warning/destructive hex values SkillDistribution.tsx already
// established for this app's dark palette (mapped from the mockup's
// success/warning/destructive semantics) -- reused here for the blurred
// sample-question dots instead of inventing a new set.
const SUCCESS = "#3FCB8C";
const WARNING = "#BD7E12";
const DESTRUCTIVE = "#E8798F";

const STEPS = [
  "Answer 10 role-matched questions on camera",
  "Get scored on 5 weighted parameters plus a per-skill breakdown",
  "Walk away with a strengths/gaps analysis and a phased improvement roadmap",
];

const SAMPLE_QUESTIONS = [
  { q: "Walk me through a recent incident you resolved end to end.", color: SUCCESS },
  { q: "How would you approach debugging a pod that keeps restarting?", color: DESTRUCTIVE },
  { q: "How do you prioritize tickets when multiple clients report issues?", color: WARNING },
];

export default function InterviewLockedState({
  roleTitle,
  level,
  userEmail,
}: {
  roleTitle: string;
  level: CandidateLevel;
  userEmail: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const priceLabel = formatPrice(PRODUCT_PRICING.interview[level]);

  const handleStarted = () => {
    setModalOpen(false);
    router.refresh();
  };

  return (
    <div className={CARD} style={{ borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: 24 }}>
        <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <Mic size={17} strokeWidth={2} />
            </div>
            <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
              Mock AI interview
            </span>
          </div>
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15 }}>
            {priceLabel}
          </span>
        </div>

        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white/85" style={{ fontSize: 14, margin: "0 0 6px" }}>
          Practice the real thing before it counts.
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 16px" }}>
          A 20-minute AI-led mock interview built from this job&apos;s description, with question-by-question scoring and a coaching plan
          afterward.
        </p>

        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 18 }}>
          {["20 min", "Role-matched", "Scored report"].map((b) => (
            <span
              key={b}
              className="bg-white/[0.05] border border-white/[0.08] font-[family-name:var(--font-poppins)] text-white/60"
              style={{ fontSize: 12, borderRadius: 999, padding: "6px 13px" }}
            >
              {b}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start" style={{ gap: 10 }}>
              <span
                className="flex items-center justify-center shrink-0 bg-[#ed1a24]/15 text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
                style={{ width: 18, height: 18, borderRadius: "50%", fontSize: 10, marginTop: 1 }}
              >
                {i + 1}
              </span>
              <span className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
          style={{ gap: 8, height: 48, padding: "0 24px", borderRadius: 8, fontSize: 14.5, border: "none", cursor: "pointer" }}
        >
          <Play size={15} strokeWidth={2} />
          Start my mock interview for {priceLabel}
        </button>
      </div>

      <div className="border-t border-white/[0.08] bg-white/[0.02]" style={{ padding: 20 }}>
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 12px" }}>
          Preview: what you&apos;ll get
        </p>
        <div className="select-none" style={{ opacity: 0.8, filter: "blur(3px)", display: "flex", flexDirection: "column", gap: 8 }}>
          {SAMPLE_QUESTIONS.map(({ q, color }) => (
            <div key={q} className="flex items-center bg-white/[0.04]" style={{ gap: 10, borderRadius: 10, padding: "10px 12px" }}>
              <span className="shrink-0" style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
              <span className="font-[family-name:var(--font-poppins)] text-white/70 truncate" style={{ fontSize: 12, flex: 1 }}>
                {q}
              </span>
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-white/40 shrink-0" style={{ fontSize: 12 }}>
                ••
              </span>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <InterviewPaywallModal
          roleTitle={roleTitle}
          level={level}
          userEmail={userEmail}
          onClose={() => setModalOpen(false)}
          onStarted={handleStarted}
        />
      )}
    </div>
  );
}
