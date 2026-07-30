export type InlineSegment = { text: string; bold: boolean };

// Splits `**bold**` markdown spans out of a plain string into renderable
// segments -- IntervueBox's strengths/areasOfImprovement/feedbackToInterviewer
// fields use inline **bold** labels (e.g. "**Marketing Experience:** Gained
// hands-on...") that were being dumped as literal asterisks, same class of
// bug the roadmap field had.
export function parseInlineBold(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), bold: false });
  return segments;
}

export type NotesSection = { heading: string; items: string[] };
export type ParsedNotes = { sections: NotesSection[]; recommendation: string | null };

// feedbackToInterviewer is markdown: `### Heading` sections each containing
// `-` or numbered items, with an optional trailing `Recommendation:` line
// outside any section. Returns null on anything that doesn't match -- same
// safe-fallback contract as parseRoadmap.
export function parseEvaluatorNotes(raw: string): ParsedNotes | null {
  const lines = raw.split("\n");
  const sections: NotesSection[] = [];
  let current: NotesSection | null = null;
  let recommendation: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^#{2,4}\s+(.+)/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { heading: headingMatch[1].trim(), items: [] };
      continue;
    }

    const recMatch = line.match(/^Recommendation:\s*(.+)/i);
    if (recMatch) {
      recommendation = recMatch[1].trim();
      continue;
    }

    const itemMatch = line.match(/^(?:-|\d+\.)\s+(.+)/);
    if (itemMatch && current) {
      current.items.push(itemMatch[1].trim());
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) return null;
  return { sections, recommendation };
}
