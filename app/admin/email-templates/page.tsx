import Link from "next/link";
import { listTemplates } from "@/lib/emailTemplates";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";

export default async function AdminEmailTemplatesPage() {
  const templates = await listTemplates();

  return (
    <Table>
      <TableHeadRow columns={["Key", "Subject", "Updated", "By"]} />
      <tbody>
        {templates.map((t) => (
          <TableRow key={t.key}>
            <TableCell>
              <Link href={`/admin/email-templates/${t.key}`} className="text-[#ed1a24]">
                {t.key}
              </Link>
            </TableCell>
            <TableCell>{t.subject}</TableCell>
            <TableCell>{new Date(t.updatedAt).toLocaleString()}</TableCell>
            <TableCell>{t.updatedBy ?? "—"}</TableCell>
          </TableRow>
        ))}
        {templates.length === 0 && <TableEmptyRow colSpan={4} message="No templates found." />}
      </tbody>
    </Table>
  );
}
