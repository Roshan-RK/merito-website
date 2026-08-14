import { notFound } from "next/navigation";
import { getCandidateDetail } from "@/lib/adminCandidates";
import ResumeMatchGauge from "@/app/hub/account/report/ResumeMatchGauge";
import ResumeMatchCategoryCard from "@/app/hub/account/report/ResumeMatchCategoryCard";
import CandidateStatsCard from "@/app/hub/account/report/CandidateStatsCard";
import CandidateProfile from "@/app/hub/account/report/CandidateProfile";
import InterviewScoreGauge from "@/app/hub/account/interview/InterviewScoreGauge";
import ParameterScoreTile from "@/app/hub/account/interview/ParameterScoreTile";
import CriteriaMatchCard from "@/app/hub/account/interview/CriteriaMatchCard";
import SkillReportTable from "@/app/hub/account/interview/SkillReportTable";
import AnswerTranscript from "@/app/hub/account/interview/AnswerTranscript";
import RoadmapTimeline from "@/app/hub/account/RoadmapTimeline";
import EvaluatorNotes from "@/app/hub/account/EvaluatorNotes";
import PersonalityReport from "@/app/hub/account/personality/PersonalityReport";
import RefereeSummary from "./RefereeSummary";
import ShareLinkRevokeToggle from "./ShareLinkRevokeToggle";
import InterviewRecoveryActions from "./InterviewRecoveryActions";
import AccountActions from "./AccountActions";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

const sectionHeading: React.CSSProperties = { fontSize: "1.1rem", margin: "0 0 14px" };
const emptyNote: React.CSSProperties = { fontSize: 13 };

export default async function AdminCandidateDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const candidate = await getCandidateDetail(userId);

  if (!candidate) {
    notFound();
  }

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        {candidate.name || candidate.email}
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 32px" }}>
        {candidate.email}
      </p>

      <section style={{ marginBottom: 32 }}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
          Account
        </h3>
        <AccountActions userId={candidate.userId} email={candidate.email} />
      </section>

      {candidate.leads.map((lead) => (
        <section key={lead.id} style={{ marginBottom: 40 }}>
          <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
            {lead.roleTitle}
          </h3>

          {lead.candidateDetails && (
            <CandidateStatsCard
              email={candidate.email}
              phoneNumber={lead.candidateDetails.phoneNumber}
              location={lead.candidateDetails.location}
              totalExperience={lead.candidateDetails.totalExperience}
            />
          )}

          {lead.fitmentReport ? (
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 20px" }}>
              <div className="flex items-center justify-center" style={{ marginBottom: 16 }}>
                <ResumeMatchGauge percent={lead.fitmentReport.overallScore} />
              </div>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>
                {lead.fitmentReport.summary}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }}>
                {lead.fitmentReport.categories.map((category) => (
                  <ResumeMatchCategoryCard key={category.key} category={category} />
                ))}
              </div>
            </div>
          ) : (
            <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={emptyNote}>
              Fitment report not ready yet.
            </p>
          )}

          {lead.interviewReport ? (
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 20px" }}>
              <div className="flex items-center justify-center" style={{ marginBottom: 16 }}>
                <InterviewScoreGauge score={lead.interviewReport.overallScore} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, marginBottom: 16 }}>
                {Object.entries(lead.interviewReport.skillMetrics ?? {}).map(([skill, score]) => (
                  <ParameterScoreTile key={skill} skill={skill} score={score} />
                ))}
              </div>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>
                {lead.interviewReport.overallSummary}
              </p>
              {Object.keys(lead.interviewReport.skillReport).length > 0 && (
                <SkillReportTable skillReport={lead.interviewReport.skillReport} />
              )}
              {typeof lead.interviewReport.skillMetrics?.criteriaMatch === "number" && (
                <CriteriaMatchCard
                  criteriaMatchScore={lead.interviewReport.skillMetrics.criteriaMatch}
                  criteriaEvaluationTable={lead.interviewReport.criteriaEvaluationTable}
                />
              )}
              {lead.interviewReport.roadmap && <RoadmapTimeline roadmap={lead.interviewReport.roadmap} />}
              {lead.interviewReport.feedbackToInterviewer && <EvaluatorNotes notes={lead.interviewReport.feedbackToInterviewer} />}
              <AnswerTranscript answers={lead.interviewReport.answers} />
            </div>
          ) : lead.interviewRow ? (
            <div style={{ marginBottom: 20 }}>
              <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ ...emptyNote, marginBottom: 10 }}>
                Interview not completed yet.
              </p>
              <InterviewRecoveryActions interviewId={lead.interviewRow.id} status={lead.interviewRow.status} />
            </div>
          ) : (
            <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={emptyNote}>
              Interview not completed yet.
            </p>
          )}

          {lead.candidateDetails && (lead.candidateDetails.education.length > 0 || lead.candidateDetails.experience.length > 0) && (
            <CandidateProfile
              education={lead.candidateDetails.education}
              experience={lead.candidateDetails.experience}
              certifications={lead.candidateDetails.certifications}
            />
          )}
        </section>
      ))}

      <section style={{ marginBottom: 40 }}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
          Personality
        </h3>
        {candidate.personality ? (
          <PersonalityReport
            candidateName={candidate.name || candidate.email}
            roleTitle={candidate.personality.roleTitle}
            scores={candidate.personality.scores}
            validity={candidate.personality.validity}
          />
        ) : (
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={emptyNote}>
            Not taken yet.
          </p>
        )}
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
          References
        </h3>
        {candidate.references ? (
          <>
            <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 14px" }}>
              Status: {candidate.references.status} · {candidate.references.report.referees.length}/{candidate.references.minReferences} completed
            </p>
            <RefereeSummary referees={candidate.references.referees} />
          </>
        ) : (
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={emptyNote}>
            Not started yet.
          </p>
        )}
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
          Recruiter Preview
        </h3>
        {candidate.recruiterPreview.settings ? (
          <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, margin: "0 0 14px" }}>
            {candidate.recruiterPreview.settings.enabled ? "Visible to recruiters" : "Not visible"} ·{" "}
            {candidate.recruiterPreview.settings.sections.length > 0
              ? candidate.recruiterPreview.settings.sections.join(", ")
              : "no sections selected"}
          </p>
        ) : (
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ ...emptyNote, marginBottom: 14 }}>
            Not configured.
          </p>
        )}

        {candidate.recruiterPreview.shareLinks.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                {["Role", "Status", "Views", "Last viewed", "Created", ""].map((label) => (
                  <th
                    key={label}
                    className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
                    style={{ padding: "10px 0", fontSize: 11, letterSpacing: "0.04em", textAlign: "left" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidate.recruiterPreview.shareLinks.map((link) => (
                <tr key={link.token} style={{ borderBottom: "1px solid #eee" }}>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {link.roleTitle}
                  </td>
                  <td style={{ padding: "10px 0", fontSize: 13 }}>
                    <span
                      className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
                      style={{ color: link.revoked ? "#9c9c9c" : "#16803c", fontSize: 11.5 }}
                    >
                      {link.revoked ? "Revoked" : "Active"}
                    </span>
                  </td>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {link.viewCount}
                  </td>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {formatDate(link.lastViewedAt)}
                  </td>
                  <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                    {formatDate(link.createdAt)}
                  </td>
                  <td style={{ padding: "10px 0", fontSize: 14 }}>
                    <ShareLinkRevokeToggle token={link.token} revoked={link.revoked} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={emptyNote}>
            No share links created yet.
          </p>
        )}
      </section>
    </div>
  );
}
