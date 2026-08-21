import Link from "next/link";
import { searchCandidates, FUNNEL_STAGE_LABEL } from "@/lib/adminCandidates";
import { Table, TableHeadRow, TableRow, TableCell } from "@/app/admin/_components/Table";
import Badge from "@/app/admin/_components/Badge";
import EmptyState from "@/app/admin/_components/EmptyState";

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchCandidates(query) : [];

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 24px" }}>
        Search
      </h2>

      {!query ? (
        <EmptyState message="Type a candidate name or email in the sidebar to search." />
      ) : results.length === 0 ? (
        <EmptyState message={`No candidates match "${query}".`} />
      ) : (
        <Table>
          <TableHeadRow columns={["Name", "Email", "Latest role", "Funnel stage"]} />
          <tbody>
            {results.map((c) => (
              <TableRow key={c.userId}>
                <TableCell>
                  <Link href={`/admin/candidates/${c.userId}`} className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]">
                    {c.name || "—"}
                  </Link>
                </TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.latestRoleTitle}</TableCell>
                <TableCell>
                  <Badge variant="neutral">{FUNNEL_STAGE_LABEL[c.funnelStage]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
