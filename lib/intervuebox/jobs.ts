import { intervueBoxFetch } from "./client";

export type CreateJobInput = {
  title: string;
  jobDescription: string;
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
// Not exhaustive by design -- a fixed keyword list can't be, so this is a
// best-effort match against common terms, not a claim of completeness.
const SKILL_KEYWORDS = [
  "JavaScript", "TypeScript", "Python", "Java", "React", "Next.js", "Node.js",
  "SQL", "AWS", "Docker", "Kubernetes", "Go", "Rust", "C++", "C#", ".NET",
  "Angular", "Vue", "GraphQL", "REST API", "HTML", "CSS", "Git", "CI/CD",
  "Machine Learning", "Data Analysis", "Excel", "Power BI", "Tableau", "Salesforce",
  "Product Management", "Stakeholder Management", "Roadmap Planning", "Agile",
  "Scrum", "Project Management", "Market Research", "Pricing Strategy",
  "Go-To-Market", "A/B Testing", "User Research",
  "Sales", "Negotiation", "CRM", "Lead Generation", "Digital Marketing",
  "SEO", "Content Marketing", "Social Media Marketing",
  "Recruitment", "Talent Acquisition", "Onboarding", "Performance Management",
  "Employee Engagement", "HR Policies", "Payroll",
  "Communication", "Leadership", "Problem Solving", "Teamwork",
  "Time Management", "Critical Thinking", "Adaptability",
  "Financial Modeling", "Budgeting", "Forecasting", "Supply Chain",
  "Operations Management", "Vendor Management",
] as const;

const MAX_INFERRED_SKILLS = 15;

export function inferSkillsFromJD(jobDescription: string, max = MAX_INFERRED_SKILLS): string[] {
  const found: string[] = [];
  for (const skill of SKILL_KEYWORDS) {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(jobDescription)) {
      found.push(skill);
      if (found.length >= max) break;
    }
  }
  return found;
}

export async function createJob(input: CreateJobInput): Promise<{ ibJobId: string }> {
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
      skills: inferSkillsFromJD(input.jobDescription),
      education: [],
      experience: inferExperienceFromJD(input.jobDescription),
      status: "ACTIVE",
    }),
  });
  return { ibJobId: response.jobId };
}
