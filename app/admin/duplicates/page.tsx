import Link from "next/link";
import { findDuplicateCandidates } from "@/lib/adminCandidates";
import Badge from "@/app/admin/_components/Badge";
import EmptyState from "@/app/admin/_components/EmptyState";
import type { CandidateListRow, DuplicateCandidateGroup } from "@/lib/adminCandidates";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function CandidateChip({ candidate }: { candidate: CandidateListRow }) {
  return (
    <Link
      href={`/admin/candidates/${candidate.userId}`}
      className="bg-white border border-black/[0.08]"
      style={{ display: "block", borderRadius: 10, padding: "10px 14px", textDecoration: "none" }}
    >
      <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: "0 0 2px" }}>
        {candidate.name || "(no name)"}
      </p>
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12, margin: "0 0 2px" }}>
        {candidate.email}
      </p>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11, margin: "0 0 2px" }}>
        {candidate.latestRoleTitle} · first seen {formatDate(candidate.firstSeenAt)}
      </p>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 10.5, margin: 0, wordBreak: "break-all" }}>
        {candidate.userId}
      </p>
    </Link>
  );
}

function GroupSection({ title, hint, groups }: { title: string; hint: string; groups: DuplicateCandidateGroup[] }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.05rem", margin: "0 0 4px" }}>
        {title} ({groups.length})
      </h3>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "0 0 14px" }}>
        {hint}
      </p>
      {groups.length === 0 ? (
        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14 }}>
          <EmptyState message="None found." tone="success" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.map((group) => (
            <div key={group.key} className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {group.candidates.map((c) => (
                  <CandidateChip key={c.userId} candidate={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function AdminDuplicatesPage() {
  const { byEmail, byName } = await findDuplicateCandidates();

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        Possible duplicate candidates
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 24px" }}>
        Heuristic surfacing, not an auto-merge — review each group and use the existing &quot;Merge into this account&quot; control on a candidate&apos;s detail page. <Badge variant="warning">Email match</Badge> is a strong signal (dots/+alias-normalized); <Badge variant="neutral">Name match</Badge> alone is weak (common names collide) — treat it as a starting point, not a verdict.
      </p>
      <GroupSection
        title="Matching email"
        hint="Same address once dots and +alias suffixes are normalized (e.g. j.doe+work@gmail.com and jdoe@gmail.com)."
        groups={byEmail}
      />
      <GroupSection title="Matching name" hint="Exact name match (case-insensitive) across different accounts." groups={byName} />
    </div>
  );
}
