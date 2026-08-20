import Link from "next/link";
import { listCandidates, FUNNEL_STAGE_LABEL } from "@/lib/adminCandidates";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge from "@/app/admin/_components/Badge";

export default async function AdminCandidatesPage() {
  const candidates = await listCandidates();

  return (
    <Table>
      <TableHeadRow columns={["Name", "Email", "Latest role", "First seen", "Funnel stage"]} />
      <tbody>
        {candidates.map((c) => (
          <TableRow key={c.userId ?? c.email}>
            <TableCell>
              {c.userId ? (
                <Link
                  href={`/admin/candidates/${c.userId}`}
                  className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
                >
                  {c.name || "—"}
                </Link>
              ) : (
                <span
                  className="font-[family-name:var(--font-poppins)] font-semibold text-black"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  {c.name || "—"}
                  <Badge variant="neutral">Not linked</Badge>
                </span>
              )}
            </TableCell>
            <TableCell>{c.email}</TableCell>
            <TableCell>{c.latestRoleTitle}</TableCell>
            <TableCell>
              {new Date(c.firstSeenAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
            </TableCell>
            <TableCell>
              <Badge variant="neutral">{FUNNEL_STAGE_LABEL[c.funnelStage]}</Badge>
            </TableCell>
          </TableRow>
        ))}
        {candidates.length === 0 && <TableEmptyRow colSpan={5} message="No candidates yet." />}
      </tbody>
    </Table>
  );
}
