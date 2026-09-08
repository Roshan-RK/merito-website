export type PersonaKey = "freshers" | "managers" | "leaders";

type OfferCard = { n: string; title: string; body: string };

export type PersonaContent = {
  key: PersonaKey;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroHeadlinePlain: string;
  heroHeadlineAccent: string;
  heroHeadlineTail: string;
  heroSub: string;
  challengeH2Plain: string;
  challengeH2Accent: string;
  challengeBody: string;
  whatYouGetH2Accent: string;
  offerCards: [OfferCard, OfferCard, OfferCard, OfferCard];
  coachingH2Plain: string;
  coachingH2Accent: string;
  coachingBody: string;
  linkedinH2Plain: string;
  linkedinH2Accent: string;
  linkedinBody: string;
  linkedinMetricLabel: string;
  linkedinMetricValue: string;
  linkedinProfileCaption: string;
  linkedinFitLabel: string;
  linkedinFitValue: string;
  testimonialEyebrow: string;
  testimonialQuote: string;
  testimonialInitials: string;
  testimonialName: string;
  testimonialOutcome: string;
  testimonialVideoLength: string;
  finalCtaHeadlinePlain: string;
  finalCtaHeadlineAccent: string;
  finalCtaBody: string;
};

export const PERSONAS: Record<PersonaKey, PersonaContent> = {
  freshers: {
    key: "freshers",
    metaTitle: "Merito HUB for Freshers - Land Your First Job & Stand Out",
    metaDescription:
      "No experience, no interviews, no idea which roles fit? Merito HUB scores your fit, prepares you with mock interviews, and builds a profile recruiters notice. Start free.",
    eyebrow: "For Freshers & Final-Year Students",
    heroHeadlinePlain: "Land your",
    heroHeadlineAccent: "FIRST JOB",
    heroHeadlineTail: "- and stand out from the thousand others applying for it.",
    heroSub:
      "Every entry-level role gets hundreds of near-identical CVs from people with the same degree and the same “eager to learn.” You've never sat an interview, and you're not even sure which jobs actually fit you. Merito HUB fixes all three - before you apply.",
    challengeH2Plain: "When everyone looks the same on paper,",
    challengeH2Accent: "“apply and hope” doesn't work.",
    challengeBody:
      "Fresh graduates don't lose out because they're not capable. They lose out because nothing on their CV tells a recruiter why them - and because their first interview is also their first-ever interview. You're competing blind, in a crowd, with no practice. That's the gap.",
    whatYouGetH2Accent: "first job.",
    offerCards: [
      { n: "1", title: "Apply to the right roles - not every role.", body: "Your fitment score tells you which job profiles you actually match, so you stop spraying 50 applications and start targeting the ones you can win." },
      { n: "2", title: "Find the roles that fit how you're wired.", body: "With no track record to point to, your personality fit is your edge. It shows which roles suit your strengths - real direction when you're starting from zero." },
      { n: "3", title: "Never interviewed? Walk into your first one having already done five mock interviews.", body: "Practise with a realistic mock interview as many times as you want, and get feedback on exactly what to fix - so your first real interview isn't your first interview at all." },
      { n: "4", title: "Invite references - credibility your CV can't carry alone.", body: "Ask professors, internship managers, or project guides to rate your soft skills. Verified, structured references on your profile - proof of how you work, when you don't yet have years to show for it." },
    ],
    coachingH2Plain: "Sit down with an expert who knows exactly what it takes to land",
    coachingH2Accent: "that first job.",
    coachingBody:
      "Book a one-on-one with a Merito career expert. They'll read your fitment, your personality fit, and your mock interview - then coach you on the things no one teaches you: which path to choose, how to present yourself with no experience, and how to turn that first interview into an offer. Think of it as coaching for your first dream job.",
    linkedinH2Plain: "Turn your thin LinkedIn profile into one recruiters",
    linkedinH2Accent: "actually notice.",
    linkedinBody:
      "Your Merito HUB profile becomes a shareable link and an extra layer on your LinkedIn. Recruiters hiring through Merito use our browser extension - so when they open your profile, they see your fit for the role and your verified strengths sitting right alongside it. For a fresher with a short profile, that added layer is the difference between being skipped and being shortlisted. You choose what's shown.",
    linkedinMetricLabel: "fit for this role",
    linkedinMetricValue: "8.2",
    linkedinProfileCaption: "A short profile - 6 months of internships",
    linkedinFitLabel: "Personality fit",
    linkedinFitValue: "Explorer · 84%",
    testimonialEyebrow: "Fresher Story",
    testimonialQuote:
      "I sent 60 applications in my final year and got two replies. My Merito profile showed recruiters I was more than a no-experience CV - I had my first offer within a month of graduating.",
    testimonialInitials: "PS",
    testimonialName: "Priya S.",
    testimonialOutcome: "2025 graduate · Placed as Business Analyst · Fitment score 8.1",
    testimonialVideoLength: "1:24",
    finalCtaHeadlinePlain: "Your first job shouldn't come down",
    finalCtaHeadlineAccent: "to luck.",
    finalCtaBody: "Check your fitment score in about 2 minutes - free - and find out which roles you can actually win.",
  },
  managers: {
    key: "managers",
    metaTitle: "Merito HUB for Mid-Level Professionals - Get Hired as a Manager",
    metaDescription:
      "Overlooked for management? Get a managerial readiness score employers can see, target the right step-up roles, and rehearse the manager interview. Start free.",
    eyebrow: "For Mid-Level Professionals",
    heroHeadlinePlain: "Get hired as a",
    heroHeadlineAccent: "MANAGER",
    heroHeadlineTail: "- not passed over as “just an individual contributor.”",
    heroSub:
      "You deliver. But when the manager roles open up, you get overlooked - because nothing shows employers you can lead a team, not just do the work. Merito HUB puts a number on your managerial readiness and gets it in front of the people hiring.",
    challengeH2Plain: "Your output is obvious.",
    challengeH2Accent: "Your managerial potential is invisible.",
    challengeBody:
      "The move from doer to leader is where most careers stall - not because the potential isn't there, but because there's no proof of it. Recruiters see a strong individual contributor and hire you for more of the same. To break out, you need evidence you can manage. Right now, you have none to show.",
    whatYouGetH2Accent: "management.",
    offerCards: [
      { n: "1", title: "Know which managerial roles you're actually ready for.", body: "Your fitment score maps you against management roles - not just the next lateral IC move - so you aim at the step-up jobs you can credibly win." },
      { n: "2", title: "Get a Managerial Readiness score employers can see.", body: "Your personality assessment includes a Managerial Readiness Test that scores you on how you'd perform as a manager - turning “I think I'm ready to lead” into evidence a prospective employer can trust." },
      { n: "3", title: "Rehearse the manager's interview - it's a different game.", body: "Manager interviews test people decisions, prioritisation, and stakeholder handling, not just your craft. Practise that exact conversation with a mock interview and detailed feedback before you're in the room." },
      { n: "4", title: "Invite references - let others vouch for the leader in you.", body: "Ask managers, peers, and people you've mentored to rate your soft skills. Verified, structured references that show ownership and people skills - the exact evidence a step-up role demands." },
    ],
    coachingH2Plain: "Work with an expert who knows how to make the",
    coachingH2Accent: "doer-to-leader leap land.",
    coachingBody:
      "Book a one-on-one with a Merito career expert. They'll read your fitment, your managerial readiness, and your mock interview - then coach you on the leap itself: what managerial hiring managers look for, how to reframe your story from “I did the work” to “I led the outcome,” and how to interview like the manager you're ready to be. Coaching for your managerial dream job.",
    linkedinH2Plain: "Let recruiters see the manager in you -",
    linkedinH2Accent: "right on your LinkedIn.",
    linkedinBody:
      "Your Merito HUB profile becomes a shareable link and an extra layer on your LinkedIn. Recruiters hiring through Merito use our browser extension - so when they open your profile, they see your fit for the role and your managerial readiness score alongside it. That's proof of leadership potential, sitting exactly where hiring decisions get made. You choose what's shown.",
    linkedinMetricLabel: "managerial readiness",
    linkedinMetricValue: "7.9",
    linkedinProfileCaption: "A strong IC profile - 5 years of delivery",
    linkedinFitLabel: "Fit for this role",
    linkedinFitValue: "8.1 / 10",
    testimonialEyebrow: "Doer-to-Leader Story",
    testimonialQuote:
      "I was passed over for team lead twice - “great IC, not ready to manage.” My managerial readiness score gave them the evidence my CV couldn't. I'm now managing a team of six.",
    testimonialInitials: "AM",
    testimonialName: "Arjun M.",
    testimonialOutcome: "6 years as IC · Hired as Engineering Manager · Managerial readiness 7.9",
    testimonialVideoLength: "1:41",
    finalCtaHeadlinePlain: "Stop being hired for what you do.",
    finalCtaHeadlineAccent: "Get hired for what you can lead.",
    finalCtaBody: "Check your fitment score in about 2 minutes - free - and see which manager roles you're ready for.",
  },
  leaders: {
    key: "leaders",
    metaTitle: "Merito HUB for Senior Leaders - Make the Leap to the C-Suite",
    metaDescription:
      "Aiming for a CXO role? Make your leadership readiness visible with a leadership assessment, benchmark your fit, and prepare for board-level interviews. Start free.",
    eyebrow: "For Senior Leaders",
    heroHeadlinePlain: "Make the leap to the",
    heroHeadlineAccent: "C-SUITE",
    heroHeadlineTail: "- and prove you belong there.",
    heroSub:
      "You've earned the years and the results. But CXO roles don't go to the most tenured - they go to whoever most clearly signals they can lead at that level. After a long run in the same seat, that signal is exactly what's hard to show. Merito HUB makes your leadership readiness visible.",
    challengeH2Plain: "Tenure gets you considered.",
    challengeH2Accent: "CXO traits get you chosen.",
    challengeBody:
      "When a senior manager goes up for a CXO role, the board isn't asking whether you can do the job you have - they're asking whether the leadership traits are visibly there. After years in one role, most strong leaders struggle to differentiate: the experience is real, but nothing surfaces the C-suite readiness underneath it. That's the gap between “impressive CV” and “next CXO.”",
    whatYouGetH2Accent: "leadership.",
    offerCards: [
      { n: "1", title: "See how ready you really are for a leadership role.", body: "Your fitment score benchmarks you against leadership and CXO roles - a clear, honest read on where you stand and what still needs to show." },
      { n: "2", title: "Make your CXO traits visible with a Leadership Assessment.", body: "Your personality assessment includes a leadership readiness evaluation that surfaces the traits a board looks for in a CXO - so a hiring CEO or promoter sees leadership evidence, not just a long tenure." },
      { n: "3", title: "Rehearse the leadership interview - vision, not tasks.", body: "Leadership interviews test narrative, judgement, and how you think about the whole business. Practise that conversation with a mock interview and sharp feedback, so you walk into the boardroom fluent." },
      { n: "4", title: "Invite references - verified word from people who've seen you lead.", body: "Ask CEOs, board members, and senior peers to rate how you lead. At this level, a credible, verified reference carries more weight than anything you can write about yourself." },
    ],
    coachingH2Plain: "Sit with an expert who understands what it takes to move into",
    coachingH2Accent: "the C-suite.",
    coachingBody:
      "Book a one-on-one with a senior Merito career expert. They'll read your fitment, your leadership assessment, and your mock interview - then coach you on the transition itself: the positioning that signals CXO, the gaps to close before you're in the room, and how to interview at board level. Coaching for your leadership dream job.",
    linkedinH2Plain: "Make your leadership readiness visible -",
    linkedinH2Accent: "right where decision-makers look.",
    linkedinBody:
      "Your Merito HUB profile becomes a shareable link and an extra layer on your LinkedIn. Recruiters and hiring boards working with Merito use our browser extension - so when they open your profile, they see your fit for the role and your leadership readiness alongside it. At this level, being able to point to a credible, verified signal of C-suite readiness is a genuine differentiator. You choose what's shown.",
    linkedinMetricLabel: "leadership readiness",
    linkedinMetricValue: "8.3",
    linkedinProfileCaption: "18 years of experience - one long tenure",
    linkedinFitLabel: "Fit for this role",
    linkedinFitValue: "8.6 / 10",
    testimonialEyebrow: "Leadership Story",
    testimonialQuote:
      "After 16 years in one company, every conversation started with my tenure - not my leadership. The leadership assessment changed that conversation. Three months later, I signed as CPO.",
    testimonialInitials: "SD",
    testimonialName: "Sunita D.",
    testimonialOutcome: "16 years · Joined a growth-stage startup as CPO · Leadership readiness 8.3",
    testimonialVideoLength: "2:05",
    finalCtaHeadlinePlain: "The corner office goes to whoever proves they're ready.",
    finalCtaHeadlineAccent: "Prove it.",
    finalCtaBody: "Check your fitment score in about 2 minutes - free - and see how you stand against leadership roles.",
  },
};
