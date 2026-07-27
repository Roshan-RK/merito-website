"use client";

import { useState } from "react";

const TESTIMONIALS = [
  {
    tag: "Fresher Story",
    quote: "I'd applied to 40 jobs and heard nothing back. Within two weeks of building my Merito profile, I had three interview calls, and an offer for the exact role I wanted.",
    initials: "RK",
    name: "Rahul K.",
    meta: "Placed as a Product Analyst · Fitment score 8.4",
  },
  {
    tag: "Mid-Level Story",
    quote: "I'd been passed over for team lead twice - 'strong individual contributor, not ready to manage' was the line I kept hearing. My managerial readiness score gave hiring managers the evidence my CV couldn't. I'm now leading a team of six.",
    initials: "PM",
    name: "Priya M.",
    meta: "Hired as Engineering Manager · Managerial readiness 7.9",
  },
  {
    tag: "Leadership Story",
    quote: "At my level, you don't apply, you wait to be approached, quietly. I never once posted that I was open. My Merito profile let the right recruiters see exactly what they needed to, on their own, while everything else stayed private. I moved roles without a single person at my old company knowing until I'd already signed.",
    initials: "AN",
    name: "Arjun N.",
    meta: "Moved into a Director role · Confidential search",
  },
];

export default function TestimonialCarousel() {
  const [index, setIndex] = useState(0);
  const t = TESTIMONIALS[index];
  const total = TESTIMONIALS.length;
  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 items-center" style={{ gap: 52 }}>
        {/* Quote */}
        <div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24] bg-[#fdeced]" style={{ borderRadius: 50, padding: "6px 16px", fontSize: 11, letterSpacing: "0.04em" }}>
              {t.tag}
            </span>
            <div className="flex items-center" style={{ gap: 8 }}>
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={goPrev}
                className="flex items-center justify-center rounded-full border border-black/[0.1] text-[#4b4b4d] hover:border-[#ed1a24] hover:text-[#ed1a24] transition-colors"
                style={{ width: 34, height: 34 }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={goNext}
                className="flex items-center justify-center rounded-full border border-black/[0.1] text-[#4b4b4d] hover:border-[#ed1a24] hover:text-[#ed1a24] transition-colors"
                style={{ width: 34, height: 34 }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
          <svg width="42" height="32" viewBox="0 0 42 32" fill="none" style={{ display: "block", margin: "22px 0 0" }} aria-hidden="true">
            <path d="M0 32V19.2C0 8.6 6.8 1.4 17 0l2 5.2c-6 1.6-9.4 5.2-9.8 9.8H18V32H0Zm24 0V19.2C24 8.6 30.8 1.4 41 0l1 5.2c-6 1.6-9.4 5.2-9.8 9.8H42V32H24Z" fill="#ed1a24" />
          </svg>
          <blockquote className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "clamp(1.3rem,2.1vw,1.9rem)", letterSpacing: "-0.03em", lineHeight: 1.35, margin: "18px 0 0", minHeight: 140 }}>
            {t.quote}
          </blockquote>
          <div className="flex items-center" style={{ gap: 14, marginTop: 26 }}>
            <span className="flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24] bg-[#fdeced] rounded-full" style={{ width: 48, height: 48, fontSize: 17 }}>
              {t.initials}
            </span>
            <div>
              <p className="font-semibold text-black" style={{ fontSize: 15, margin: 0 }}>
                {t.name} <span className="font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.05em", marginLeft: 8 }}>Placeholder</span>
              </p>
              <p className="text-[#4b4b4d]" style={{ fontSize: 13, margin: "2px 0 0" }}>{t.meta}</p>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8, marginTop: 24 }}>
            {TESTIMONIALS.map((s, i) => (
              <button
                key={s.name}
                type="button"
                aria-label={`Show ${s.tag}`}
                onClick={() => setIndex(i)}
                className="rounded-full transition-all"
                style={{ width: i === index ? 24 : 8, height: 8, background: i === index ? "#ed1a24" : "rgba(0,0,0,0.15)" }}
              />
            ))}
          </div>
        </div>
        {/* Video */}
        <div>
          <div
            className="relative overflow-hidden flex items-center justify-center cursor-pointer group"
            style={{
              aspectRatio: "16 / 10",
              borderRadius: 20,
              background: "linear-gradient(to bottom right, #000, #1a1a1a, #2d0a0c)",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0px 30px 80px rgba(17,35,89,0.12)",
            }}
          >
            <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(237,26,36,0.18), transparent)" }} />
            <span className="absolute font-bold uppercase" style={{ top: 16, left: 16, fontSize: 10, letterSpacing: "0.06em", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 50, padding: "4px 11px" }}>
              Video placeholder · 1:32
            </span>
            <span
              className="relative flex items-center justify-center rounded-full bg-[#ed1a24] transition-transform duration-300 group-hover:scale-110"
              style={{ width: 76, height: 76, boxShadow: "0px 8px 30px rgba(237,26,36,0.45)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 4 }}><path d="M8 5v14l11-7L8 5Z" /></svg>
            </span>
            <span className="absolute flex items-center" style={{ bottom: 16, left: 16, right: 16, gap: 10 }}>
              <span className="flex-1 overflow-hidden block rounded-full" style={{ height: 4, background: "rgba(255,255,255,0.2)" }}>
                <span className="block h-full rounded-full bg-[#ed1a24]" style={{ width: "22%" }} />
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>0:20 / 1:32</span>
            </span>
          </div>
          <p className="text-center text-[#9c9c9c]" style={{ fontSize: 11, margin: "12px 0 0" }}>Placeholder - final candidate video to be added.</p>
        </div>
      </div>
      <div className="flex justify-center" style={{ marginTop: 40 }}>
        <a
          href="#fit-checker"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
          style={{ height: 52, padding: "0 28px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
        >
          See your fit
        </a>
      </div>
    </div>
  );
}
