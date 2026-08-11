"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import { getAbsoluteUrl } from "@/lib/site";

type LoadState =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; candidateName: string | null; roleLabel: string; score: number }
  | { kind: "sent" };

export default function ClaimForm({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/public/claim/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setState({ kind: "ready", candidateName: data.candidateName, roleLabel: data.roleLabel, score: data.score });
        } else {
          setState({ kind: "invalid", reason: data.reason });
        }
      })
      .catch(() => setState({ kind: "invalid", reason: "not_found" }));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getAbsoluteUrl(`/claim/${token}/confirm`) },
    });
    setSending(false);
    setState({ kind: "sent" });
  }

  if (state.kind === "loading") return <p>Loading…</p>;
  if (state.kind === "invalid") {
    const messages: Record<string, string> = {
      not_found: "This link isn't valid.",
      already_converted: "This profile has already been claimed.",
    };
    return <p>{messages[state.reason] || "This link isn't valid."}</p>;
  }
  if (state.kind === "sent") {
    return <p>Check your inbox — we&apos;ve sent a sign-in link to {email.trim()}.</p>;
  }

  return (
    <div>
      <h1>{state.candidateName || "You"}, a recruiter scored your profile</h1>
      <p>
        Fit for {state.roleLabel}: <strong>{state.score}/10</strong>
      </p>
      <p>Sign in to claim this score and see the full report on Merito HUB.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Claim my profile"}
        </button>
      </form>
    </div>
  );
}
