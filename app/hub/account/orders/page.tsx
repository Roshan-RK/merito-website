import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { buildOrderHistoryRows, type LeadContext, type RazorpayTransactionRow } from "./orderHistory";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  // RLS on razorpay_transactions already scopes rows to auth.uid() = user_id,
  // but we still filter explicitly so this query reads the same as every
  // other panel's Supabase calls.
  const { data: transactions } = await supabase
    .from("razorpay_transactions")
    .select("order_id, product, amount_paise, status, lead_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const leadIds = Array.from(
    new Set((transactions ?? []).map((t) => t.lead_id).filter((id): id is string => Boolean(id)))
  );

  const leadsById = new Map<string, LeadContext>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from("fitment_leads").select("id, role_title").in("id", leadIds);
    for (const lead of leads ?? []) {
      leadsById.set(lead.id as string, { role_title: lead.role_title as string });
    }
  }

  const rows = buildOrderHistoryRows((transactions ?? []) as RazorpayTransactionRow[], leadsById);

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 1040, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <Link
          href="/hub/account"
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white/55 hover:text-white transition-colors"
          style={{ gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={14} strokeWidth={2} /> Back to dashboard
        </Link>

        <div>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Account
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0 }}>
            Order history
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
            Every purchase you&apos;ve made, logged automatically.
          </p>
        </div>

        <div className="bg-[#141416] border border-white/[0.08] overflow-hidden" style={{ borderRadius: 14 }}>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center text-center" style={{ gap: 12, padding: "64px 24px" }}>
              <div
                className="flex items-center justify-center bg-white/[0.06] text-white/40"
                style={{ width: 48, height: 48, borderRadius: "50%" }}
              >
                <ReceiptText size={20} strokeWidth={2} />
              </div>
              <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, maxWidth: 280 }}>
                No purchases yet. Unlock a report or start a test to see your history here.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {["Item", "Context", "Amount", "Date"].map((heading) => (
                      <th
                        key={heading}
                        className="text-left font-[family-name:var(--font-poppins)] font-semibold uppercase text-white/40"
                        style={{ fontSize: 10.5, letterSpacing: "0.05em", padding: "12px 20px" }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                      <td
                        className="font-[family-name:var(--font-poppins)] font-medium text-white"
                        style={{ fontSize: 13.5, padding: "14px 20px" }}
                      >
                        {row.item}
                      </td>
                      <td
                        className="font-[family-name:var(--font-poppins)] text-white/50"
                        style={{ fontSize: 13, padding: "14px 20px" }}
                      >
                        {row.context}
                      </td>
                      <td className="font-mono font-semibold text-white" style={{ fontSize: 13.5, padding: "14px 20px" }}>
                        {row.amountLabel}
                      </td>
                      <td className="font-mono text-white/40" style={{ fontSize: 12, padding: "14px 20px" }}>
                        {row.dateLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
