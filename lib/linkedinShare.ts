export type ShareSection = "fitment" | "personality" | "interview" | "references";

const SECTION_ORDER: ShareSection[] = ["fitment", "personality", "interview", "references"];

const SECTION_PHRASES: Record<ShareSection, string> = {
  fitment: "AI-matched CV fitment",
  personality: "a Big Five personality profile",
  interview: "a proctored AI video interview",
  references: "verified peer references",
};

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "a verified assessment";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function buildLinkedInCaption({
  roleTitle,
  sections,
  hubUrl,
}: {
  roleTitle: string;
  sections: ShareSection[];
  hubUrl: string;
}): string {
  const orderedPhrases = SECTION_ORDER.filter((s) => sections.includes(s)).map((s) => SECTION_PHRASES[s]);
  const assessmentList = joinWithAnd(orderedPhrases);

  return [
    `Just completed my verified candidate profile on Merito HUB — ${roleTitle} readiness assessed through ${assessmentList}, all in one place.`,
    `Merito HUB turns scattered credentials into a single, evidence-backed profile recruiters can actually trust — no more just a CV and a hope.`,
    `Check it out and see how it works: ${hubUrl}`,
  ].join("\n\n");
}
