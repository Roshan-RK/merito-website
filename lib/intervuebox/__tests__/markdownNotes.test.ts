import { describe, it, expect } from "vitest";
import { parseInlineBold, parseEvaluatorNotes } from "../markdownNotes";

describe("parseInlineBold", () => {
  it("splits bold spans from surrounding plain text", () => {
    expect(parseInlineBold("**Marketing Experience:** Gained hands-on experience.")).toEqual([
      { text: "Marketing Experience:", bold: true },
      { text: " Gained hands-on experience.", bold: false },
    ]);
  });

  it("returns a single plain segment when there's no bold markup", () => {
    expect(parseInlineBold("Just plain text.")).toEqual([{ text: "Just plain text.", bold: false }]);
  });

  it("handles multiple bold spans in one string", () => {
    expect(parseInlineBold("**A** and **B** and plain.")).toEqual([
      { text: "A", bold: true },
      { text: " and ", bold: false },
      { text: "B", bold: true },
      { text: " and plain.", bold: false },
    ]);
  });
});

describe("parseEvaluatorNotes", () => {
  // Real production feedbackToInterviewer string, pulled 2026-07-30 from the
  // same live Growth Strategist interview used for the roadmap fixture.
  const REAL_NOTES = `### Strengths
- Diverse experience in digital marketing activities, such as influencer marketing, social media marketing, and brand relaunch.
- Demonstrates an understanding of the importance of collaboration, discipline, and communication within team projects.
- Some practical knowledge of tools like Apollo and Sales Navigator.

### Weaknesses
- Lack of depth in discussing frameworks or structured strategies.
- Poor communication skills; answers lacked clarity and often deviated from the core question.

### Opportunities
- Candidate has hands-on experience in marketing and brand activities, which can be leveraged and expanded in a focused training environment.

### Threats
- Inability to communicate clear, concrete strategies may hinder collaboration and decision-making in client-facing roles.

### Training Needed
1. Structured frameworks for growth strategies (e.g., AARRR, SWOT, or OKRs).
2. Measuring ROI and working with specific KPIs such as CAC, LTV, and customer retention rates.

Recommendation: The candidate should not be considered for further rounds unless they demonstrate improved clarity, structure, and technical knowledge in their skill set.`;

  it("parses sections and the trailing recommendation from the real production shape", () => {
    const result = parseEvaluatorNotes(REAL_NOTES);
    expect(result).not.toBeNull();
    expect(result!.sections.map((s) => s.heading)).toEqual([
      "Strengths",
      "Weaknesses",
      "Opportunities",
      "Threats",
      "Training Needed",
    ]);
    expect(result!.sections[0].items).toHaveLength(3);
    expect(result!.sections[4].items).toEqual([
      "Structured frameworks for growth strategies (e.g., AARRR, SWOT, or OKRs).",
      "Measuring ROI and working with specific KPIs such as CAC, LTV, and customer retention rates.",
    ]);
    expect(result!.recommendation).toBe(
      "The candidate should not be considered for further rounds unless they demonstrate improved clarity, structure, and technical knowledge in their skill set."
    );
  });

  it("returns null when there are no ### headings", () => {
    expect(parseEvaluatorNotes("Just a plain paragraph with no structure.")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseEvaluatorNotes("")).toBeNull();
  });

  it("returns a parsed result with no recommendation when the line is absent", () => {
    const result = parseEvaluatorNotes("### Strengths\n- Good communicator.");
    expect(result).not.toBeNull();
    expect(result!.recommendation).toBeNull();
  });

  // Real production feedbackToInterviewer string, pulled 2026-08-14 from a
  // live Sales Strategy & Sales Operations Lead interview. Unlike REAL_NOTES
  // above, IntervueBox here sends "#### Recommendation" as its own heading
  // followed by a plain (non-bulleted) paragraph, not a "Recommendation: ..."
  // line outside any section -- the parser silently dropped the paragraph
  // and rendered an empty "Recommendation" section instead.
  const REAL_NOTES_HEADING_STYLE = `### Strengths
- Extensive experience in sales strategy and operations spanning 20 years across leading organizations.
- Robust expertise in managing regional strategies and focusing on key geographies, especially in Asia Pacific.

### Weaknesses
- Lack of hands-on experience with prominent CRM tools like Salesforce during prior roles.

#### Training Recommendations
- CRM tools (e.g., Salesforce) and their use in advanced sales and client relationship tracking.

#### Recommendation
The candidate demonstrates strong leadership and sales strategy capabilities but needs further training in modern tools and techniques. Recommended for further evaluation.`;

  it("parses a '#### Recommendation' heading followed by a plain paragraph", () => {
    const result = parseEvaluatorNotes(REAL_NOTES_HEADING_STYLE);
    expect(result).not.toBeNull();
    expect(result!.sections.map((s) => s.heading)).toEqual(["Strengths", "Weaknesses", "Training Recommendations"]);
    expect(result!.recommendation).toBe(
      "The candidate demonstrates strong leadership and sales strategy capabilities but needs further training in modern tools and techniques. Recommended for further evaluation."
    );
  });

  it("joins multiple paragraph lines under a '#### Recommendation' heading", () => {
    const result = parseEvaluatorNotes("### Strengths\n- Good.\n\n#### Recommendation\nFirst line.\nSecond line.");
    expect(result!.recommendation).toBe("First line. Second line.");
  });

  // Real production feedbackToInterviewer string, pulled 2026-08-20 from
  // Yukta Wagh's Inside Sales Executive interview -- a third shape with no
  // `#` headings at all. Sections are bold bullet labels (`- **Strengths:**`)
  // with indented `  - item` sub-bullets, a bare `**Training Needs:**` label
  // (no leading `-`), and an inline `**Recommendation:** ...` line. The old
  // parser only recognized `#{2,4}` headings, so this whole string fell
  // through to the raw-text fallback.
  const REAL_NOTES_BOLD_BULLET_STYLE = `- **Strengths:**
  - Familiar with various tools such as HubSpot, LinkedIn Sales Navigator, Apollo.io, and ChatGPT for outreach and client research.
  - Basic understanding of personalized communication and lead nurturing techniques.
- **Weaknesses:**
  - Lack of clear examples or details to showcase strong operational experience in end-to-end sales.
- **Opportunities:**
  - Structured mentoring on global sales strategies and effective client research techniques could rapidly improve capabilities.
- **Threats:**
  - Current limitations in articulating and showcasing expertise could hinder their candidacy for roles requiring high autonomy and strategic planning.

**Training Needs:**
  - Advanced CRM usage, including lead scoring and pipeline management.
  - Personalized engagement strategies for cross-cultural accounts.

**Recommendation:** Proceed to further rounds only if the candidate demonstrates improved depth and specificity in their responses during follow-ups.`;

  it("parses bold-bullet-label sections with no '#' headings", () => {
    const result = parseEvaluatorNotes(REAL_NOTES_BOLD_BULLET_STYLE);
    expect(result).not.toBeNull();
    expect(result!.sections.map((s) => s.heading)).toEqual([
      "Strengths",
      "Weaknesses",
      "Opportunities",
      "Threats",
      "Training Needs",
    ]);
    expect(result!.sections[0].items).toHaveLength(2);
    expect(result!.sections[4].items).toHaveLength(2);
    expect(result!.recommendation).toBe(
      "Proceed to further rounds only if the candidate demonstrates improved depth and specificity in their responses during follow-ups."
    );
  });
});
