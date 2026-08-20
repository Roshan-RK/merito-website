import { listTransactions, listUnpaidUnlocks, type TransactionStatus } from "@/lib/adminPayments";
import { Table, TableHeadRow, TableRow, TableCell, TableEmptyRow } from "@/app/admin/_components/Table";
import Badge, { type BadgeVariant } from "@/app/admin/_components/Badge";
import Pagination from "@/app/admin/_components/Pagination";
import ReconcileForm from "./ReconcileForm";
import PaymentActions from "./PaymentActions";
import GrantForm from "./GrantForm";

const STATUS_VARIANT: Record<TransactionStatus, BadgeVariant> = {
  initiated: "neutral",
  success: "success",
  failed: "danger",
  refunded: "warning",
};

const PRODUCT_LABEL: Record<string, string> = {
  report: "Report",
  personality: "Personality",
  references: "References",
  interview: "Interview",
  counselling: "Counselling",
  bundle: "Bundle",
};

const UNPAID_KIND_LABEL: Record<string, string> = {
  report: "Report",
  personality: "Personality",
  references: "References",
};

function formatAmount(amountPaise: number): string {
  return `₹${(amountPaise / 100).toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const [{ rows: transactions, page, totalPages }, unpaidUnlocks] = await Promise.all([
    listTransactions(Number(pageParam) || 1),
    listUnpaidUnlocks(),
  ]);

  return (
    <div>
      <GrantForm />

      <div style={{ marginBottom: 40 }}>
        <Table>
          <TableHeadRow columns={["Candidate", "Product", "Level", "Amount", "Status", "Date", ""]} />
          <tbody>
            {transactions.map((t) => (
              <TableRow key={t.orderId}>
                <TableCell>{t.email}</TableCell>
                <TableCell>
                  {PRODUCT_LABEL[t.product] ?? t.product}
                  {t.roleTitle && <span className="text-[#9c9c9c]"> · {t.roleTitle}</span>}
                </TableCell>
                <TableCell>{t.level}</TableCell>
                <TableCell>{formatAmount(t.amountPaise)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                </TableCell>
                <TableCell>{formatDate(t.createdAt)}</TableCell>
                <TableCell>
                  <PaymentActions orderId={t.orderId} status={t.status} amountPaise={t.amountPaise} />
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && <TableEmptyRow colSpan={7} message="No payments yet." />}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} basePath="/admin/payments" />
      </div>

      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.1rem", margin: "0 0 14px" }}>
        Unlocked without payment
      </h2>
      <Table>
        <TableHeadRow columns={["Candidate", "Unlock", "Date", ""]} />
        <tbody>
          {unpaidUnlocks.map((u, i) => (
            <TableRow key={`${u.userId}-${u.kind}-${u.leadId ?? i}`}>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                {UNPAID_KIND_LABEL[u.kind]}
                {u.roleTitle && <span className="text-[#9c9c9c]"> · {u.roleTitle}</span>}
              </TableCell>
              <TableCell>{formatDate(u.unlockedAt)}</TableCell>
              <TableCell>
                <ReconcileForm userId={u.userId} leadId={u.leadId} product={u.kind} />
              </TableCell>
            </TableRow>
          ))}
          {unpaidUnlocks.length === 0 && <TableEmptyRow colSpan={4} message="None — good." tone="success" />}
        </tbody>
      </Table>
    </div>
  );
}
