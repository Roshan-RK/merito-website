import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", marginBottom: 12 }}>
        Merito Admin
      </h1>
      <nav className="flex" style={{ gap: 16, marginBottom: 24 }}>
        <Link href="/admin" className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 13 }}>
          Funnel overview
        </Link>
        <Link href="/admin/candidates" className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 13 }}>
          Candidates
        </Link>
        <Link href="/admin/payments" className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 13 }}>
          Payments
        </Link>
      </nav>
      {children}
    </main>
  );
}
