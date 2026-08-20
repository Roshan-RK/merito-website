import Link from "next/link";
import { listRecruiters } from "@/lib/adminRecruiters";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge from "@/app/admin/_components/Badge";

export default async function AdminRecruitersPage() {
  const recruiters = await listRecruiters();

  return (
    <Table>
      <TableHeadRow columns={["Email", "Company", "Verified", "Banned"]} />
      <tbody>
        {recruiters.map((r) => (
          <TableRow key={r.email}>
            <TableCell>
              <Link href={`/admin/recruiters/${encodeURIComponent(r.email)}`} className="text-[#ed1a24]">
                {r.email}
              </Link>
            </TableCell>
            <TableCell>{r.companyName ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={r.verifiedAt ? "success" : "neutral"}>{r.verifiedAt ? "Yes" : "No"}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={r.bannedAt ? "danger" : "neutral"}>{r.bannedAt ? "Yes" : "No"}</Badge>
            </TableCell>
          </TableRow>
        ))}
        {recruiters.length === 0 && <TableEmptyRow colSpan={4} message="No recruiters yet." />}
      </tbody>
    </Table>
  );
}
