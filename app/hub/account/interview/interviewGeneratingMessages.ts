// Rotating status lines for the "invited" view once isInterviewGenerating()
// (ProgressRail.tsx) flips true -- purely cosmetic reassurance, since no real
// per-stage signal exists from IntervueBox yet (see that function's own
// comment). Cycles forever; the candidate actually leaves this screen once
// the vendor's webhook/sweep flips fitment_interviews.status to "ready" and
// DashboardClient.tsx's polling picks it up on the next dashboard visit --
// not because of anything in this file.
const MESSAGES = [
  "Wrapping up your interview…",
  "Scoring your responses…",
  "Building your skill-wise breakdown…",
  "Preparing your coaching plan…",
];

export const GENERATING_MESSAGE_INTERVAL_MS = 3200;

export function messageForElapsedMs(elapsedMs: number): string {
  const index = Math.floor(elapsedMs / GENERATING_MESSAGE_INTERVAL_MS) % MESSAGES.length;
  return MESSAGES[index];
}
