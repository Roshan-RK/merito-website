// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { scrapeProfile } from "../scrapeProfile";

// Fixture mirrors the real "SDUI" markup shape captured from a live profile
// (2026-08-11): hashed classnames, componentkey-based section/entry anchors,
// id suffix on the section wrapper, and the nested <li>-per-role shape for a
// company with multiple positions (Growqai: two roles).
const PROFILE_HTML = `
<main>
  <h2>Shikha T.</h2>
  <p>Growth Strategist | GTM, Client Acquisition & Revenue Growth</p>

  <section id="com.linkedin.sdui.profile.card.refXYZExperienceTopLevelSection">
    <h2>Experience</h2>

    <div componentkey="entity-collection-item-multi">
      <a href="https://www.linkedin.com/company/108601762/">
        <img alt="Growqai logo" />
      </a>
      <a href="https://www.linkedin.com/company/108601762/">
        <p>Growqai</p>
        <p>Full-time · 1 yr 1 mo</p>
      </a>
      <p>Pune District, Maharashtra, India · On-site</p>
      <ul>
        <li>
          <a href="https://www.linkedin.com/company/108601762/">
            <p>Growth Strategist | GTM, Client Acquisition & Revenue Growth</p>
            <p>Apr 2026 - Present · 5 mos</p>
          </a>
          <p><span data-testid="expandable-text-box">Spearheading growth across the entire funnel.</span></p>
        </li>
        <li>
          <a href="https://www.linkedin.com/company/108601762/">
            <p>Growth Associate</p>
            <p>Oct 2025 - Apr 2026 · 7 mos</p>
          </a>
        </li>
      </ul>
    </div>

    <div componentkey="entity-collection-item-single">
      <a href="https://www.linkedin.com/company/999/">
        <img alt="The Papaya Project logo" />
      </a>
      <a href="https://www.linkedin.com/company/999/">
        <p>Marketing Intern</p>
        <p>Jan 2025 - Sep 2025 · 9 mos</p>
      </a>
      <p><span data-testid="expandable-text-box">Ran early growth experiments.</span></p>
    </div>
  </section>
</main>
`;

describe("scrapeProfile", () => {
  beforeEach(() => {
    document.body.innerHTML = PROFILE_HTML;
  });

  it("splits a multi-role company entry into one experience row per role", () => {
    const { experience } = scrapeProfile();

    const growqaiRoles = experience.filter((exp) => exp.company === "Growqai");
    expect(growqaiRoles).toHaveLength(2);

    expect(growqaiRoles[0]).toEqual({
      title: "Growth Strategist | GTM, Client Acquisition & Revenue Growth",
      company: "Growqai",
      duration: "Apr 2026 - Present · 5 mos",
      description: "Spearheading growth across the entire funnel.",
    });

    expect(growqaiRoles[1]).toEqual({
      title: "Growth Associate",
      company: "Growqai",
      duration: "Oct 2025 - Apr 2026 · 7 mos",
      description: "",
    });
  });

  it("scrapes a single-role entry without a nested role list", () => {
    const { experience } = scrapeProfile();

    const papaya = experience.find((exp) => exp.company === "The Papaya Project");
    expect(papaya).toEqual({
      title: "Marketing Intern",
      company: "The Papaya Project",
      duration: "Jan 2025 - Sep 2025 · 9 mos",
      description: "Ran early growth experiments.",
    });
  });
});
