"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/hub");
  };

  return (
    <button
      onClick={handleSignOut}
      className="font-[family-name:var(--font-poppins)] font-semibold"
      style={{
        height: 40,
        padding: "0 16px",
        borderRadius: 8,
        fontSize: 13,
        background: "transparent",
        color: "#ed1a24",
        border: "1px solid rgba(237,26,36,0.4)",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
