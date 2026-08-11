import type { ScrapedCandidateFields } from "../../../shared/recruiter-preview/types";

function textOf(el: Element | null): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

// LinkedIn's "SDUI" markup no longer exposes stable id="experience" anchors —
// component ids are hashed per session/profile (e.g.
// "com.linkedin.sdui.profile.card.ref<hash>EEducationTopLevelSection") but
// keep a stable suffix. Substring-match on that suffix instead of exact id.
// Live-verified 2026-08-11 against a real profile.
function sectionByIdSuffix(suffix: string): Element | null {
  return document.querySelector(`[id$="${suffix}"]`);
}

// Each experience/education row is wrapped in an element with
// componentkey="entity-collection-item-<hash>" — the hash varies per
// item/session but this prefix is stable. Live-verified 2026-08-11.
//
// A company with multiple roles ("Growqai: Growth Strategist" then
// "Growth Associate") renders as ONE entity-collection-item containing a
// nested <li> per role, instead of separate top-level p's for title/date.
// Live-verified 2026-08-11 — must be split into one entry per <li>, sharing
// the outer orgName, or title/date/description get scrambled.
function scrapeEntries(section: Element): { orgName: string; paragraphs: string[]; description: string }[] {
  return Array.from(section.querySelectorAll('[componentkey^="entity-collection-item-"]')).flatMap((entry) => {
    const logoImg = entry.querySelector("img[alt$=' logo']") as HTMLImageElement | null;
    const orgName = logoImg ? logoImg.alt.replace(/ logo$/, "") : "";
    const roleItems = Array.from(entry.querySelectorAll("li"));

    const extract = (root: Element) => {
      const descriptionEl = root.querySelector('[data-testid="expandable-text-box"]');
      const description = textOf(descriptionEl);
      const paragraphs = Array.from(root.querySelectorAll("p"))
        .filter((p) => !descriptionEl || (!descriptionEl.contains(p) && !p.contains(descriptionEl)))
        .filter((p) => !roleItems.some((li) => li !== root && li.contains(p)))
        .map((p) => textOf(p))
        .filter(Boolean);
      return { orgName, paragraphs, description };
    };

    if (roleItems.length === 0) return [extract(entry)];
    return roleItems.map((li) => extract(li));
  });
}

function scrapeExperience(): ScrapedCandidateFields["experience"] {
  const section = sectionByIdSuffix("ExperienceTopLevelSection");
  if (!section) return [];
  return scrapeEntries(section)
    .map((entry) => ({
      title: entry.paragraphs[0] || "",
      company: entry.orgName,
      duration: entry.paragraphs.slice(1).join(" · "),
      description: entry.description,
    }))
    .filter((exp) => exp.title.length > 0)
    .slice(0, 10);
}

// NOTE: education row shape not live-verified (test profile had no
// education listed — LinkedIn "null state" card) — same entity-collection-item
// pattern as experience is a reasonable bet since it's a shared LinkedIn
// component, but re-check against a profile with real education data.
function scrapeEducation(): ScrapedCandidateFields["education"] {
  const section = sectionByIdSuffix("EducationTopLevelSection");
  if (!section) return [];
  return scrapeEntries(section)
    .map((entry) => ({
      school: entry.orgName,
      degree: entry.paragraphs[0] || "",
      duration: entry.paragraphs.slice(1).join(" · "),
    }))
    .filter((edu) => edu.school.length > 0)
    .slice(0, 5);
}

// NOTE: not live-verified — skills UI is a pill/chip list, different shape
// than experience/education entries. Re-check against a real profile.
function scrapeSkills(): string[] {
  const section = sectionByIdSuffix("SkillsTopLevelSection");
  if (!section) return [];
  return Array.from(section.querySelectorAll("span[aria-hidden='true']"))
    .map((el) => textOf(el))
    .filter(Boolean)
    .slice(0, 20);
}

export function scrapeProfile(): ScrapedCandidateFields {
  const name = textOf(document.querySelector("main h2"));
  const headline = textOf(document.querySelector("main h2 + p"));

  return {
    name,
    headline,
    experience: scrapeExperience(),
    education: scrapeEducation(),
    skills: scrapeSkills(),
  };
}
