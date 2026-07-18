import type { Metadata } from "next";
import Link from "next/link";
import ContactTrigger from "@/components/ContactTrigger";
import RevealOnScroll from "@/components/anim/RevealOnScroll";
import { getAbsoluteUrl } from "@/lib/site";
import FitmentChecker from "./FitmentChecker";
import ProblemCards from "./ProblemCards";
import FaqAccordion from "./FaqAccordion";
import HubCountUp from "./HubCountUp";

export const metadata: Metadata = {
  title: "Merito HUB - Increase Your Chances of Landing Your Dream Job",
  description:
    "Not getting shortlisted? Merito HUB scores your CV against the job you want, shows you what to fix, and builds a recruiter-ready profile - so you get discovered, not filtered out. Check your fitment free.",
  openGraph: {
    title: "Merito HUB - Increase Your Chances of Landing Your Dream Job",
    description:
      "Not getting shortlisted? Merito HUB scores your CV against the job you want, shows you what to fix, and builds a recruiter-ready profile - so you get discovered, not filtered out. Check your fitment free.",
    url: getAbsoluteUrl("/hub"),
  },
  alternates: { canonical: "/hub" },
};

/* ─── Data ─── */
const STATS = [
  { num: 1000, prefix: "", suffix: "+", label: "professionals placed" },
  { num: 100, prefix: "", suffix: "+", label: "companies hiring through Merito" },
  { num: 60, prefix: "", suffix: " sec", label: "to your first fitment score" },
  { num: 0, prefix: "₹", suffix: "", label: "to start - free, no sign-up" },
];

const SHIFT_STEPS = [
  { n: "1", title: "Know your fit", body: "Score your CV against the exact job you want." },
  { n: "2", title: "Fix the gaps", body: "See what's holding you back and how to fix it." },
  { n: "3", title: "Prove your strengths", body: "Personality, a mock interview, and verified references." },
  { n: "4", title: "Get found", body: "One recruiter-ready profile that travels with every application." },
];

const OFFERINGS = [
  { n: "1", name: "CV Fitment", tag: "Free · No sign-up", free: true, span: 2, benefit: "Find out where you stand in 60 seconds.", body: "Upload your CV, tell us the role you're aiming for, and get an instant fitment score. Create a free account to unlock the full report - strengths, gaps, and exactly how to rework your CV to close them.", cta: "Check my fitment - free", href: "#fit-checker" },
  { n: "2", name: "Personality Fitment", tag: "Builds your profile", free: false, span: 2, benefit: "Recruiters hire for fit, not just skills. Show them yours.", body: "Take a structured personality assessment and see how your working style maps to the role - the same psychometric signal that makes Merito's hiring nearly 2x more predictive than gut feel.", cta: "Discover my fit", href: "#pricing" },
  { n: "3", name: "Mock AI Interview", tag: "Builds your profile", free: false, span: 2, benefit: "Walk into the real interview knowing you'll nail it.", body: "Sit a realistic 30-minute AI mock interview whenever you want, as many times as you want - with a detailed report on where you're strong, where you're losing the room, and what to say differently.", cta: "Practise my interview", href: "#pricing" },
  { n: "4", name: "References Feedback", tag: "Builds your profile", free: false, span: 3, benefit: "Let the people who've worked with you do the vouching.", body: "Invite managers, teammates, or clients to rate your soft skills across 7 parameters. Verified, structured references that carry the kind of credibility a CV never can.", cta: "Invite my references", href: "#pricing" },
  { n: "5", name: "1:1 Expert Guidance", tag: "1:1 guidance", free: false, span: 3, benefit: "A real expert, in your corner, telling you what to do next.", body: "Book a one-on-one with a Merito career expert who reads your fitment, your personality fit, and your mock interview performance - then gives you a straight, personalised plan to improve your odds.", cta: "Book my expert call", href: "#pricing" },
];

const PROFILE_CHIPS = ["Fitment to the role", "Personality-to-job map", "Verified references", "Mock interview standing", "Key strengths"];

const EXT_POINTS = [
  { n: "1", head: "Your fit for their role", body: "a clear summary of how well you match the exact job they're hiring for." },
  { n: "2", head: "Your personality, mapped to the job", body: "how your working style fits what the role needs." },
  { n: "3", head: "Your references, summarised", body: "the verdict of people who've actually worked with you, in one glance." },
  { n: "4", head: "Your mock interview performance", body: "the outcome of the assessment interview before they shortlisted you." },
];

