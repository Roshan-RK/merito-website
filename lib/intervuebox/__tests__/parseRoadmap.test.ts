import { describe, it, expect } from "vitest";
import { parseRoadmap } from "../parseRoadmap";

// Real production roadmap string, pulled 2026-07-30 from a live Growth
// Strategist interview report -- the actual shape this parser must handle,
// not a hand-crafted approximation.
const REAL_ROADMAP = `### Strengths to Leverage
Before diving into improvements, the candidate should continue building on their strengths:
- Marketing experience (brand relaunch, social media growth).
- Collaborative and team-oriented approach.
- Creativity and resourcefulness in budget-constrained situations.

### Roadmap for Improvement

#### Short-Term (0-2 Months)
**Goal:** Improve communication and build structured problem-solving skills.
1. **Communication Skills**
   - **What to Do:** Practice writing concise, structured emails or mock strategies. Engage in public speaking or enroll in workshops for professional communication.
   - **Resources:** Books like "Made to Stick" by Chip and Dan Heath; courses on LinkedIn Learning or Coursera.
2. **Structured Frameworks**
   - **What to Do:** Learn and establish proficiency in growth strategy frameworks like AARRR (Acquisition, Activation, Retention, Revenue, Referral).
   - **Resources:** GrowthHackers.com articles, online courses on Udemy covering growth frameworks.

#### Mid-Term (2-4 Months)
**Goal:** Enhance technical expertise and mastery of growth-related tools.
3. **Tool Mastery**
   - **What to Do:** Undertake deep-dive workshops or tutorials for marketing and growth tools (e.g., Apollo, Google Analytics, HubSpot).
   - **Resources:** Tutorials on YouTube, HubSpot Academy, and vendor-specific certifications.
4. **Competitor Analysis Techniques**
   - **What to Do:** Practice competitor benchmarking and learn how to derive actionable insights.
   - **Resources:** Books like "Competitive Strategy" by Michael Porter; tools like SimilarWeb and SEMrush for hands-on application.

#### Long-Term (4-6+ Months)
**Goal:** Build advanced strategic planning and analytics skills.
5. **Advanced Planning Techniques**
   - **What to Do:** Work on creating mock growth strategies using OKRs or SMART goal-setting.
   - **Resources:** Project management platforms like Trello, Asana; online courses on OKRs.
6. **Data-Driven Measurement**
   - **What to Do:** Learn how to measure KPIs such as CAC, LTV, and churn rates in-depth.
   - **Resources:** Tools like Tableau, Google Data Studio; online workshops or courses on marketing analytics and predictive analytics.`;

describe("parseRoadmap", () => {
  it("parses the real production roadmap shape end to end", () => {
    const result = parseRoadmap(REAL_ROADMAP);
    expect(result).not.toBeNull();
    expect(result!.strengthsToLeverage).toEqual([
      "Marketing experience (brand relaunch, social media growth).",
      "Collaborative and team-oriented approach.",
      "Creativity and resourcefulness in budget-constrained situations.",
    ]);
    expect(result!.phases).toHaveLength(3);

    const [shortTerm, midTerm, longTerm] = result!.phases;
    expect(shortTerm.term).toBe("Short-Term");
    expect(shortTerm.duration).toBe("0-2 Months");
    expect(shortTerm.goal).toBe("Improve communication and build structured problem-solving skills.");
    expect(shortTerm.topics).toHaveLength(2);
    expect(shortTerm.topics[0]).toEqual({
      name: "Communication Skills",
      whatToDo:
        "Practice writing concise, structured emails or mock strategies. Engage in public speaking or enroll in workshops for professional communication.",
      resources: 'Books like "Made to Stick" by Chip and Dan Heath; courses on LinkedIn Learning or Coursera.',
    });

    expect(midTerm.term).toBe("Mid-Term");
    expect(midTerm.topics).toHaveLength(2);

    expect(longTerm.term).toBe("Long-Term");
    expect(longTerm.duration).toBe("4-6+ Months");
    expect(longTerm.topics).toHaveLength(2);
    expect(longTerm.topics[1].name).toBe("Data-Driven Measurement");
  });

  it("returns null when the strengths section is missing", () => {
    expect(parseRoadmap("Just a plain paragraph of roadmap text with no structure.")).toBeNull();
  });

  it("returns null when there are no phase headers", () => {
    const noPhases = `### Strengths to Leverage
- Good communicator.

Some other unstructured text follows.`;
    expect(parseRoadmap(noPhases)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseRoadmap("")).toBeNull();
  });
});
