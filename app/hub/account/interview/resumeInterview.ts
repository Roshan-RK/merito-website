// Shared fetch/parse guts behind the interview Resume button. Both the
// "terminated" and "appeared" view states POST the same route with the same
// body and handle the same { url } / { error } response, so the logic lives
// here -- a plain module (NO "use client") this repo's "node" vitest env can
// unit-test directly, mirroring pollInterviewStatus.ts.
//
// The resume route (POST /api/hub/interview/resume, body { leadId }) matches
// any row for the lead and reinvites in RESUME mode -- a free vendor reinvite,
// no payment gate.

export type ResumeResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const FALLBACK_ERROR = "Couldn't resume this interview. Please try again.";

export async function resumeInterview(leadId: string): Promise<ResumeResult> {
  try {
    const res = await fetch("/api/hub/interview/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Surface the vendor's actual reason (e.g. "Cannot resume an interview
      // in status EVALUATED...") when the route passes one through.
      return { ok: false, error: data.error ?? FALLBACK_ERROR };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
