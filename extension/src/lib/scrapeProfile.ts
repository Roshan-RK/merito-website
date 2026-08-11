import type { ScrapedCandidateFields } from "../../../shared/recruiter-preview/types";

function textOf(el: Element | null): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function sectionByAnchor(anchorId: string): Element | null {
  const anchor = document.getElementById(anchorId);
  return anchor?.closest("section") ?? anchor?.parentElement ?? null;
}

function scrapeExperience(): ScrapedCandidateFields["experience"] {
  const section = sectionByAnchor("experience");
  if (!section) return [];
  return Array.from(section.querySelectorAll("li"))
    .map((li) => {
      const lines = textOf(li).split(" · ");
      return {
        title: lines[0] || "",
        company: lines[1] || "",
        duration: lines[2] || "",
        description: textOf(li),
      };
    })
    .filter((exp) => exp.title.length > 0)
    .slice(0, 10);
}

function scrapeEducation(): ScrapedCandidateFields["education"] {
  const section = sectionByAnchor("education");
  if (!section) return [];
  return Array.from(section.querySelectorAll("li"))
    .map((li) => {
      const lines = textOf(li).split(" · ");
      return { school: lines[0] || "", degree: lines[1] || "", duration: lines[2] || "" };
    })
    .filter((edu) => edu.school.length > 0)
    .slice(0, 5);
}

function scrapeSkills(): string[] {
  const section = sectionByAnchor("skills");
  if (!section) return [];
  return Array.from(section.querySelectorAll("span[aria-hidden='true']"))
    .map((el) => textOf(el))
    .filter(Boolean)
    .slice(0, 20);
}

export function scrapeProfile(): ScrapedCandidateFields {
  const name = textOf(document.querySelector("main h1"));
  const headline = textOf(document.querySelector("main .text-body-medium"));

  return {
    name,
    headline,
    experience: scrapeExperience(),
    education: scrapeEducation(),
    skills: scrapeSkills(),
  };
}
