import { describe, it, expect } from "vitest";
import { buildLinkedInCaption } from "../linkedinShare";

describe("buildLinkedInCaption", () => {
  it("lists all four sections when all are selected, in fixed order", () => {
    const caption = buildLinkedInCaption({
      roleTitle: "Senior Product Manager",
      sections: ["references", "fitment", "interview", "personality"],
      hubUrl: "https://www.merito.ai/hub",
    });

    expect(caption).toContain("Senior Product Manager");
    expect(caption).toContain(
      "AI-matched CV fitment, a Big Five personality profile, a proctored AI video interview, and verified peer references"
    );
    expect(caption).toContain("https://www.merito.ai/hub");
  });

  it("joins two sections with 'and', no comma", () => {
    const caption = buildLinkedInCaption({
      roleTitle: "Data Analyst",
      sections: ["interview", "fitment"],
      hubUrl: "https://www.merito.ai/hub",
    });

    expect(caption).toContain("AI-matched CV fitment and a proctored AI video interview");
  });

  it("renders a single section with no connector", () => {
    const caption = buildLinkedInCaption({
      roleTitle: "Data Analyst",
      sections: ["references"],
      hubUrl: "https://www.merito.ai/hub",
    });

    expect(caption).toContain("verified peer references, all in one place");
  });

  it("never includes a raw percentage or numeric score", () => {
    const caption = buildLinkedInCaption({
      roleTitle: "Senior Product Manager",
      sections: ["fitment", "interview"],
      hubUrl: "https://www.merito.ai/hub",
    });

    expect(caption).not.toMatch(/\d/);
  });
});
