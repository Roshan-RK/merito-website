"use client";

import { useEffect, useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "knowledge-application", label: "Knowledge application" },
  { value: "initiative", label: "Initiative" },
  { value: "teamwork", label: "Teamwork" },
  { value: "communication", label: "Communication" },
  { value: "discipline", label: "Discipline" },
  { value: "problem-solving", label: "Problem-solving" },
  { value: "leadership-skills", label: "Leadership skills" },
];

type LoadState =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; refereeName: string }
  | { kind: "submitted" };

export default function FeedbackForm({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/hub/references/feedback/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setState({ kind: "ready", refereeName: data.refereeName });
        } else {
          setState({ kind: "invalid", reason: data.reason });
        }
      })
      .catch(() => setState({ kind: "invalid", reason: "not_found" }));
  }, [token]);

  async function submit(payload: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/references/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setState({ kind: "submitted" });
    } catch {
      setBusy(false);
      setError("Something went wrong — please try again.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ratingsList = CATEGORIES.map((c) => ({ category: c.value, value: ratings[c.value] }));
    if (ratingsList.some((r) => !r.value)) {
      setError("Please rate every category.");
      return;
    }
    await submit({ ratings: ratingsList, overallFeedback });
  }

  async function handleDecline() {
    await submit({ declined: true });
  }

  if (state.kind === "loading") return <p>Loading…</p>;
  if (state.kind === "invalid") {
    const messages: Record<string, string> = {
      not_found: "This feedback link isn't valid.",
      expired: "This feedback link has expired.",
      used: "This feedback link has already been used.",
    };
    return <p>{messages[state.reason] || "This feedback link isn't valid."}</p>;
  }
  if (state.kind === "submitted") return <p>Thanks — your feedback has been recorded.</p>;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem" }}>
        Rate {state.refereeName}
      </h1>
      {CATEGORIES.map((cat) => (
        <div key={cat.value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13 }}>{cat.label}</span>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setRatings({ ...ratings, [cat.value]: value })}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #dcdcdc",
                background: ratings[cat.value] === value ? "#ed1a24" : "white",
                color: ratings[cat.value] === value ? "white" : "black",
                cursor: "pointer",
              }}
            >
              {value}
            </button>
          ))}
        </div>
      ))}
      <textarea
        placeholder="Overall feedback"
        value={overallFeedback}
        onChange={(e) => setOverallFeedback(e.target.value)}
        required
        style={{ minHeight: 100, borderRadius: 8, border: "1px solid #dcdcdc", padding: 12, fontSize: 13 }}
      />
      {error && <p style={{ fontSize: 12.5, color: "#ed1a24" }}>{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={busy}
          style={{ flex: 1, height: 46, borderRadius: 8, background: busy ? "#dcdcdc" : "#ed1a24", color: "white", border: "none", cursor: busy ? "default" : "pointer" }}
        >
          Submit
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={busy}
          style={{ height: 46, padding: "0 16px", borderRadius: 8, background: "white", border: "1px solid #dcdcdc", cursor: busy ? "default" : "pointer" }}
        >
          I can't do this
        </button>
      </div>
    </form>
  );
}
