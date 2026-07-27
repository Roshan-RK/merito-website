"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import SignOutButton from "./SignOutButton";

export default function TopBar({
  roleTitle,
  userName,
  onChangeRole,
}: {
  roleTitle: string;
  userName: string;
  onChangeRole: () => void;
}) {
  const router = useRouter();

  const handleBackToSite = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm("Leave Hub and sign out?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header
      className="print:hidden sticky top-0 bg-white border-b border-black/[0.08] flex items-center justify-between"
      style={{ height: 66, padding: "0 24px", zIndex: 20, boxShadow: "0 8px 22px rgba(17,35,89,0.06)" }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        <Link href="/" onClick={handleBackToSite} className="flex items-center" style={{ gap: 10 }}>
          <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
          <span
            className="bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold"
            style={{ fontSize: 10, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
          >
            HUB
          </span>
        </Link>
        <Link
          href="/hub/account"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d] hidden sm:inline hover:text-[#ed1a24] transition-colors"
          style={{ fontSize: 13 }}
        >
          Dashboard
        </Link>
        <Link
          href="/"
          onClick={handleBackToSite}
          className="hidden lg:inline font-[family-name:var(--font-poppins)] font-semibold text-[#9c9c9c] hover:text-[#ed1a24] transition-colors"
          style={{ fontSize: 12 }}
        >
          ← Merito.ai
        </Link>
      </div>

      <div className="flex items-center" style={{ gap: 12 }}>
        <button
          onClick={onChangeRole}
          className="flex items-center bg-[#fdeced] font-[family-name:var(--font-poppins)] font-semibold text-black"
          style={{ borderRadius: 50, padding: "6px 6px 6px 14px", fontSize: 12, border: "none", cursor: "pointer", gap: 8 }}
        >
          <span className="hidden sm:inline">{roleTitle}</span>
          <span
            className="bg-[#ed1a24] text-white"
            style={{ borderRadius: 50, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}
          >
            Change
          </span>
        </button>
        <div
          title={userName}
          className="bg-[#fdeced] flex items-center justify-center font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]"
          style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 13 }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
