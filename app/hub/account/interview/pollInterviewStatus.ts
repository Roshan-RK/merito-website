import type { InterviewPollStatus } from "@/app/api/hub/interview/status/route";

// Pure fetch/compare helper for InterviewStatusPoller. Kept out of the
// "use client" component so this repo's "node" vitest env can unit-test it
// directly -- there is no DOM test renderer wired up here.
//
// currentStatus is typed to the route's own response union so a caller can't
// wait on a value the route never returns (an "appeared" mismatch was a real
// infinite-refresh bug once).
export async function pollInterviewStatus(
  leadId: string,
  currentStatus: InterviewPollStatus,
  onChanged: () => void
): Promise<void> {
  try {
    const res = await fetch(`/api/hub/interview/status?lead=${encodeURIComponent(leadId)}`);
    if (!res.ok) return;
    const data = (await res.json()) as { status?: InterviewPollStatus };
    if (data.status && data.status !== currentStatus) {
      onChanged();
    }
  } catch {
    // Transient network error -- the next tick retries.
  }
}
