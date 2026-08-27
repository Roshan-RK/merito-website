"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The interview page is a server component. Its non-terminal view states
// (invited / appeared) update only when fitment_interviews changes -- via
// the vendor webhook, the cron sweep, or the status route's own self-heal.
// This polls that route and re-renders the page (router.refresh re-runs the
// server component) the moment the status moves, so the candidate never
// sits on a stale screen. Mirrors DashboardClient.tsx's dashboard poll.
export const POLL_INTERVAL_MS = 15_000;

// Extracted from the component so it can be unit-tested in this repo's "node"
// vitest environment -- there is no DOM test renderer wired up, so every test
// here targets a plain function, not a rendered component.
export async function pollInterviewStatus(
  leadId: string,
  currentStatus: string,
  onChanged: () => void
): Promise<void> {
  try {
    const res = await fetch(`/api/hub/interview/status?lead=${encodeURIComponent(leadId)}`);
    if (!res.ok) return;
    const data = (await res.json()) as { status?: string };
    if (data.status && data.status !== currentStatus) {
      onChanged();
    }
  } catch {
    // Transient network error -- the next tick retries.
  }
}

export default function InterviewStatusPoller({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      void pollInterviewStatus(leadId, currentStatus, () => router.refresh());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [leadId, currentStatus, router]);

  return null;
}
