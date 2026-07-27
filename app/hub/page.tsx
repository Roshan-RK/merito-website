import type { Metadata } from "next";
import Link from "next/link";
import ContactTrigger from "@/components/ContactTrigger";
import RevealOnScroll from "@/components/anim/RevealOnScroll";
import { getAbsoluteUrl } from "@/lib/site";
import FitmentChecker from "./FitmentChecker";
import ProblemCards from "./ProblemCards";
import FaqAccordion from "./FaqAccordion";
import TestimonialCarousel from "./TestimonialCarousel";
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
  { num: 60, prefix: "", suffix: " seconds", label: "to your first fitment score" },
  { num: 0, prefix: "₹", suffix: "", label: "to start" },
];

const OFFERINGS = [
  { n: "1", name: "CV Fitment", tag: "Free · No sign-up", free: true, span: 2, feature: "Instant fitment score against the exact job you're targeting.", benefit: "You know precisely where you stand, no more guessing why an application went quiet.", body: "You either apply with confidence, or you fix the gap before you do - either way, you stop wasting applications.", cta: "Check my fitment - free", href: "#fit-checker" },
  { n: "2", name: "Personality Fitment", tag: "Builds your profile", free: false, span: 2, feature: "A structured assessment mapping your working style to the role.", benefit: "Recruiters hire for fit, not just skill - now they can see yours, not just guess at it in an interview.", body: "You get considered for roles where “will they fit the team” was the real, unspoken question.", cta: "Discover my fit", href: "#fit-checker" },
  { n: "3", name: "Mock AI Interview", tag: "Builds your profile", free: false, span: 2, feature: "A realistic 30-minute AI interview, on demand, with a full performance report.", benefit: "You find your weak answers in a practice room, not the real one.", body: "You walk into the actual interview already knowing what you're strong at and what to say differently.", cta: "Practise my interview", href: "#fit-checker" },
  { n: "4", name: "References Feedback", tag: "Builds your profile", free: false, span: 3, feature: "Structured feedback from managers, peers, or clients who've actually worked with you.", benefit: "Your soft skills are vouched for by someone else, not just claimed by you.", body: "A hiring manager gets the one kind of proof a CV genuinely cannot fake.", cta: "Invite my references", href: "#fit-checker" },
  { n: "5", name: "1:1 Expert Guidance", tag: "1:1 guidance", free: false, span: 3, feature: "A real career expert who's already read your fitment, personality, and interview results.", benefit: "You get a specific plan, not generic advice, because they're working from your actual data.", body: "You stop guessing what to fix next and start acting on it.", cta: "Book my expert session", href: "#fit-checker" },
];

const PROFILE_CHIPS = ["Fitment to the role", "Personality-to-job map", "Verified references", "Mock interview standing", "Key strengths"];

const EXT_POINTS = [
  { n: "1", head: "Your fit for their role", body: "a clear summary of how well you match the exact job they're hiring for." },
  { n: "2", head: "Your personality, mapped to the job", body: "how your working style fits what the role needs." },
  { n: "3", head: "Your references, summarised", body: "the verdict of people who've actually worked with you, in one glance." },
  { n: "4", head: "Your mock interview performance", body: "the outcome of the assessment interview before they shortlisted you." },
];

const AUDIENCES = [
  { title: "Students & Freshers", body: "No track record yet to point to. Show fit, personality, and potential, not just a blank work history - a fitment score and a verified profile give recruiters something concrete to evaluate you on.", cta: "See how it helps freshers", href: "/hub/freshers" },
  { title: "Mid-Level Professionals", body: "Delivering consistently, but stuck for the next step up. Turn “I think I'm ready” into evidence an employer can actually trust - a managerial and role-fitment score proves readiness a CV full of past output never can.", cta: "See how it helps professionals", href: "/hub/managers" },
  { title: "Senior & Leadership", body: "Moving quietly, on your own terms, without tipping your hand. A sharp, credible, fully discreet profile reaches the right people without broadcasting that you're open - you control exactly what's visible and to whom.", cta: "See how it helps leaders", href: "/hub/leaders" },
];

