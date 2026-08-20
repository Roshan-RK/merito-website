import Link from "next/link";
import { listAdminActions, getAdminActivityStats } from "@/lib/adminAuditLog";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Pagination from "@/app/admin/_components/Pagination";

const TARGET_HREF: Record<string, (targetId: string) => string> = {
  candidate: (id) => `/admin/candidates/${id}`,
  recruiter: (id) => `/admin/recruiters/${encodeURIComponent(id)}`,
  email_template: (id) => `/admin/email-templates/${encodeURIComponent(id)}`,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatChange(priorValue: unknown, newValue: unknown): string {
  const prior = priorValue == null ? "—" : JSON.stringify(priorValue);
  const next = newValue == null ? "—" : JSON.stringify(newValue);
  return `${prior} → ${next}`;
}

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const [{ rows: actions, page, totalPages }, stats] = await Promise.all([
    listAdminActions(Number(pageParam) || 1),
    getAdminActivityStats(),
  ]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 20 }}>
        {([
          ["Last 24h", stats.last24h],
          ["Last 7 days", stats.last7d],
          ["Last 30 days", stats.last30d],
        ] as const).map(([label, value]) => (
          <div key={label} className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: "16px 18px" }}>
            <p className="font-[family-name:var(--font-poppins)] uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.04em", margin: "0 0 6px" }}>
              {label}
            </p>
            <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 24, margin: 0 }}>
              {value}
            </p>
          </div>
        ))}
      </div>
      <Table minWidth={880}>
        <TableHeadRow columns={["When", "Admin", "Action", "Target", "Change"]} />
        <tbody>
          {actions.map((a) => {
            const href = TARGET_HREF[a.targetType]?.(a.targetId);
            return (
              <TableRow key={a.id}>
                <TableCell>{formatDateTime(a.createdAt)}</TableCell>
                <TableCell>{a.adminEmail}</TableCell>
                <TableCell>{a.action}</TableCell>
                <TableCell>
                  {href ? (
                    <Link href={href} className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]">
                      {a.targetType}:{a.targetId}
                    </Link>
                  ) : (
                    `${a.targetType}:${a.targetId}`
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12, wordBreak: "break-word" }}>
                    {formatChange(a.priorValue, a.newValue)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
          {actions.length === 0 && <TableEmptyRow colSpan={5} message="No admin activity yet." />}
        </tbody>
      </Table>
      <Pagination page={page} totalPages={totalPages} basePath="/admin/activity" />
    </div>
  );
}