const AUDIENCES = [
  { title: "Students & Freshers", body: "No experience to point to yet? Show fit, personality, and potential instead - and walk into campus placements with a profile most graduates don't have.", href: "/hub/freshers" },
  { title: "Mid-Level Professionals", body: "Stuck getting ignored despite a solid track record? Find the gaps between your CV and the roles you want, and close them fast.", href: "/hub/managers" },
  { title: "Senior & Leadership", body: "Moving quietly and selectively? Get a sharp, credible profile and expert guidance that matches the level you're playing at.", href: "/hub/leaders" },
];

const HOW_STEPS = [
  { n: "1", title: "Check your fit - free.", body: "Upload your CV, name your target job, get your score in a minute." },
  { n: "2", title: "See what to fix.", body: "Sign in for the full report - strengths, gaps, and how to improve your CV." },
  { n: "3", title: "Build your profile.", body: "Add your personality test, mock interview, and references." },
  { n: "4", title: "Apply and get found.", body: "Send your one-page profile with every application - and let recruiters discover you on LinkedIn." },
];

const PRICING: { name: string; price: string; red: boolean; badge?: string; highlight?: boolean }[] = [
  { name: "Job Fitment Score", price: "Free · no sign-up", red: true },
  { name: "Detailed Fitment Report", price: "₹299", red: false },
  { name: "Personality Test & Job Fit", price: "₹299", red: false },
  { name: "30-Minute Mock Interview + report", price: "₹999", red: false },
  { name: "Invited References", price: "₹299", red: false },
  { name: "All three - build your full profile", price: "₹1499", red: true, badge: "Save ₹398", highlight: true },
  { name: "Career Expert Session (30 mins)", price: "₹1999", red: false },
];

