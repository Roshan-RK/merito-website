import { notFound } from "next/navigation";
import { getCandidateDetail } from "@/lib/adminCandidates";
import RefereeSummary from "./RefereeSummary";
import ShareLinkRevokeToggle from "./ShareLinkRevokeToggle";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge from "@/app/admin/_components/Badge";
import AccountActions from "./AccountActions";
import SendNotificationAction from "./SendNotificationAction";
import RecruiterPreviewOverrideForm from "./RecruiterPreviewOverrideForm";
import CandidateProfileOverrideForm from "./CandidateProfileOverrideForm";
import ReportsTab from "./ReportsTab";
import AuditTrail from "./AuditTrail";
import Tabs, { type TabDef } from "@/app/admin/_components/Tabs";
import type { AdminActionRow } from "@/lib/adminAuditLog";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

const sectionHeading: React.CSSProperties = { fontSize: "1.1rem", margin: "0 0 14px" };
const emptyNote: React.CSSProperties = { fontSize: 13 };

export default async function AdminCandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await params;
  const { tab } = await searchParams;
  const candidate = await getCandidateDetail(userId);

  if (!candidate) {
    notFound();
  }

  const allActivityRaw: AdminActionRow[] = [
    ...candidate.allActions,
    ...candidate.leads.flatMap((lead) => lead.interviewOverrideHistory),
    ...(candidate.references?.referees.flatMap((referee) => referee.overrideHistory) ?? []),
  ];
  // Dedupe by id: two fitment_leads rows sharing a role_title resolve to the
  // same interviewRow in getCandidateDetail(), so their interviewOverrideHistory
  // arrays -- and thus this merge -- can contain the same AdminActionRow twice.
  const allActivity = [...new Map(allActivityRaw.map((row) => [row.id, row])).values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const tabs: TabDef[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div>
          <section style={{ marginBottom: 32 }}>
            <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
              Account
            </h3>
            <AccountActions userId={candidate.userId} email={candidate.email} pendingDeletion={candidate.pendingDeletion} />
          </section>

          <section style={{ marginBottom: 32 }}>
            <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
              Send notification
            </h3>
            <SendNotificationAction userId={candidate.userId} />
          </section>

          <section>
            <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={sectionHeading}>
              Profile
            </h3>
            <CandidateProfileOverrideForm
              userId={candidate.userId}
              phoneNumber={candidate.profileOverride?.phoneNumber ?? candidate.leads.find((l) => l.candidateDetails)?.candidateDetails?.phoneNumber ?? null}
              location={candidate.profileOverride?.location ?? candidate.leads.find((l) => l.candidateDetails)?.candidateDetails?.location ?? null}
              totalExperience={
                candidate.profileOverride?.totalExperience ?? candidate.leads.find((l) => l.candidateDetails)?.candidateDetails?.totalExperience ?? null
              }
              overrideHistory={candidate.profileOverrideHistory}
            />
          </section>
        </div>
      ),
    },
    {
      id: "reports",
      label: "Reports",
      content: (
        <ReportsTab email={candidate.email} candidateName={candidate.name || candidate.email} leads={candidate.leads} personality={candidate.personality} />
      ),
    },
    {
      id: "references",
      label: "References",
      content: candidate.references ? (
        <div>
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 14px" }}>
            Status: {candidate.references.status} · {candidate.references.report.referees.length}/{candidate.references.minReferences} completed
          </p>
          <RefereeSummary referees={candidate.references.referees} />
        </div>
      ) : (
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={emptyNote}>
          Not started yet.
        </p>
      ),
    },
    {
      id: "recruiter-preview",
      label: "Recruiter Preview",
      content: (
        <div>
          <div style={{ marginBottom: 20 }}>
            <RecruiterPreviewOverrideForm
              userId={candidate.userId}
              settings={candidate.recruiterPreview.settings}
              overrideHistory={candidate.recruiterPreview.overrideHistory}
            />
          </div>

          <Table>
            <TableHeadRow columns={["Role", "Status", "Views", "Last viewed", "Expires", ""]} />
            <tbody>
              {candidate.recruiterPreview.shareLinks.map((link) => (
                <TableRow key={link.token}>
                  <TableCell>{link.roleTitle}</TableCell>
                  <TableCell>
                    <Badge variant={link.revoked || link.expired ? "neutral" : "success"}>
                      {link.revoked ? "Revoked" : link.expired ? "Expired" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>{link.viewCount}</TableCell>
                  <TableCell>{formatDate(link.lastViewedAt)}</TableCell>
                  <TableCell>{formatDate(link.expiresAt)}</TableCell>
                  <TableCell>
                    <ShareLinkRevokeToggle token={link.token} revoked={link.revoked} />
                  </TableCell>
                </TableRow>
              ))}
              {candidate.recruiterPreview.shareLinks.length === 0 && (
                <TableEmptyRow colSpan={6} message="No share links created yet." />
              )}
            </tbody>
          </Table>
        </div>
      ),
    },
    {
      id: "activity",
      label: "Activity",
      content: <AuditTrail actions={allActivity} />,
    },
  ];

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        {candidate.name || candidate.email}
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 32px" }}>
        {candidate.email}
      </p>

      <Tabs tabs={tabs} initialTab={tab ?? ""} />
    </div>
  );
}
