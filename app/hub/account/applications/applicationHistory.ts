export type FitmentLeadRow = {
  id: string;
  role_title: string;
  score: number;
  resume_match_status: string | null;
  created_at: string;
};

export type ApplicationRow = {
  id: string;
  roleTitle: string;
  scoreLabel: string;
  statusLabel: string;
  dateLabel: string;
  createdAt: string;
};

// Score and verdict both sit at their zero-value/empty placeholders until
// the fitment report finishes generating (confirmed in
// app/api/hub/fitment-check/status/route.ts) -- show a status word instead
// of a misleading "0.0" score for anything not yet READY.
const STATUS_LABELS: Record<string, string> = {
  READY: "Report ready",
  PENDING: "Processing",
};

export function buildApplicationRows(leads: FitmentLeadRow[]): ApplicationRow[] {
  return leads
    .map((lead) => {
      const isReady = lead.resume_match_status === "READY";
      return {
        id: lead.id,
        roleTitle: lead.role_title,
        scoreLabel: isReady ? lead.score.toFixed(1) : "-",
        statusLabel: STATUS_LABELS[lead.resume_match_status ?? ""] ?? "Processing",
        dateLabel: new Date(lead.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        createdAt: lead.created_at,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
