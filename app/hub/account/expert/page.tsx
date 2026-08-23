import { redirect } from "next/navigation";
import Image from "next/image";
import {
  Quote,
  GraduationCap,
  UserCheck,
  Target,
  Rocket,
  Briefcase,
  Shuffle,
  BookOpen,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { DEFAULT_LEVEL, PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import ExpertBookingCard from "./ExpertBookingCard";
import ExpertBookingButton from "./ExpertBookingButton";

// Static bio + section content, verbatim from mockups/merito-dashboard-v34.html's
// expert-guidance page (minified component `fz`). No live data for the bio itself --
// only the booking cards (ExpertBookingCard) are wired to real state.
const NAME = "Rushikesh Humbe";
const TITLE = "Strategy & Growth Advisor";
const CREDENTIALS = "20+ years in strategy consulting & workforce development · COEP & IIM Ahmedabad";
const STATS = [
  { label: "Candidates coached", value: "600+" },
  { label: "Avg. rating", value: "4.9★" },
  { label: "Years experience", value: "20" },
];
const BIO =
  "Rushikesh spent two decades in strategy consulting and workforce development, including employability programs adopted nationwide, before bringing that lens to individual candidates. He reads your fitment report, personality results, and mock interview the way he'd assess talent for a growth strategy: where's the real leverage, and what's the fastest path to it.";
const TESTIMONIAL =
  "Rushikesh didn't just point out what was wrong with my resume. He explained why it mattered from a hiring manager's perspective. That reframing got me two callbacks the next week.";
const TESTIMONIAL_ATTRIBUTION = "Priya S., hired as DevOps Engineer";

const PERSPECTIVE_CARDS = [
  {
    icon: GraduationCap,
    tag: "Career mentor",
    text: "Understands the confusion students face while choosing what to do next.",
  },
  {
    icon: UserCheck,
    tag: "Recruiter & HR leader",
    text: "Understands what companies actually look for beyond a resume.",
  },
  {
    icon: Target,
    tag: "Strategy consultant",
    text: "Knows how to evaluate choices, trade-offs and long-term career paths.",
  },
  {
    icon: Rocket,
    tag: "Entrepreneur & advisor",
    text: "Understands how careers evolve as industries, businesses and technology change.",
  },
];

const SESSION_STEPS = [
  {
    num: "01",
    title: "Understand where you stand",
    text: "An outside perspective on your current profile, strengths, gaps and career positioning. You may already have the potential. You may just be looking at it from the wrong angle.",
  },
  {
    num: "02",
    title: "Get clarity on your career direction",
    text: "Discuss your options: higher studies, your first job, a career switch, entrepreneurship, consulting, tech & AI, sales, HR, and understand the trade-offs, instead of deciding on trends or peer pressure.",
  },
  {
    num: "03",
    title: "Understand what employers actually look for",
    text: "Get perspective on how hiring decisions really get made, from skills and positioning through to your resume, interviews and career growth.",
  },
  {
    num: "04",
    title: "Identify your career gaps",
    text: "Sometimes the problem isn't your career choice. It's the gap between where you are and what your target role requires.",
  },
  {
    num: "05",
    title: "Build your next-step action plan",
    text: "Leave with clarity on what to do next, what to stop doing, what to learn, what to prioritise, and what to target.",
  },
];

const WHO_FOR_CARDS = [
  {
    icon: GraduationCap,
    question: "I'm a student and I have no idea what career I should choose.",
    answer: "Get an experienced perspective before spending years heading in the wrong direction.",
  },
  {
    icon: Briefcase,
    question: "I have a degree, but I'm not getting the opportunities I expected.",
    answer: "Understand what's missing between your qualification and your employability.",
  },
  {
    icon: Shuffle,
    question: "Should I switch careers?",
    answer: "Evaluate your options before making a high-impact decision.",
  },
  {
    icon: Rocket,
    question: "I want to move into a better role.",
    answer: "Understand what your target role demands and how to position yourself for it.",
  },
  {
    icon: BookOpen,
    question: "Should I do an MBA / higher studies?",
    answer: "Get a practical perspective on whether further education makes sense for your career goals.",
  },
  {
    icon: Compass,
    question: "I know I want to grow, but I don't know what to do next.",
    answer: "Sometimes you don't need another course. You need clarity.",
  },
];

const CREDENTIAL_CARDS = [
  { num: "20+ Years", label: "Strategy, consulting, HR, entrepreneurship & workforce development" },
  { num: "40,000+", label: "Students & parents reached through Career Corner" },
  { num: "IIM Ahmedabad", label: "MBA, Business Management" },
  { num: "COEP", label: "BE, Electronics & Telecommunication" },
  { num: "Deloitte", label: "Strategy & operations consulting for Fortune 100 clients" },
  { num: "Former VP-HR", label: "Helped Merkle Sokrati scale from 300 to 1,300 employees" },
  { num: "Govt. of Maharashtra", label: "Youth employability & internship initiatives" },
  { num: "Founder", label: "Merito & Career Corner" },
];

const PREP_CHECKLIST = [
  "Your current resume / LinkedIn profile",
  "Your career goal, even if it's unclear",
  "2-3 questions you're currently struggling with",
  "Any specific career decision you're considering",
];

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";
const SECTION_EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]";
const CARD = "bg-[#141416] border border-white/[0.08]";

export default async function ExpertBioPage({
  searchParams,
}: {
  searchParams: { lead?: string };
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads?.length) {
    redirect("/hub/account");
  }

  const leadIdParam = searchParams.lead;
  const activeLead = leadIdParam
    ? leads.find(l => l.id === leadIdParam) || leads[0]
    : leads[0];

  const level = (activeLead.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
  const priceLabel = formatPrice(PRODUCT_PRICING.counselling[level]);

  const { data: counsellingRequest } = await supabase
    .from("counselling_requests")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const firstName = NAME.split(" ")[0];

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 1040, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 40 }}>
        <div>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Expert guidance
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0, lineHeight: 1.25 }}>
            Stop guessing. Get clarity from someone who&apos;s seen careers from both sides.
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: "8px 0 0" }}>
            A 1:1 session with a Merito career expert.
          </p>
        </div>

        <div className="flex flex-col" style={{ gap: 20 }}>
          <div className={CARD} style={{ borderRadius: 20, padding: 24 }}>
            <div className="flex items-start flex-wrap" style={{ gap: 16, marginBottom: 20 }}>
              <div
                className="relative overflow-hidden shrink-0 border border-[#ed1a24]/30"
                style={{ width: 64, height: 64, borderRadius: "50%" }}
              >
                <Image src="/about-us-audit/founder-image.png" alt={NAME} fill sizes="64px" style={{ objectFit: "cover" }} />
              </div>
              <div>
                <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 17, margin: 0 }}>
                  {NAME}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, margin: "2px 0 0" }}>
                  {TITLE}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12, margin: "4px 0 0" }}>
                  {CREDENTIALS}
                </p>
              </div>
            </div>

            <div
              className="grid grid-cols-3 divide-x divide-white/[0.08] border border-white/[0.08]"
              style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", marginBottom: 20 }}
            >
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center" style={{ padding: "12px 8px" }}>
                  <p className="font-[family-name:var(--font-gabarito)] font-semibold text-[#ed1a24]" style={{ fontSize: 18, margin: 0 }}>
                    {stat.value}
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 10.5, lineHeight: 1.3, margin: "2px 0 0" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 20px" }}>
              {BIO}
            </p>

            <div className="border border-white/[0.08]" style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", padding: 16 }}>
              <Quote size={16} strokeWidth={2} className="text-[#ed1a24]" style={{ marginBottom: 6 }} />
              <p className="font-[family-name:var(--font-poppins)] italic text-white/75" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                &quot;{TESTIMONIAL}&quot;
              </p>
              <p className="font-[family-name:var(--font-poppins)] font-semibold text-white/40" style={{ fontSize: 11.5, margin: "8px 0 0" }}>
                {TESTIMONIAL_ATTRIBUTION}
              </p>
            </div>
          </div>

          <ExpertBookingCard firstName={firstName} priceLabel={priceLabel} initialRequested={Boolean(counsellingRequest)} />
        </div>

        {/* Why his perspective is different */}
        <div>
          <p className={SECTION_EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Why his perspective is different
          </p>
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.35rem", margin: "0 0 8px" }}>
            He&apos;s sat on both sides of the table
          </h2>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 18px" }}>
            Most career advice comes from one side of the table. {firstName} has worked all of them.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            {PERSPECTIVE_CARDS.map(({ icon: Icon, tag, text }) => (
              <div key={tag} className={CARD} style={{ borderRadius: 14, padding: 18 }}>
                <div
                  className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24]"
                  style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 12 }}
                >
                  <Icon size={18} strokeWidth={2} />
                </div>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13.5, margin: "0 0 4px" }}>
                  {tag}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* What you'll get */}
        <div>
          <p className={SECTION_EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            What you&apos;ll get
          </p>
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.35rem", margin: "0 0 8px" }}>
            Your 30-minute session, step by step
          </h2>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 18px" }}>
            Not a generic career advice call. It&apos;s built around your background, ambitions, strengths and current position.
          </p>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {SESSION_STEPS.map((step) => (
              <div key={step.num} className={CARD} style={{ borderRadius: 14, padding: 18, display: "flex", gap: 14 }}>
                <span
                  className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]/40 shrink-0"
                  style={{ fontSize: 22, lineHeight: 1 }}
                >
                  {step.num}
                </span>
                <div>
                  <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13.5, margin: "0 0 4px" }}>
                    {step.title}
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Who is this session for */}
        <div>
          <p className={SECTION_EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Who is this session for
          </p>
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.35rem", margin: "0 0 18px" }}>
            If you&apos;re asking yourself any of these, this session is for you
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            {WHO_FOR_CARDS.map(({ icon: Icon, question, answer }) => (
              <div key={question} className={CARD} style={{ borderRadius: 14, padding: 18 }}>
                <div
                  className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24]"
                  style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 12 }}
                >
                  <Icon size={18} strokeWidth={2} />
                </div>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13.5, lineHeight: 1.5, margin: "0 0 6px" }}>
                  {question}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                  {answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Why {firstName} */}
        <div>
          <p className={SECTION_EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Why {firstName}
          </p>
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.35rem", margin: "0 0 18px" }}>
            20+ years. Multiple industries. One career perspective.
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
            {CREDENTIAL_CARDS.map((card) => (
              <div key={card.num} className={CARD} style={{ borderRadius: 14, padding: 16 }}>
                <p className="font-[family-name:var(--font-gabarito)] font-semibold text-[#ed1a24]" style={{ fontSize: 15, margin: "0 0 6px" }}>
                  {card.num}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
                  {card.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Come prepared */}
        <div>
          <p className={SECTION_EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Come prepared
          </p>
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.35rem", margin: "0 0 8px" }}>
            What should you bring?
          </h2>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 18px" }}>
            No need to have everything figured out. That&apos;s exactly why the session exists.
          </p>
          <div className={CARD} style={{ borderRadius: 14, padding: 8 }}>
            {PREP_CHECKLIST.map((item, i) => (
              <div
                key={item}
                className="flex items-center"
                style={{
                  gap: 12,
                  padding: "12px 12px",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <CheckCircle2 size={17} strokeWidth={2} className="text-[#ed1a24] shrink-0" />
                <p className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 13, margin: 0 }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Closing CTA */}
        <div
          className="border border-[#ed1a24]/30 text-center"
          style={{ background: "linear-gradient(to bottom right, #1a0507, #141416)", borderRadius: 20, padding: "32px 24px" }}
        >
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.35rem", margin: "0 0 8px" }}>
            Your career doesn&apos;t need more noise. It needs better decisions.
          </h2>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
            30 minutes, video call, personalised guidance.
          </p>
          <ExpertBookingButton priceLabel={priceLabel} initialRequested={Boolean(counsellingRequest)} />
          <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11.5, margin: "12px 0 0" }}>
            30-minute 1:1 session · {priceLabel}
          </p>
        </div>
      </div>
    </main>
  );
}
