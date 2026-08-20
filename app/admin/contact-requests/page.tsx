import Link from "next/link";
import { listContactDetailRequests } from "@/lib/contactDetailRequests";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Pagination from "@/app/admin/_components/Pagination";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminContactRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const { rows, page, totalPages } = await listContactDetailRequests(Number(pageParam) || 1);

  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "0 0 14px" }}>
        Contact details reveal automatically to a recruiter once a candidate has recruiter preview enabled — there is no approval
        step to action here. This is an audit trail of every reveal.
      </p>
      <Table minWidth={780}>
        <TableHeadRow columns={["Requested", "Candidate", "Role", "LinkedIn", "Status"]} />
        <tbody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDateTime(r.requestedAt)}</TableCell>
              <TableCell>
                <Link href={`/admin/candidates/${r.userId}`} className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]">
                  {r.candidateEmail}
                </Link>
              </TableCell>
              <TableCell>{r.roleTitle ?? "—"}</TableCell>
              <TableCell>
                <a href={r.linkedinUrl} target="_blank" rel="noreferrer" className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]">
                  {r.linkedinUrl}
                </a>
              </TableCell>
              <TableCell>{r.status}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableEmptyRow colSpan={5} message="No contact-detail reveals yet." />}
        </tbody>
      </Table>
      <Pagination page={page} totalPages={totalPages} basePath="/admin/contact-requests" />
    </div>
  );
}
