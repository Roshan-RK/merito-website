import { listTransactions, listUnpaidUnlocks, type TransactionStatus } from "@/lib/adminPayments";
import ReconcileForm from "./ReconcileForm";
import PaymentActions from "./PaymentActions";
import GrantForm from "./GrantForm";

const STATUS_COLOR: Record<TransactionStatus, string> = {
  initiated: "#9c9c9c",
  success: "#16803c",
  failed: "#ed1a24",
  refunded: "#c77700",
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

export default async function AdminPaymentsPage() {
  const [transactions, unpaidUnlocks] = await Promise.all([listTransactions(), listUnpaidUnlocks()]);

  return (
    <div>
      <GrantForm />

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            {["Candidate", "Product", "Level", "Amount", "Status", "Date", ""].map((label) => (
              <th
                key={label}
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
                style={{ padding: "10px 0", fontSize: 11, letterSpacing: "0.04em", textAlign: "left" }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.orderId} style={{ borderBottom: "1px solid #eee" }}>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {t.email}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {PRODUCT_LABEL[t.product] ?? t.product}
                {t.roleTitle && <span className="text-[#9c9c9c]"> · {t.roleTitle}</span>}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {t.level}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatAmount(t.amountPaise)}
              </td>
              <td style={{ padding: "10px 0", fontSize: 13 }}>
                <span className="font-[family-name:var(--font-poppins)] font-semibold uppercase" style={{ color: STATUS_COLOR[t.status], fontSize: 11.5 }}>
                  {t.status}
                </span>
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatDate(t.createdAt)}
              </td>
              <td style={{ padding: "10px 0" }}>
                <PaymentActions orderId={t.orderId} status={t.status} amountPaise={t.amountPaise} />
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={7} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ padding: "24px 0", fontSize: 14, textAlign: "center" }}>
                No payments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.1rem", margin: "0 0 14px" }}>
        Unlocked without payment
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            {["Candidate", "Unlock", "Date", ""].map((label) => (
              <th
                key={label}
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
                style={{ padding: "10px 0", fontSize: 11, letterSpacing: "0.04em", textAlign: "left" }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {unpaidUnlocks.map((u, i) => (
            <tr key={`${u.userId}-${u.kind}-${u.leadId ?? i}`} style={{ borderBottom: "1px solid #eee" }}>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {u.email}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {UNPAID_KIND_LABEL[u.kind]}
                {u.roleTitle && <span className="text-[#9c9c9c]"> · {u.roleTitle}</span>}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatDate(u.unlockedAt)}
              </td>
              <td style={{ padding: "10px 0" }}>
                <ReconcileForm userId={u.userId} leadId={u.leadId} product={u.kind} />
              </td>
            </tr>
          ))}
          {unpaidUnlocks.length === 0 && (
            <tr>
              <td colSpan={4} className="font-[family-name:var(--font-poppins)] text-[#16803c]" style={{ padding: "24px 0", fontSize: 14, textAlign: "center" }}>
                None — good.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
