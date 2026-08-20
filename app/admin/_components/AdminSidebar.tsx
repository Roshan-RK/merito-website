"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import Button from "@/app/admin/_components/Button";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin" },
  { label: "Candidates", href: "/admin/candidates" },
  { label: "Recruiters", href: "/admin/recruiters" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Counselling", href: "/admin/counselling" },
  { label: "Extension", href: "/admin/extension" },
  { label: "Pipeline Failures", href: "/admin/pipeline-failures" },
  { label: "Learned Skills", href: "/admin/learned-skills" },
  { label: "Email Templates", href: "/admin/email-templates" },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/hub/login");
  }

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "28px 20px",
      }}
    >
      <p className="font-[family-name:var(--font-gabarito)] font-semibold" style={{ fontSize: "1.2rem", margin: "0 0 32px" }}>
        Merito Admin
      </p>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname ?? "", item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="font-[family-name:var(--font-poppins)] font-semibold"
              style={{
                fontSize: 14,
                padding: "10px 12px",
                borderRadius: 8,
                color: active ? "#fff" : "rgba(255,255,255,0.6)",
                background: active ? "#ed1a24" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 16, marginTop: 16 }}>
        <p
          className="font-[family-name:var(--font-poppins)]"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 10px", wordBreak: "break-all" }}
        >
          {adminEmail}
        </p>
        <Button variant="danger" onClick={handleSignOut} loading={signingOut} style={{ width: "100%" }}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