const HOW_STEPS = [
  { n: "1", title: "Check your fit - free.", body: "Upload your CV, name your target job, get your score in a minute." },
  { n: "2", title: "See what to fix.", body: "Sign in for the full report - strengths, gaps, and how to improve your CV." },
  { n: "3", title: "Build your profile.", body: "Add your personality test, mock interview, and references." },
  { n: "4", title: "Apply and get found.", body: "Send your one-page profile with every application - and let recruiters discover you on LinkedIn." },
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
        #fit-checker, #how-it-works { scroll-margin-top: 110px; }
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
                  Your CV says what you did. <span className="text-[#ed1a24]">Merito HUB proves what you&apos;re worth.</span>
                </h1>
                <p
                  className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]"
                  style={{ fontSize: 18, lineHeight: 1.65, margin: "20px 0 0", maxWidth: 540 }}
                >
                  Whether you&apos;re applying for your first job, pushing for your next promotion, or making a quiet move to something bigger, Merito HUB scores your fit, shows you what to fix, and gets that proof in front of the people deciding.
                </p>
                <div className="flex flex-wrap items-center" style={{ gap: 12, marginTop: 28 }}>
                  <a
                    href="#fit-checker"
                    className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors w-full sm:w-auto justify-center"
                    style={{ height: 52, padding: "0 26px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
                  >
                    Check my fitment score - free
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
              You&apos;re not being rejected. <span className="text-[#ed1a24]">You&apos;re being unseen.</span>
            </h2>
            <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 18, lineHeight: 1.7, margin: "18px 0 0", maxWidth: 840 }}>
              The visibility problem looks different at every stage, but no job board has ever solved it at any of them.
            </p>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#0a0a0a]" style={{ fontSize: 18, lineHeight: 1.7, margin: "14px 0 0", maxWidth: 840 }}>
              That&apos;s not a you problem. That&apos;s a visibility problem - and it&apos;s the one thing no job board has ever solved.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1}>
            <div style={{ marginTop: 40 }}>
              <ProblemCards />
            </div>
            <div className="flex justify-center" style={{ marginTop: 36 }}>
              <a
                href="#fit-checker"
                className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                style={{ height: 52, padding: "0 28px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
              >
                Check my fitment score - free
                <ArrowChip />
              </a>
            </div>
          </RevealOnScroll>
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
                Everything that turns <span className="text-[#ed1a24]">&ldquo;applied&rdquo;</span> into <span className="text-[#ed1a24]">&ldquo;shortlisted.&rdquo;</span>
              </h2>
              <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 18, lineHeight: 1.65, margin: 0, maxWidth: 820 }}>
                Five tools. One profile. Built once, used everywhere you apply.
              </p>
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
                  <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 0" }}>
                    {o.feature}
                  </p>
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
                Every one of these rolls into one recruiter-ready Merito profile, attached to your application, and visible to recruiters on LinkedIn - working for you before the interview has even started.
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
              <a
                href="#fit-checker"
                className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                style={{ marginTop: 10, height: 52, padding: "0 28px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
              >
                Build my profile
                <ArrowChip />
              </a>
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
                  Get discovered on LinkedIn. <span className="text-[#ed1a24]">Not filtered out of it.</span>
                </h2>
                <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 16, lineHeight: 1.7, margin: "16px 0 0" }}>
                  No resume builder, job board, or LinkedIn add-on does this: recruiters hiring through Merito see your fitment score, personality-to-role map, references, and interview standing right on your LinkedIn profile, at the exact moment they&apos;re deciding whether to reach out.
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 15, lineHeight: 1.7, margin: "14px 0 0" }}>
                  This is the one thing on this page you can&apos;t get anywhere else. When a recruiter hiring through Merito opens your profile, our browser extension shows them what a resume can&apos;t: how you match this specific role, how your working style fits the team, what three people who&apos;ve worked with you actually said, and how you performed in a real mock interview.
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
                    <strong className="text-black">You choose what&apos;s shown. Always.</strong> Your Merito credential displays only the verified, approved information you&apos;ve chosen to share - never raw scores, never your gaps, and never a signal to anyone you haven&apos;t chosen to show it to. That&apos;s true on your very first job search, and it&apos;s just as true on your quietest, most selective move.
                  </p>
                </div>
                <a
                  href="#fit-checker"
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                  style={{ marginTop: 24, height: 52, padding: "0 26px", borderRadius: 8, fontSize: 16, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
                >
                  Build my profile free to start
                  <ArrowChip />
                </a>
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
                Built for every stage <span className="text-[#ed1a24]">of the climb.</span>
              </h2>
              <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 18, lineHeight: 1.65, margin: 0, maxWidth: 820 }}>
                Different stage, different proof needed. Merito HUB adapts to where you actually are.
              </p>
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
                    {a.cta}
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 17L17 7" /><path d="M9 7h8v8" /></svg>
                  </span>
                </Link>
              </RevealOnScroll>
            ))}
          </div>
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
            <TestimonialCarousel />
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
                Stop wondering why. <span className="text-[#ed1a24]">Start being chosen.</span>
              </h2>
              <p className="relative font-[family-name:var(--font-poppins)] font-medium" style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,0.75)", margin: 0, maxWidth: 640 }}>
                Whether it&apos;s your first offer or your next big move, it starts with knowing exactly where you stand.
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