/* ─── Shared bits ─── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold uppercase"
      style={{ borderRadius: 50, padding: "6px 16px", fontSize: 11, letterSpacing: "0.04em", boxShadow: "0px 8px 24px rgba(237,26,36,0.22)" }}
    >
      {children}
    </span>
  );
}

function ArrowChip() {
  return (
    <span className="inline-flex items-center justify-center rounded-full flex-shrink-0 bg-black" style={{ width: 26, height: 26 }}>
      <svg width="13" height="13" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M7 17L17 7" /><path d="M9 7h8v8" />
      </svg>
    </span>
  );
}

export default function HubPage() {
  return (
    <main>
      <style>{`
        html { scroll-behavior: smooth; }
        #fit-checker, #how-it-works, #pricing { scroll-margin-top: 110px; }
      `}</style>

      {/* ══════════ HERO ══════════ */}
      <section className="bg-white" style={{ padding: "44px 0 24px" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] items-start" style={{ gap: 52 }}>
            <RevealOnScroll>
              <div style={{ maxWidth: 620 }}>
                <Eyebrow>Merito HUB · For Candidates</Eyebrow>
                <h1
                  className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
                  style={{ fontSize: "clamp(2.4rem,4vw,3.7rem)", lineHeight: 1.04, letterSpacing: "-0.04em", margin: "24px 0 0" }}
                >
                  Stop applying into the void. <span className="text-[#ed1a24]">Start getting shortlisted.</span>
                </h1>
                <p
                  className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]"
                  style={{ fontSize: 18, lineHeight: 1.65, margin: "20px 0 0", maxWidth: 540 }}
                >
                  You&apos;ve sent your CV to twenty jobs and heard back from none. It&apos;s not that you&apos;re not good enough - it&apos;s that no one can see it. Merito HUB shows you exactly where you stand for the job you want, helps you fix the gaps, and builds you a profile recruiters can&apos;t ignore.
                </p>
                <div className="flex flex-wrap items-center" style={{ gap: 12, marginTop: 28 }}>
                  <a
                    href="#fit-checker"
                    className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors w-full sm:w-auto justify-center"
                    style={{ height: 52, padding: "0 26px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
                  >
                    Check your fitment score - free
                    <ArrowChip />
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center font-[family-name:var(--font-poppins)] font-semibold text-[#6f6f71] border border-[rgba(237,26,36,0.4)] hover:border-[#ed1a24] hover:text-[#ed1a24] transition-all w-full sm:w-auto"
                    style={{ height: 52, padding: "0 26px", borderRadius: 10, fontSize: 16 }}
                  >
                    See how it works
                  </a>
                </div>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13, margin: "24px 0 0", lineHeight: 1.6 }}>
                  From Merito - the AI hiring partner trusted by India&apos;s fastest-growing companies.
                  <br />
                  <span className="font-medium text-[#9c9c9c]">1000+ professionals placed across 100+ companies.</span>
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1}>
              <FitmentChecker />
            </RevealOnScroll>
          </div>

          {/* Stats bar */}
          <RevealOnScroll delay={0.15}>
            <div className="bg-[#0a0a0a]" style={{ borderRadius: 14, marginTop: 44, padding: 4 }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden" style={{ borderRadius: 12 }}>
                {STATS.map((s, i) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center justify-center text-center"
                    style={{
                      padding: "22px 12px",
                      borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                      borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    }}
                  >
                    <div className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", lineHeight: 1 }}>
                      <HubCountUp to={s.num} prefix={s.prefix} suffix={s.suffix} />
                    </div>
                    <div className="font-[family-name:var(--font-poppins)] font-medium text-white" style={{ fontSize: 13, marginTop: 6 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ THE REAL PROBLEM ══════════ */}
      <section className="bg-white" style={{ padding: "56px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <Eyebrow>The Real Problem</Eyebrow>
            <h2
              className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
              style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: "24px 0 0", maxWidth: 900 }}
            >
              You&apos;re not applying too little. <span className="text-[#ed1a24]">You&apos;re applying blind.</span>
            </h2>
            <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 18, lineHeight: 1.7, margin: "18px 0 0", maxWidth: 840 }}>
              Every job posting pulls in 200 to 500 applications. Fewer than 1 in 10 make the shortlist. And if you&apos;re one of the other nine, you get the same thing every time: silence. No score. No feedback. No idea what to fix. So you tweak the same CV, send it to ten more roles, and wait for a reply that never comes.
            </p>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#0a0a0a]" style={{ fontSize: 18, lineHeight: 1.7, margin: "14px 0 0", maxWidth: 840 }}>
              That&apos;s not a you problem. That&apos;s a visibility problem - and it&apos;s the one thing no job board has ever solved.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <div style={{ marginTop: 40 }}>
              <ProblemCards />
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ THE SHIFT ══════════ */}
      <section className="bg-[#fdf8fb]" style={{ padding: "56px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
              <Eyebrow>How Merito HUB Helps</Eyebrow>
              <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: 0 }}>
                Stop guessing. <span className="text-[#ed1a24]">Start knowing.</span>
              </h2>
              <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 18, lineHeight: 1.65, margin: 0, maxWidth: 820 }}>
                Merito HUB is the candidate side of Merito - the same skill-based platform companies already hire through, pointed back at you. It closes the feedback loop the job market forgot. In four steps you go from invisible and guessing to informed, coached, and impossible to overlook.
              </p>
            </div>
          </RevealOnScroll>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 16, marginTop: 44 }}>
            {SHIFT_STEPS.map((s, i) => (
              <RevealOnScroll key={s.n} delay={i * 0.08}>
                <div
                  className="bg-white border border-black/[0.08] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0px_20px_80px_rgba(237,26,36,0.10)]"
                  style={{ borderRadius: 20, padding: 24, boxShadow: "0px 18px 50px rgba(17,35,89,0.05)" }}
                >
                  <div
                    className="flex items-center justify-center font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24] border-2 border-[#ed1a24] rounded-full"
                    style={{ width: 40, height: 40, fontSize: 15 }}
                  >
                    {s.n}
                  </div>
                  <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "16px 0 0", lineHeight: 1.2 }}>
                    {s.title}
                  </h3>
                  <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.7, margin: "8px 0 0" }}>
                    {s.body}
                  </p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ WHAT YOU GET ══════════ */}
      <section className="bg-white" style={{ padding: "56px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
              <Eyebrow>What You Get</Eyebrow>
              <h2
                className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
                style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: 0, maxWidth: 860 }}
              >
                Everything you need to turn <span className="text-[#ed1a24]">&ldquo;applied&rdquo;</span> into <span className="text-[#ed1a24]">&ldquo;shortlisted.&rdquo;</span>
              </h2>
            </div>
          </RevealOnScroll>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6" style={{ gap: 18, marginTop: 44 }}>
            {OFFERINGS.map((o, i) => (
              <RevealOnScroll
                key={o.n}
                delay={i * 0.06}
                className={o.span === 2 ? "sm:col-span-1 lg:col-span-2" : "sm:col-span-2 lg:col-span-3"}
              >
                <div
                  className={`flex flex-col h-full box-border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0px_20px_80px_rgba(237,26,36,0.10)] ${
                    o.free ? "bg-[#fdf8fb] border border-[#f4d8d8]" : "bg-white border border-black/[0.08]"
                  }`}
                  style={{ borderRadius: 20, padding: "26px 24px", boxShadow: "0px 18px 50px rgba(17,35,89,0.05)" }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="flex items-center justify-center font-[family-name:var(--font-gabarito)] font-bold text-white bg-[#ed1a24]"
                      style={{ width: 38, height: 38, borderRadius: 10, fontSize: 17, boxShadow: "0px 4px 12px rgba(237,26,36,0.3)" }}
                    >
                      {o.n}
                    </span>
                    <span
                      className="font-[family-name:var(--font-poppins)] font-bold uppercase"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.05em",
                        borderRadius: 50,
                        padding: "4px 12px",
                        color: o.free ? "#fff" : "#ed1a24",
                        background: o.free ? "#ed1a24" : "#fdeced",
                      }}
                    >
                      {o.tag}
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.35rem", margin: "18px 0 0", lineHeight: 1.2 }}>
                    {o.name}
                  </h3>
                  <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, lineHeight: 1.5, margin: "8px 0 0" }}>
                    {o.benefit}
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d] flex-1" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "8px 0 18px" }}>
                    {o.body}
                  </p>
                  <a
                    href={o.href}
                    className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] hover:text-[#c8151e] transition-colors"
                    style={{ fontSize: 14 }}
                  >
                    {o.cta}
                    <ArrowChip />
                  </a>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ THE PAYOFF ══════════ */}
      <section className="bg-[#0a0a0a]" style={{ padding: "64px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5 text-center flex flex-col items-center" style={{ gap: 18 }}>
          <RevealOnScroll>
            <div className="flex flex-col items-center" style={{ gap: 18 }}>
              <Eyebrow>The Payoff</Eyebrow>
              <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.1, letterSpacing: "-0.03em", margin: 0, maxWidth: 820 }}>
                Every step builds your profile recruiters <span className="text-[#ed1a24]">actually read.</span>
              </h2>
              <p className="font-[family-name:var(--font-poppins)] font-medium" style={{ fontSize: 17, lineHeight: 1.75, color: "rgba(255,255,255,0.75)", margin: 0, maxWidth: 840 }}>
                Your fitment score, personality fit, mock interview result, and references roll up into one recruiter-ready Merito profile. Attach it to any application - and stop being one anonymous CV in a stack of 500.
              </p>
              <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.3rem", margin: "6px 0 0", maxWidth: 720, lineHeight: 1.4 }}>
                One profile. Every proof point that matters. Sent with your application, working for you before you&apos;ve even had the interview.
              </p>
              <div className="flex flex-wrap justify-center" style={{ gap: 10, marginTop: 10 }}>
                {PROFILE_CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center font-[family-name:var(--font-poppins)] font-semibold"
                    style={{ gap: 8, borderRadius: 50, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", padding: "9px 18px", fontSize: 13, color: "rgba(255,255,255,0.9)" }}
                  >
                    <span className="rounded-full bg-[#ed1a24]" style={{ width: 6, height: 6 }} />
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ RECRUITER EXTENSION ══════════ */}
      <section className="bg-white" style={{ padding: "64px 0 56px" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] items-center" style={{ gap: 52 }}>
            <RevealOnScroll>
              <div>
                <Eyebrow>The Unfair Advantage</Eyebrow>
                <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "clamp(2rem,3.2vw,2.8rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: "22px 0 0" }}>
                  Get discovered on LinkedIn - <span className="text-[#ed1a24]">not filtered out.</span>
                </h2>
                <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 16, lineHeight: 1.7, margin: "16px 0 0" }}>
                  This is the part no other platform gives you. Recruiters at companies hiring through Merito use the Merito HUB browser extension. When they open your LinkedIn profile, they don&apos;t just see your headline - they see your Merito HUB credential right alongside it:
                </p>
                <div className="flex flex-col" style={{ gap: 14, marginTop: 24 }}>
                  {EXT_POINTS.map((pt) => (
                    <div key={pt.n} className="flex items-start" style={{ gap: 14 }}>
                      <span
                        className="flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-gabarito)] font-bold text-white bg-[#ed1a24]"
                        style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14, boxShadow: "0px 4px 12px rgba(237,26,36,0.3)" }}
                      >
                        {pt.n}
                      </span>
                      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.65, margin: "2px 0 0" }}>
                        <strong className="text-black">{pt.head}</strong> - {pt.body}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.15rem", lineHeight: 1.5, margin: "24px 0 0" }}>
                  Your strengths, in front of the right people, at the exact moment they&apos;re deciding. That&apos;s the difference between being skipped and being shortlisted.
                </p>
                <div className="bg-[#fdf8fb] border border-black/[0.08]" style={{ marginTop: 20, borderLeft: "6px solid #ed1a24", borderRadius: 12, padding: "16px 18px" }}>
                  <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                    <strong className="text-black">You&apos;re always in control.</strong> Your profile only ever shows what you choose to share - your verified, approved credential. Never raw scores. Never your gaps.
                  </p>
                </div>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1}>
              <div className="bg-white border border-black/[0.08] overflow-hidden" style={{ borderRadius: 18, boxShadow: "0px 30px 80px rgba(17,35,89,0.10)" }}>
                {/* Browser chrome */}
                <div className="flex items-center bg-[#f4f4f5] border-b border-black/[0.08]" style={{ gap: 8, padding: "12px 16px" }}>
                  <span className="rounded-full bg-[#ff5f57]" style={{ width: 10, height: 10 }} />
                  <span className="rounded-full bg-[#febc2e]" style={{ width: 10, height: 10 }} />
                  <span className="rounded-full bg-[#28c840]" style={{ width: 10, height: 10 }} />
                  <span className="flex-1 bg-white border border-[#dcdcdc] text-[#4b4b4d] truncate" style={{ marginLeft: 12, borderRadius: 50, padding: "6px 14px", fontSize: 12 }}>
                    linkedin.com/in/ananya-sharma
                  </span>
                  <span className="flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-gabarito)] font-bold text-white bg-[#ed1a24]" style={{ width: 26, height: 26, borderRadius: 7, fontSize: 13 }}>
                    M
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 bg-[#f0eee9]" style={{ gap: 16, padding: 16 }}>
                  {/* LinkedIn skeleton */}
                  <div className="hidden sm:block bg-white border border-black/[0.06] overflow-hidden self-start" style={{ borderRadius: 12 }}>
                    <div className="bg-[#0a0a0a]" style={{ height: 56 }} />
                    <div style={{ padding: "0 16px 16px" }}>
                      <div
                        className="flex items-center justify-center bg-[#f0e6ea] border-[3px] border-white font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24] rounded-full"
                        style={{ width: 64, height: 64, marginTop: -32, fontSize: 20 }}
                      >
                        AS
                      </div>
                      <p className="font-[family-name:var(--font-gabarito)] font-bold text-black" style={{ fontSize: 16, margin: "10px 0 0" }}>Ananya Sharma</p>
                      <p className="text-[#4b4b4d]" style={{ fontSize: 11, margin: "4px 0 0", lineHeight: 1.5 }}>Product Manager · Building 0 to 1 products</p>
                      <p className="text-[#9c9c9c]" style={{ fontSize: 10, margin: "4px 0 0" }}>Pune, India · 500+ connections</p>
                      <div className="flex" style={{ gap: 8, marginTop: 12 }}>
                        <span className="rounded-full bg-[#0a0a0a] text-white font-semibold" style={{ fontSize: 11, padding: "6px 14px" }}>Connect</span>
                        <span className="rounded-full border border-[#9c9c9c] text-[#4b4b4d] font-semibold" style={{ fontSize: 11, padding: "6px 14px" }}>Message</span>
                      </div>
                      <div className="flex flex-col" style={{ gap: 7, marginTop: 16 }}>
                        <span className="rounded bg-[#eceaef]" style={{ height: 8, width: "100%" }} />
                        <span className="rounded bg-[#eceaef]" style={{ height: 8, width: "88%" }} />
                        <span className="rounded bg-[#eceaef]" style={{ height: 8, width: "94%" }} />
                        <span className="rounded bg-[#eceaef]" style={{ height: 8, width: "60%" }} />
                      </div>
                    </div>
                  </div>
                  {/* Merito HUB extension panel */}
                  <div className="bg-white border border-black/[0.08] overflow-hidden" style={{ borderRadius: 12, boxShadow: "0px 12px 36px rgba(17,35,89,0.10)" }}>
                    <div className="bg-[#ed1a24]" style={{ height: 5 }} />
                    <div style={{ padding: "14px 16px 16px" }}>
                      <div className="flex items-center justify-between">
                        <span className="font-[family-name:var(--font-gabarito)] font-bold text-black" style={{ fontSize: 15 }}>
                          Merito <span className="text-[#ed1a24]">HUB</span>
                        </span>
                        <span className="inline-flex items-center font-bold uppercase text-[#16803c] bg-[#eefdf1]" style={{ gap: 5, fontSize: 9, letterSpacing: "0.05em", borderRadius: 50, padding: "3px 9px" }}>
                          ✓ Verified
                        </span>
                      </div>
                      <p className="text-[#9c9c9c]" style={{ fontSize: 10, margin: "2px 0 0" }}>Injected by the Merito HUB extension</p>
                      <div className="bg-[#fdf8fb] text-[#4b4b4d]" style={{ marginTop: 10, borderRadius: 8, padding: "7px 10px", fontSize: 10.5 }}>
                        Hiring for: <strong className="text-black">Senior Product Manager</strong>
                      </div>
                      <div className="flex items-baseline justify-between" style={{ marginTop: 12 }}>
                        <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "1.9rem", lineHeight: 1 }}>
                          8.2<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "0.9rem" }}> / 10</span>
                        </span>
                        <span className="font-semibold text-[#4b4b4d]" style={{ fontSize: 10 }}>fit for this role</span>
                      </div>
                      <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 8, height: 8, borderRadius: 5 }}>
                        <div className="bg-[#ed1a24] h-full" style={{ width: "82%" }} />
                      </div>
                      {[
                        { l: "Personality-to-job", v: "Driver · 86%" },
                        { l: "Mock interview", v: "Strong · top 15%" },
                        { l: "References", v: "3 verified ✓", green: true },
                      ].map((row, i) => (
                        <div key={row.l} className="flex items-center justify-between" style={{ gap: 8, marginTop: i === 0 ? 12 : 7, paddingTop: i === 0 ? 10 : 0, borderTop: i === 0 ? "1px solid rgba(0,0,0,0.06)" : undefined }}>
                          <span className="text-[#4b4b4d]" style={{ fontSize: 10.5 }}>{row.l}</span>
                          <span className="font-bold" style={{ fontSize: 10.5, color: row.green ? "#16803c" : "#000" }}>{row.v}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <p className="font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 9, letterSpacing: "0.07em", margin: "0 0 8px" }}>Reference feedback</p>
                        {[
                          { l: "Communication", v: "4.6", w: "92%" },
                          { l: "Ownership", v: "4.4", w: "88%" },
                          { l: "Collaboration", v: "4.8", w: "96%" },
                          { l: "Reliability", v: "4.2", w: "84%" },
                        ].map((r) => (
                          <div key={r.l} className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
                            <span className="text-[#4b4b4d] flex-shrink-0" style={{ fontSize: 10, width: 82 }}>{r.l}</span>
                            <div className="flex-1 bg-[#f0e6ea] overflow-hidden" style={{ height: 5, borderRadius: 3 }}>
                              <div className="bg-[#ed1a24] h-full" style={{ width: r.w }} />
                            </div>
                            <span className="font-bold text-black text-right" style={{ fontSize: 10, width: 24 }}>{r.v}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-center font-bold text-white bg-[#ed1a24]" style={{ marginTop: 14, borderRadius: 8, padding: 10, fontSize: 11 }}>
                        View full Merito HUB profile →
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-center text-[#9c9c9c] border-t border-black/[0.06]" style={{ fontSize: 10, margin: 0, padding: "10px 16px" }}>
                  Illustrative mockup · sample candidate data. The extension shows only the candidate-approved, verified credential.
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ══════════ WHO IT'S FOR ══════════ */}
      <section className="bg-[#fdf8fb]" style={{ padding: "56px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
              <Eyebrow>Built For Every Stage</Eyebrow>
              <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: 0 }}>
                Whether it&apos;s your first job <span className="text-[#ed1a24]">or your next big move.</span>
              </h2>
            </div>
          </RevealOnScroll>
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 20, marginTop: 44 }}>
            {AUDIENCES.map((a, i) => (
              <RevealOnScroll key={a.title} delay={i * 0.08}>
                <Link
                  href={a.href}
                  className="group relative overflow-hidden bg-white flex flex-col h-full transition-transform duration-200 hover:-translate-y-1"
                  style={{ borderRadius: 8, boxShadow: "0px 4px 4px rgba(0,0,0,0.1)", padding: 28 }}
                >
                  <span
                    className="absolute top-0 right-0"
                    style={{ width: 0, height: 0, borderTop: "44px solid #ed1a24", borderLeft: "44px solid transparent" }}
                  />
                  <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: 0 }}>
                    {a.title}
                  </h3>
                  <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.7, margin: "12px 0 0" }}>
                    {a.body}
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] group-hover:text-[#c8151e]"
                    style={{ fontSize: 13, marginTop: "auto", paddingTop: 16 }}
                  >
                    See how it helps
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 17L17 7" /><path d="M9 7h8v8" /></svg>
                  </span>
                </Link>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" className="bg-white" style={{ padding: "56px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-start" style={{ gap: 52 }}>
            <RevealOnScroll>
              <div>
                <Eyebrow>How It Works</Eyebrow>
                <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "clamp(2rem,3.2vw,2.8rem)", lineHeight: 1.12, letterSpacing: "-0.03em", margin: "22px 0 0" }}>
                  From &ldquo;no idea where I stand&rdquo; to <span className="text-[#ed1a24]">&ldquo;shortlist-ready&rdquo;</span> in four steps.
                </h2>
                <a
                  href="#fit-checker"
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                  style={{ marginTop: 28, height: 52, padding: "0 28px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
                >
                  Start free
                  <ArrowChip />
                </a>
              </div>
            </RevealOnScroll>
            <RevealOnScroll delay={0.1}>
              <div className="flex flex-col relative" style={{ gap: 26, paddingLeft: 6 }}>
                <span className="absolute hidden sm:block" style={{ left: 27, top: 24, bottom: 24, width: 2, background: "rgba(237,26,36,0.2)" }} />
                {HOW_STEPS.map((h) => (
                  <div key={h.n} className="flex items-start relative" style={{ gap: 20, zIndex: 1 }}>
                    <span
                      className="flex items-center justify-center flex-shrink-0 bg-white border-2 border-[#ed1a24] font-[family-name:var(--font-gabarito)] font-bold rounded-full box-border"
                      style={{ width: 44, height: 44, fontSize: 15 }}
                    >
                      {h.n}
                    </span>
                    <div>
                      <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "8px 0 0" }}>
                        {h.title}
                      </h3>
                      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.65, margin: "6px 0 0", maxWidth: 440 }}>
                        {h.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" className="bg-[#fdf8fb]" style={{ padding: "56px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
              <Eyebrow>Simple, Honest Pricing</Eyebrow>
              <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: 0 }}>
                Start free. <span className="text-[#ed1a24]">Pay only when you&apos;re ready to go further.</span>
              </h2>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <div className="bg-white border border-black/[0.08] overflow-hidden mx-auto" style={{ maxWidth: 820, marginTop: 40, borderRadius: 24, boxShadow: "0px 18px 50px rgba(17,35,89,0.05)" }}>
              <div className="flex justify-between bg-[#0a0a0a]" style={{ padding: "16px 28px" }}>
                <span className="font-bold uppercase" style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)" }}>What you get</span>
                <span className="font-bold uppercase" style={{ fontSize: 12, letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)" }}>Price</span>
              </div>
              {PRICING.map((row, i) => (
                <div
                  key={row.name}
                  className="flex flex-col sm:flex-row sm:items-center justify-between"
                  style={{
                    gap: 8,
                    padding: row.highlight ? "16px 28px 16px 22px" : "16px 28px",
                    borderBottom: i < PRICING.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                    background: row.highlight ? "#fdf8fb" : undefined,
                    borderLeft: row.highlight ? "6px solid #ed1a24" : undefined,
                  }}
                >
                  <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
                    <span className="font-semibold text-black" style={{ fontSize: 15 }}>{row.name}</span>
                    {row.badge && (
                      <span className="font-bold uppercase text-[#ed1a24] bg-[#fdeced]" style={{ fontSize: 10, letterSpacing: "0.05em", borderRadius: 50, padding: "3px 10px" }}>
                        {row.badge}
                      </span>
                    )}
                  </div>
                  <span className="font-[family-name:var(--font-gabarito)] font-bold whitespace-nowrap sm:text-right" style={{ fontSize: 17, color: row.red ? "#ed1a24" : "#000" }}>
                    {row.price}
                  </span>
                </div>
              ))}
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={0.15}>
            <p className="text-center font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 14, margin: "22px 0 0" }}>
              No subscriptions. No lock-in. Check your fit for free - and add what helps, when it helps.
            </p>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="bg-white" style={{ padding: "56px 0" }}>
        <div className="max-w-[920px] mx-auto px-5">
          <RevealOnScroll>
            <div className="text-center" style={{ marginBottom: 36 }}>
              <Eyebrow>Frequently Asked Questions</Eyebrow>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <FaqAccordion />
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ TESTIMONIAL ══════════ */}
      <section className="bg-[#fdf8fb]" style={{ padding: "64px 0" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 items-center" style={{ gap: 52 }}>
              {/* Quote */}
              <div>
                <span className="inline-flex items-center font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24] bg-[#fdeced]" style={{ borderRadius: 50, padding: "6px 16px", fontSize: 11, letterSpacing: "0.04em" }}>
                  Candidate Story
                </span>
                <svg width="42" height="32" viewBox="0 0 42 32" fill="none" style={{ display: "block", margin: "22px 0 0" }} aria-hidden="true">
                  <path d="M0 32V19.2C0 8.6 6.8 1.4 17 0l2 5.2c-6 1.6-9.4 5.2-9.8 9.8H18V32H0Zm24 0V19.2C24 8.6 30.8 1.4 41 0l1 5.2c-6 1.6-9.4 5.2-9.8 9.8H42V32H24Z" fill="#ed1a24" />
                </svg>
                <blockquote className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "clamp(1.5rem,2.4vw,2.1rem)", letterSpacing: "-0.03em", lineHeight: 1.3, margin: "18px 0 0" }}>
                  I applied to 40 jobs and heard nothing. With my Merito profile, I got 3 interview calls in two weeks - and an offer for the exact role I wanted.
                </blockquote>
                <div className="flex items-center" style={{ gap: 14, marginTop: 26 }}>
                  <span className="flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24] bg-[#fdeced] rounded-full" style={{ width: 48, height: 48, fontSize: 17 }}>
                    RK
                  </span>
                  <div>
                    <p className="font-semibold text-black" style={{ fontSize: 15, margin: 0 }}>
                      Rahul K. <span className="font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.05em", marginLeft: 8 }}>Placeholder</span>
                    </p>
                    <p className="text-[#4b4b4d]" style={{ fontSize: 13, margin: "2px 0 0" }}>Placed as Product Analyst · Fitment score 8.4</p>
                  </div>
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
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="bg-white" style={{ padding: "8px 0 56px" }}>
        <div className="max-w-[1340px] mx-auto px-5">
          <RevealOnScroll>
            <div
              className="relative overflow-hidden text-center flex flex-col items-center"
              style={{
                background: "linear-gradient(to bottom right, #000, #1a1a1a, #2d0a0c)",
                borderRadius: 24,
                padding: "60px 24px",
                gap: 18,
              }}
            >
              <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(237,26,36,0.2), transparent)" }} />
              <span className="relative inline-flex items-center font-bold uppercase text-white bg-[#ed1a24]" style={{ borderRadius: 50, padding: "6px 16px", fontSize: 11, letterSpacing: "0.04em" }}>
                Ready?
              </span>
              <h2 className="relative font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.1, letterSpacing: "-0.03em", margin: 0, maxWidth: 760 }}>
                Stop wondering why. <span className="text-[#ed1a24]">Start getting shortlisted.</span>
              </h2>
              <p className="relative font-[family-name:var(--font-poppins)] font-medium" style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,0.75)", margin: 0, maxWidth: 640 }}>
                Your next application doesn&apos;t have to disappear into a stack of 500. Check your fitment score in 60 seconds - free - and see exactly where you stand for the job you want.
              </p>
              <div className="relative flex flex-wrap justify-center" style={{ gap: 12, marginTop: 8 }}>
                <a
                  href="#fit-checker"
                  className="inline-flex items-center justify-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors w-full sm:w-auto"
                  style={{ height: 52, padding: "0 26px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
                >
                  Check my fitment score - free
                </a>
                <ContactTrigger className="inline-flex items-center justify-center h-[52px] px-[26px] rounded-[8px] text-[16px] font-[family-name:var(--font-poppins)] font-semibold text-[rgba(255,255,255,0.85)] border border-[rgba(255,255,255,0.3)] w-full sm:w-auto transition-all hover:border-[#ed1a24] hover:text-[#ed1a24]">
                  Talk to a career expert
                </ContactTrigger>
              </div>
              <p className="relative" style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)", margin: "4px 0 0" }}>
                Free to start · No sign-up for your first score · Takes under 2 minutes
              </p>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </main>
  );
}
