import { listRecruiterActions } from "@/lib/recruiterActionLog";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Pagination from "@/app/admin/_components/Pagination";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminRecruiterActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const { rows: actions, page, totalPages } = await listRecruiterActions(Number(pageParam) || 1);

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        Recruiter activity
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 24px" }}>
        Recruiter-side actions with a known recruiter identity. Extension actions authenticated only by shared key (e.g. contact-detail reveals) aren&apos;t attributable to a specific recruiter yet, so they&apos;re not logged here.
      </p>
      <Table minWidth={760}>
        <TableHeadRow columns={["When", "Recruiter", "Action", "Target", "Detail"]} />
        <tbody>
          {actions.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{formatDateTime(a.createdAt)}</TableCell>
              <TableCell>{a.recruiterEmail}</TableCell>
              <TableCell>{a.action}</TableCell>
              <TableCell>
                {a.targetType}:{a.targetId}
              </TableCell>
              <TableCell>
                <span className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12, wordBreak: "break-word" }}>
                  {a.detail == null ? "—" : JSON.stringify(a.detail)}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {actions.length === 0 && <TableEmptyRow colSpan={5} message="No recruiter activity yet." />}
        </tbody>
      </Table>
      <Pagination page={page} totalPages={totalPages} basePath="/admin/recruiter-activity" />
    </div>
  );
}
