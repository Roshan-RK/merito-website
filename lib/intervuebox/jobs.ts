import { intervueBoxFetch } from "./client";
import { durationForLevel, type CandidateLevel } from "./agents";
import { extractSkillsWithLLM, extractJobDetailsWithLLM } from "@/lib/claude/extractSkills";
import { logNewSkillsForReview } from "./learnedSkills";

export type CreateJobInput = {
  title: string;
  jobDescription: string;
  candidateLevel: CandidateLevel;
  resumeText?: string;
  skills?: string[];
};

type CreateJobResponse = {
  success: boolean;
  jobId: string;
};

// Live-confirmed against the real API (2026-07-23): `experience` is a free-text
// field, not an enum — any string is accepted. Pulling the years-of-experience
// mention straight out of the JD (when present) instead of a hardcoded
// "Not specified" placeholder lets IntervueBox's own experienceMatch scoring
// and interview calibration reflect the actual seniority the JD asks for.
const EXPERIENCE_PATTERN = /\d{1,2}\s*(?:-|to)\s*\d{1,2}\+?\s*years?|\d{1,2}\+?\s*years?\s*(?:of\s*)?(?:experience|exp)\b/i;

export function inferExperienceFromJD(jobDescription: string): string {
  const match = jobDescription.match(EXPERIENCE_PATTERN);
  return match ? match[0].trim() : "Not specified";
}

// IntervueBox's skill-wise interview report only evaluates skills actually
// passed at job creation (confirmed by their team, 2026-07-30) -- an empty
// `skills` array means an empty skill report. Spans both technical and
// non-technical roles since Merito's candidates aren't just engineers.
// This is only the FALLBACK path now (createJob tries extractSkillsWithLLM
// first) -- no fixed list can cover "every job in the world", so this just
// needs to be good enough for degraded mode, not exhaustive. Expanded
// 2026-08-01 with terms grounded in a real 11-JD sample spanning D2C
// marketing, design/video/AI tools, IT hardware sales, DevOps, civil/MEP
// engineering, and business analysis -- not guessed.
const SKILL_KEYWORDS = [
  "JavaScript", "TypeScript", "Python", "Java", "React", "Next.js", "Node.js",
  "SQL", "AWS", "Docker", "Kubernetes", "Go", "Rust", "C++", "C#", ".NET",
  "Angular", "Vue", "GraphQL", "REST API", "HTML", "CSS", "Git", "CI/CD",
  "Machine Learning", "Data Analysis", "Excel", "Power BI", "Tableau", "Salesforce",
  "MongoDB", "DevSecOps", "Disaster Recovery", "High Availability Architecture",
  "Networking", "Cloud Architecture",
  "Product Management", "Stakeholder Management", "Roadmap Planning", "Agile",
  "Scrum", "Project Management", "Market Research", "Pricing Strategy",
  "Go-To-Market", "A/B Testing", "User Research",
  "Sales", "Negotiation", "CRM", "Lead Generation", "Digital Marketing",
  "SEO", "Content Marketing", "Social Media Marketing",
  "Meta Ads", "Google Ads", "Shopify", "WooCommerce", "GA4", "ROAS",
  "Conversion Rate Optimization", "Lifecycle Marketing", "E-commerce",
  "Figma", "Adobe XD", "Sketch", "Photoshop", "Illustrator", "InDesign",
  "Adobe Premiere Pro", "After Effects", "CapCut", "DaVinci Resolve",
  "UI/UX Design", "Motion Graphics", "ChatGPT", "Midjourney",
  "Dell", "HPE", "Cisco", "VMware", "Nutanix", "Palo Alto Networks", "Fortinet",
  "Data Center Infrastructure", "Firewalls",
  "AutoCAD", "HVAC", "MEP", "Structural Engineering", "Technical Drawing",
  "Site Safety",
  "ERP", "SAP", "Inventory Management", "Warehouse Management", "Logistics",
  "Business Analysis",
  "Recruitment", "Talent Acquisition", "Onboarding", "Performance Management",
  "Employee Engagement", "HR Policies", "Payroll",
  "Communication", "Leadership", "Problem Solving", "Teamwork",
  "Time Management", "Critical Thinking", "Adaptability",
  "Financial Modeling", "Budgeting", "Forecasting", "Supply Chain",
  "Operations Management", "Vendor Management", "IT Governance",
  "Digital Transformation",
] as const;

