"use client";

import { use, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import { getAbsoluteUrl } from "@/lib/site";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = use(searchParams);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;

    setStatus("sending");
    const supabase = createSupabaseBrowserClient();
    // `next` is re-validated against an allowlist server-side in
    // /hub/auth/callback — this is just passing the candidate value through.
    // Always include the `next` query (even empty) so the Supabase email
    // template can safely append `&token_hash=...` without conditional logic.
    const callbackPath = `/hub/auth/callback?next=${encodeURIComponent(next ?? "")}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // The exact URL this resolves to (both local and production) must be
        // added to the Supabase project's Auth → URL Configuration → Redirect URLs
        // allow-list, or the magic-link email will fail to redirect correctly.
        emailRedirectTo: getAbsoluteUrl(callbackPath),
      },
    });

    setStatus(error ? "error" : "sent");
  };

  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="bg-white border border-black/[0.08] mx-auto" style={{ maxWidth: 440, borderRadius: 24, padding: 32, boxShadow: "0px 18px 50px rgba(17,35,89,0.05)" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: 0 }}>
          Sign in to Merito HUB
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.6, margin: "10px 0 24px" }}>
          Enter your email and we&apos;ll send you a link to sign in — no password needed.
        </p>

        {status === "sent" ? (
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Check your inbox — we&apos;ve sent a sign-in link to {email.trim()}.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
              style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white transition-colors"
              style={{
                height: 50,
                borderRadius: 8,
                fontSize: 15,
                background: status === "sending" ? "#dcdcdc" : "#ed1a24",
                cursor: status === "sending" ? "default" : "pointer",
                border: "none",
              }}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>
                Something went wrong — please try again.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
