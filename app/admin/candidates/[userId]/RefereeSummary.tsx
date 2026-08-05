import { REFERENCE_CATEGORIES, type RefereeRow, type RefereeRole } from "@/lib/referenceChecks";

const ROLE_LABEL: Record<RefereeRole, string> = {
  faculty: "Faculty",
  classmate: "Classmate",
  "internship-colleague": "Internship colleague",
  "internship-manager": "Internship manager",
  manager: "Manager",
  "team-lead": "Team lead",
  teammate: "Teammate",
  client: "Client",
  other: "Other",
};

const STATUS_LABEL: Record<RefereeRow["status"], string> = {
  pending: "Pending",
  completed: "Completed",
  rejected: "Declined",
};

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(REFERENCE_CATEGORIES.map((c) => [c.value, c.label]));

export default function RefereeSummary({ referees }: { referees: RefereeRow[] }) {
  if (referees.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
        No referees added yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {referees.map((r) => (
        <div key={r.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: "14px 16px" }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginBottom: 6 }}>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>
              {r.name}
              <span className="text-[#9c9c9c]" style={{ fontWeight: 400 }}> · {ROLE_LABEL[r.role]}</span>
              {r.organization && <span className="text-[#9c9c9c]" style={{ fontWeight: 400 }}> · {r.organization}</span>}
            </p>
            <span
              className={r.status === "completed" ? "text-[#16803c]" : r.status === "rejected" ? "text-[#ed1a24]" : "text-[#c77700]"}
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </div>
          {r.status === "completed" && r.ratings && r.ratings.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, margin: "8px 0" }}>
              {r.ratings.map((rt) => (
                <p key={rt.category} className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, margin: 0 }}>
                  {CATEGORY_LABEL[rt.category] ?? rt.category}: <strong className="text-black">{rt.value}</strong>
                </p>
              ))}
            </div>
          )}
          {r.status === "completed" && r.overall_feedback && (
            <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>
              &ldquo;{r.overall_feedback}&rdquo;
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
