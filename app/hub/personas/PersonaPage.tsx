import Link from "next/link";
import ContactTrigger from "@/components/ContactTrigger";
import RevealOnScroll from "@/components/anim/RevealOnScroll";
import type { PersonaContent } from "./data";
import PersonaHeroVisual from "./PersonaHeroVisual";
import PersonaLinkedInMockup from "./PersonaLinkedInMockup";

function RedEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold"
      style={{ borderRadius: 50, padding: "7px 18px", fontSize: 11, letterSpacing: "0.04em" }}
    >
      {children}
    </span>
  );
}

function TintEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center bg-[#fdeced] text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
      style={{ borderRadius: 50, padding: "6px 16px", fontSize: 11, letterSpacing: "0.04em" }}
    >
      {children}
    </span>
  );
}

function ArrowChip() {
  return (
    <span className="inline-flex items-center justify-center rounded-full flex-shrink-0 bg-black" style={{ width: 26, height: 26 }}>
      <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M7 17L17 7" /><path d="M9 7h8v8" />
      </svg>
    </span>
  );
}

export default function PersonaPage({ p }: { p: PersonaContent }) {
  return (
    <main>
      {/* ══════════ HERO ══════════ */}
      <section className="bg-[#fdf8fb]" style={{ padding: "56px 0 64px" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] items-center" style={{ gap: 52 }}>
            <RevealOnScroll>
              <div>
                <RedEyebrow>{p.eyebrow}</RedEyebrow>
                <h1
                  className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
                  style={{ fontSize: "clamp(2.4rem,4vw,3.6rem)", letterSpacing: "-0.045em", lineHeight: 1.08, margin: "22px 0 0" }}
                >
                  {p.heroHeadlinePlain} <span className="text-[#ed1a24]" style={{ whiteSpace: "nowrap" }}>{p.heroHeadlineAccent}</span> {p.heroHeadlineTail}
                </h1>
                <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 16.5, lineHeight: 1.75, margin: "20px 0 0", maxWidth: 560 }}>
                  {p.heroSub}
                </p>
                <div className="flex flex-wrap items-center" style={{ gap: 14, marginTop: 28 }}>
                  <Link
                    href="/hub#fit-checker"
                    className="inline-flex items-center gap-2.5 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors w-full sm:w-auto justify-center"
                    style={{ height: 54, padding: "0 26px", borderRadius: 8, fontSize: 15, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
                  >
                    Check your fitment score - free
                    <ArrowChip />
                  </Link>
                  <ContactTrigger className="inline-flex items-center justify-center h-[54px] px-6 rounded-[8px] text-[15px] font-[family-name:var(--font-poppins)] font-semibold text-[#6f6f71] border border-[rgba(237,26,36,0.4)] hover:border-[#ed1a24] hover:text-[#ed1a24] transition-all w-full sm:w-auto">
                    Book your dream-job coaching call
                  </ContactTrigger>
                </div>
              </div>
            </RevealOnScroll>
            <RevealOnScroll delay={0.1}>
              <PersonaHeroVisual persona={p.key} />
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ══════════ THE CHALLENGE ══════════ */}
      <section className="bg-white" style={{ padding: "64px 0 56px" }}>
        <div className="max-w-[920px] mx-auto px-5">
          <RevealOnScroll>
            <TintEyebrow>The Real Problem</TintEyebrow>
            <h2
              className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
              style={{ fontSize: "clamp(1.9rem,3vw,2.6rem)", letterSpacing: "-0.035em", lineHeight: 1.15, margin: "18px 0 0" }}
            >
              {p.challengeH2Plain} <span className="text-[#ed1a24]">{p.challengeH2Accent}</span>
            </h2>
            <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 16, lineHeight: 1.8, margin: "18px 0 0" }}>
              {p.challengeBody}
            </p>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ WHAT YOU GET ══════════ */}
      <section className="bg-[#fdf8fb]" style={{ padding: "64px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div className="text-center">
              <TintEyebrow>What You Get</TintEyebrow>
              <h2
                className="font-[family-name:var(--font-gabarito)] font-semibold text-black mx-auto"
                style={{ fontSize: "clamp(1.9rem,3vw,2.6rem)", letterSpacing: "-0.035em", lineHeight: 1.15, margin: "16px auto 0", maxWidth: 760 }}
              >
                How Merito HUB helps you step into <span className="text-[#ed1a24]">{p.whatYouGetH2Accent}</span>
              </h2>
            </div>
          </RevealOnScroll>
          <div className="grid grid-cols-1 sm:grid-cols-2 mx-auto" style={{ gap: 20, marginTop: 44, maxWidth: 1000 }}>
            {p.offerCards.map((c, i) => (
              <RevealOnScroll key={c.n} delay={i * 0.06}>
                <div
                  className="bg-white border border-black/[0.08] h-full transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0px_20px_80px_rgba(237,26,36,0.10)]"
                  style={{ borderRadius: 20, padding: "26px 24px", boxShadow: "0px 18px 50px rgba(17,35,89,0.05)" }}
                >
                  <span
                    className="flex items-center justify-center font-[family-name:var(--font-gabarito)] font-bold text-white bg-[#ed1a24]"
                    style={{ width: 38, height: 38, borderRadius: 10, fontSize: 17, boxShadow: "0px 4px 12px rgba(237,26,36,0.3)" }}
                  >
                    {c.n}
                  </span>
                  <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", lineHeight: 1.25, margin: "18px 0 0" }}>
                    {c.title}
                  </h3>
                  <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "10px 0 0" }}>
                    {c.body}
                  </p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
          <RevealOnScroll delay={0.2}>
            <div className="text-center" style={{ marginTop: 36 }}>
              <Link
                href="/hub#fit-checker"
                className="inline-flex items-center gap-2.5 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                style={{ height: 52, padding: "0 26px", borderRadius: 8, fontSize: 15, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
              >
                Check your fitment score - free
                <ArrowChip />
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ COACHING CLOSER ══════════ */}
      <section className="bg-[#0a0a0a]" style={{ padding: "72px 0" }}>
        <div className="max-w-[920px] mx-auto px-5 text-center">
          <RevealOnScroll>
            <span
              className="inline-flex items-center font-[family-name:var(--font-poppins)] font-bold text-white"
              style={{ borderRadius: 50, border: "1px solid rgba(255,255,255,0.25)", padding: "6px 16px", fontSize: 11, letterSpacing: "0.04em" }}
            >
              Get Coached, Not Just Hired
            </span>
            <h2
              className="font-[family-name:var(--font-gabarito)] font-semibold text-white"
              style={{ fontSize: "clamp(1.9rem,3vw,2.6rem)", letterSpacing: "-0.035em", lineHeight: 1.15, margin: "18px 0 0" }}
            >
              {p.coachingH2Plain} <span className="text-[#ed1a24]">{p.coachingH2Accent}</span>
            </h2>
            <p className="font-[family-name:var(--font-poppins)] font-medium mx-auto" style={{ fontSize: 15.5, lineHeight: 1.8, color: "rgba(255,255,255,0.75)", margin: "18px auto 0", maxWidth: 760 }}>
              {p.coachingBody}
            </p>
            <ContactTrigger className="inline-flex items-center justify-center mt-7 h-[54px] px-[26px] rounded-[8px] text-[15px] font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors">
              Book your dream-job coaching call
            </ContactTrigger>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ LINKEDIN CLOSER ══════════ */}
      <section className="bg-white" style={{ padding: "64px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center" style={{ gap: 52 }}>
            <RevealOnScroll>
              <div>
                <TintEyebrow>Your Unfair Advantage</TintEyebrow>
                <h2
                  className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
                  style={{ fontSize: "clamp(1.9rem,3vw,2.6rem)", letterSpacing: "-0.035em", lineHeight: 1.15, margin: "18px 0 0" }}
                >
                  {p.linkedinH2Plain} <span className="text-[#ed1a24]">{p.linkedinH2Accent}</span>
                </h2>
                <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 15, lineHeight: 1.8, margin: "18px 0 0" }}>
                  {p.linkedinBody}
                </p>
                <Link
                  href="/hub#fit-checker"
                  className="inline-flex items-center justify-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                  style={{ marginTop: 24, height: 52, padding: "0 24px", borderRadius: 8, fontSize: 14.5, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
                >
                  Build my profile - free to start
                </Link>
              </div>
            </RevealOnScroll>
            <RevealOnScroll delay={0.1}>
              <PersonaLinkedInMockup p={p} />
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIAL ══════════ */}
      <section className="bg-[#fdf8fb]" style={{ padding: "64px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 items-center" style={{ gap: 52 }}>
              <div>
                <TintEyebrow>{p.testimonialEyebrow}</TintEyebrow>
                <svg width="42" height="32" viewBox="0 0 42 32" fill="none" style={{ display: "block", margin: "22px 0 0" }} aria-hidden="true">
                  <path d="M0 32V19.2C0 8.6 6.8 1.4 17 0l2 5.2c-6 1.6-9.4 5.2-9.8 9.8H18V32H0Zm24 0V19.2C24 8.6 30.8 1.4 41 0l1 5.2c-6 1.6-9.4 5.2-9.8 9.8H42V32H24Z" fill="#ed1a24" />
                </svg>
                <blockquote
                  className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
                  style={{ fontSize: "clamp(1.5rem,2.4vw,2.1rem)", letterSpacing: "-0.03em", lineHeight: 1.3, margin: "18px 0 0" }}
                >
                  {p.testimonialQuote}
                </blockquote>
                <div className="flex items-center" style={{ gap: 14, marginTop: 26 }}>
                  <span className="flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24] bg-[#fdeced] rounded-full" style={{ width: 48, height: 48, fontSize: 17 }}>
                    {p.testimonialInitials}
                  </span>
                  <div>
                    <p className="font-semibold text-black" style={{ fontSize: 15, margin: 0 }}>
                      {p.testimonialName} <span className="font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.05em", marginLeft: 8 }}>Placeholder</span>
                    </p>
                    <p className="text-[#4b4b4d]" style={{ fontSize: 13, margin: "2px 0 0" }}>{p.testimonialOutcome}</p>
                  </div>
                </div>
              </div>
              <div>
                <div
                  className="relative overflow-hidden flex items-center justify-center cursor-pointer group"
                  style={{ aspectRatio: "16 / 10", borderRadius: 20, background: "linear-gradient(to bottom right, #000, #1a1a1a, #2d0a0c)", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0px 30px 80px rgba(17,35,89,0.12)" }}
                >
                  <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(237,26,36,0.18), transparent)" }} />
                  <span className="absolute font-bold uppercase" style={{ top: 16, left: 16, fontSize: 10, letterSpacing: "0.06em", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 50, padding: "4px 11px" }}>
                    Video placeholder · {p.testimonialVideoLength}
                  </span>
                  <span className="relative flex items-center justify-center rounded-full bg-[#ed1a24] transition-transform duration-300 group-hover:scale-110" style={{ width: 76, height: 76, boxShadow: "0px 8px 30px rgba(237,26,36,0.45)" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 4 }}><path d="M8 5v14l11-7L8 5Z" /></svg>
                  </span>
                </div>
                <p className="text-center text-[#9c9c9c]" style={{ fontSize: 11, margin: "12px 0 0" }}>Placeholder - final candidate video to be added.</p>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="bg-white" style={{ padding: "24px 0 72px" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div
              className="relative overflow-hidden text-center"
              style={{ background: "linear-gradient(to bottom right, #000, #1a1a1a, #2d0a0c)", borderRadius: 24, padding: "64px 24px" }}
            >
              <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(237,26,36,0.2), transparent)" }} />
              <h2
                className="relative font-[family-name:var(--font-gabarito)] font-semibold text-white"
                style={{ fontSize: "clamp(2rem,3.5vw,3rem)", letterSpacing: "-0.035em", lineHeight: 1.12, margin: "0 auto", maxWidth: 780 }}
              >
                {p.finalCtaHeadlinePlain} <span className="text-[#ed1a24]">{p.finalCtaHeadlineAccent}</span>
              </h2>
              <p className="relative font-[family-name:var(--font-poppins)] font-medium mx-auto" style={{ fontSize: 16, lineHeight: 1.75, color: "rgba(255,255,255,0.75)", margin: "16px auto 0", maxWidth: 620 }}>
                {p.finalCtaBody}
              </p>
              <Link
                href="/hub#fit-checker"
                className="relative inline-flex items-center justify-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                style={{ marginTop: 28, height: 54, padding: "0 28px", borderRadius: 8, fontSize: 15, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
              >
                Check my fitment score - free
              </Link>
              <p className="relative" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", margin: "18px 0 0" }}>
                Free to start · No sign-up for your first score ·{" "}
                <Link href="/hub#pricing" className="text-white underline">
                  Full pricing &amp; how it works →
                </Link>
              </p>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </main>
  );
}
