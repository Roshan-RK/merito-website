"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InterviewPollStatus } from "@/app/api/hub/interview/status/route";
import { pollInterviewStatus } from "./pollInterviewStatus";

// The interview page is a server component. Its non-terminal view states
// (invited / appeared) update only when fitment_interviews changes -- via
// the vendor webhook, the cron sweep, or the status route's own reconcile.
// This polls that route and re-renders the page (router.refresh re-runs the
// server component) the moment the status moves, so the candidate never
// sits on a stale screen. Mirrors DashboardClient.tsx's dashboard poll.
export const POLL_INTERVAL_MS = 15_000;

export default function InterviewStatusPoller({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: InterviewPollStatus;
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