// IntervueBox can only analyze a fixed number of skills per interview slot
// (vendor-confirmed by Krupal, 2026-07-31): 7 skills in a 30-min interview,
// 10 in a 45-min interview. Passing more than the slot supports just wastes
// the extra skills, so cap inference to match durationForLevel's slot.
const MAX_SKILLS_BY_DURATION: Record<30 | 45, number> = { 30: 7, 45: 10 };

export function maxSkillsForLevel(level: CandidateLevel): number {
  return MAX_SKILLS_BY_DURATION[durationForLevel(level)];
}

// Ranked by first-mention position in the JD, not keyword-list order --
// recruiters put must-have skills in a dedicated skills/requirements block
// near the top (after the About/intro boilerplate), while generic terms
// (communication, leadership) repeat throughout the prose. Sorting by
// position surfaces the deliberate, structural skills list instead of
// whatever happened to match first in SKILL_KEYWORDS.
export function inferSkillsFromJD(jobDescription: string, max: number): string[] {
  const matches: { skill: string; index: number }[] = [];
  for (const skill of SKILL_KEYWORDS) {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const match = pattern.exec(jobDescription);
    if (match) matches.push({ skill, index: match.index });
  }
  matches.sort((a, b) => a.index - b.index);
  return matches.slice(0, max).map((m) => m.skill);
}

// LLM extraction is primary (catches domain-specific tools no fixed list
// covers); keyword match is the fallback so a slow/failed/refused API call
// never blocks job creation. An empty LLM result is treated as a failure
// too, not "this JD truly has zero skills" -- IntervueBox's skill report
// depends on this list not being empty. Single call, no verification
// round-trip -- fitment-check's own requirement is least-possible-time.
async function resolveSkills(jobTitle: string, jobDescription: string, candidateLevel: CandidateLevel, resumeText?: string): Promise<string[]> {
  const max = maxSkillsForLevel(candidateLevel);
  try {
    const skills = await extractSkillsWithLLM(jobDescription, max, resumeText);
    if (skills.length === 0) throw new Error("LLM returned no skills");
    logNewSkillsForReview(skills, SKILL_KEYWORDS, jobTitle);
    return skills;
  } catch {
    return inferSkillsFromJD(jobDescription, max);
  }
}

export async function resolveJobDetails(
  jobTitleFallback: string,
  jobDescription: string,
  candidateLevel: CandidateLevel,
  resumeText?: string
): Promise<{ skills: string[]; title: string }> {
  const max = maxSkillsForLevel(candidateLevel);
  try {
    const { skills, title } = await extractJobDetailsWithLLM(jobDescription, max, resumeText, jobTitleFallback);
    if (skills.length === 0) throw new Error("LLM returned no skills");
    logNewSkillsForReview(skills, SKILL_KEYWORDS, jobTitleFallback);
    return { skills, title };
  } catch {
    return { skills: inferSkillsFromJD(jobDescription, max), title: jobTitleFallback };
  }
}

export async function createJob(input: CreateJobInput): Promise<{ ibJobId: string }> {
  const skills = input.skills ?? (await resolveSkills(input.title, input.jobDescription, input.candidateLevel, input.resumeText));
  const response = await intervueBoxFetch<CreateJobResponse>("/public/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      location: ["Remote"],
      jobType: "Full-time",
      industry: "General",
      designation: input.title,
      department: "General",
      openings: 1,
      jobDescription: input.jobDescription,
      skills,
      education: [],
      experience: inferExperienceFromJD(input.jobDescription),
      status: "ACTIVE",
    }),
  });
  return { ibJobId: response.jobId };
}
