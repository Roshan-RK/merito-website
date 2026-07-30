export type RoadmapTopic = { name: string; whatToDo: string; resources: string };
export type RoadmapPhase = { term: string; duration: string; goal: string; topics: RoadmapTopic[] };
export type ParsedRoadmap = { strengthsToLeverage: string[]; phases: RoadmapPhase[] };

// IntervueBox's `roadmap` field is a markdown string, not structured JSON --
// live-confirmed 2026-07-30 against a real Growth Strategist interview,
// matching the shape their own reference PDF export renders as a timeline.
// Parses that specific markdown shape (### Strengths to Leverage, #### Phase
// (duration), **Goal:**, numbered **Topic** items with - **What to Do:** /
// - **Resources:** sub-bullets). Returns null on anything that doesn't
// match -- AI-generated text formatting isn't guaranteed identical across
// interviews, and callers fall back to rendering the raw string as-is.
export function parseRoadmap(raw: string): ParsedRoadmap | null {
  const lines = raw.split("\n");

  const strengthsStart = lines.findIndex((l) => /^###\s*Strengths to Leverage/i.test(l.trim()));
  if (strengthsStart === -1) return null;

  const strengthsToLeverage: string[] = [];
  let i = strengthsStart + 1;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{2,4}\s/.test(line)) break;
    const bulletMatch = line.match(/^-\s+(.+)/);
    if (bulletMatch) strengthsToLeverage.push(bulletMatch[1].trim());
  }
  if (strengthsToLeverage.length === 0) return null;

  const phases: RoadmapPhase[] = [];
  let currentPhase: RoadmapPhase | null = null;
  let currentTopic: RoadmapTopic | null = null;

  const flushTopic = () => {
    if (currentTopic && currentPhase) currentPhase.topics.push(currentTopic);
    currentTopic = null;
  };
  const flushPhase = () => {
    flushTopic();
    if (currentPhase) phases.push(currentPhase);
    currentPhase = null;
  };

  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const phaseMatch = line.match(/^####\s+(.+?)\s*\(([^)]+)\)\s*$/);
    if (phaseMatch) {
      flushPhase();
      currentPhase = { term: phaseMatch[1].trim(), duration: phaseMatch[2].trim(), goal: "", topics: [] };
      continue;
    }
    if (!currentPhase) continue;

    const goalMatch = line.match(/^\*\*Goal:\*\*\s*(.+)/i);
    if (goalMatch) {
      currentPhase.goal = goalMatch[1].trim();
      continue;
    }

    const topicMatch = line.match(/^\d+\.\s*\*\*(.+?)\*\*\s*$/);
    if (topicMatch) {
      flushTopic();
      currentTopic = { name: topicMatch[1].trim(), whatToDo: "", resources: "" };
      continue;
    }

    const whatMatch = line.match(/^-\s*\*\*What to Do:\*\*\s*(.+)/i);
    if (whatMatch && currentTopic) {
      currentTopic.whatToDo = whatMatch[1].trim();
      continue;
    }

    const resourcesMatch = line.match(/^-\s*\*\*Resources:\*\*\s*(.+)/i);
    if (resourcesMatch && currentTopic) {
      currentTopic.resources = resourcesMatch[1].trim();
      continue;
    }
  }
  flushPhase();

  if (phases.length === 0) return null;
  return { strengthsToLeverage, phases };
}
