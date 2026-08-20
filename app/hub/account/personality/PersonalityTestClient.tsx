"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Play } from "lucide-react";
import {
  ITEMS,
  IMPRESSION_ITEMS,
  isCompleteAnswerSet,
  type Answers,
  type Scores,
  type Validity,
} from "@/lib/personality";
import PersonalityReport from "./PersonalityReport";

const ALL = [...ITEMS, ...IMPRESSION_ITEMS];
const PER_PAGE = 13;
const PAGES = Math.ceil(ALL.length / PER_PAGE);
const SCALE_LABELS = ["Very inaccurate", "Moderately inaccurate", "Neither", "Moderately accurate", "Very accurate"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "intro" | "quiz" | "report";
type Result = { scores: Scores; validity: Validity };

export default function PersonalityTestClient({
  roleTitle,
  candidateName,
  initialResult,
}: {
  roleTitle: string;
  candidateName: string;
  initialResult: Result | null;
}) {
  const [phase, setPhase] = useState<Phase>(initialResult ? "report" : "intro");
  const [result, setResult] = useState<Result | null>(initialResult);
  const [order] = useState(() => shuffle(ALL));
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [hint, setHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageItems = useMemo(() => order.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE), [order, page]);
  const pageComplete = pageItems.every((it) => it.id in answers);

  const setAnswer = (id: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setHint("");
  };

  const handleNext = async () => {
    if (!pageComplete) {
      setHint("Please answer every statement on this set before continuing.");
      return;
    }
    if (page < PAGES - 1) {
      setPage((p) => p + 1);
      window.scrollTo(0, 0);
      return;
    }
    if (!isCompleteAnswerSet(answers)) {
      setHint("Please answer every statement before seeing your results.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/save-personality-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTitle, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSaving(false);
        return;
      }
      setResult({ scores: data.scores, validity: data.validity });
      setSaving(false);
      setPhase("report");
      window.scrollTo(0, 0);
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  if (phase === "report" && result) {
    return (
      <PersonalityReport
        candidateName={candidateName}
        roleTitle={roleTitle}
        scores={result.scores}
        validity={result.validity}
      />
    );
  }

  if (phase === "intro") {
    return (
      <div style={{ background: "rgb(29,25,31)", border: "1px solid rgb(49,47,55)", borderRadius: 14, padding: 24 }}>
        <div className="flex items-center" style={{ gap: 10, marginBottom: 12 }}>
          <ClipboardList size={20} strokeWidth={2} className="text-[#ed1a24]" />
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15 }}>
            Big Five (OCEAN) Personality Test
          </span>
        </div>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 16px" }}>
          A short questionnaire that maps how you tend to think, work and relate to others across five broad dimensions of personality &mdash; for {roleTitle}.
        </p>
        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 20 }}>
          {[`${ALL.length} scored statements`, "~11 minutes", "No right or wrong answers"].map((b) => (
            <span
              key={b}
              className="font-[family-name:var(--font-poppins)] text-white/55"
              style={{ fontSize: 11, borderRadius: 999, padding: "4px 12px", border: "1px solid rgb(49,47,55)" }}
            >
              {b}
            </span>
          ))}
        </div>
        <div className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ margin: 0 }}>Rate how accurately each statement describes you, from 1 (very inaccurate) to 5 (very accurate).</p>
          <p style={{ margin: 0 }}>Answer for how you actually are &mdash; not how you think you should be.</p>
          <p style={{ margin: 0 }}>Try not to sit on the fence: pick the side that fits you better.</p>
          <p style={{ margin: 0 }}>A few statements are worded in reverse, so read each one carefully.</p>
        </div>
        <button
          onClick={() => setPhase("quiz")}
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
          style={{ gap: 8, height: 48, padding: "0 24px", borderRadius: 8, fontSize: 14.5, border: "none", cursor: "pointer", boxShadow: "0 4px 6px rgba(236,34,40,0.3)" }}
        >
          <Play size={15} strokeWidth={2} fill="currentColor" />
          Start test
        </button>
        <p className="text-white/35" style={{ fontSize: 12, marginTop: 14 }}>
          Your answers stay private and are only used to build your Merito profile.
        </p>
      </div>
    );
  }

  // phase === "quiz"
  const qStart = page * PER_PAGE + 1;
  const qEnd = page * PER_PAGE + pageItems.length;
  return (
    <div>
      <div style={{ borderRadius: 14, padding: "20px 24px", background: "rgb(29,25,31)", border: "1px solid rgb(49,47,55)" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-white/55" style={{ fontSize: 13 }}>
            Question {qStart}&ndash;{qEnd} of {ALL.length}
          </span>
          <div className="bg-white/[0.08] overflow-hidden" style={{ height: 6, width: 128, borderRadius: 999 }}>
            <div
              className="bg-[#ed1a24] h-full"
              style={{ borderRadius: 999, width: `${((page + 1) / PAGES) * 100}%`, transition: "width .25s ease" }}
            />
          </div>
        </div>

        <div
          className="hidden sm:flex font-[family-name:var(--font-poppins)] text-white/35"
          style={{ gap: 8, fontSize: 9, textAlign: "center", marginBottom: 6 }}
        >
          <div style={{ flex: 1 }} />
          {SCALE_LABELS.map((l) => (
            <div key={l} style={{ width: 48, lineHeight: 1.2 }}>
              {l}
            </div>
          ))}
        </div>

        <div>
          {pageItems.map((it, i) => {
            const qNum = page * PER_PAGE + i + 1;
            return (
              <div
                key={it.id}
                className="border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center"
                style={{ gap: 12, padding: "14px 0" }}
              >
                <p id={`q-${it.id}-label`} className="font-[family-name:var(--font-poppins)] text-white/85" style={{ fontSize: 14, margin: 0, flex: 1, minWidth: 0 }}>
                  <span className="font-semibold text-[#ed1a24]" style={{ marginRight: 6 }}>
                    {qNum}.
                  </span>
                  {it.s}
                </p>
                <div role="radiogroup" aria-labelledby={`q-${it.id}-label`} className="flex shrink-0" style={{ gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((v) => {
                    const selected = answers[it.id] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAnswer(it.id, v)}
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${v}: ${SCALE_LABELS[v - 1]}`}
                        className={
                          "font-[family-name:var(--font-poppins)] font-medium border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#ed1a24] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416] " +
                          (selected
                            ? "border-[#ed1a24] bg-[#ed1a24]/15 text-[#ed1a24]"
                            : "border-white/[0.12] text-white/50 hover:border-[#ed1a24]/40")
                        }
                        style={{ width: 48, height: 40, borderRadius: 8, fontSize: 14, cursor: "pointer" }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {hint && (
          <p role="alert" style={{ color: "#E8798F", fontSize: 13, marginTop: 12 }}>
            {hint}
          </p>
        )}
        {error && (
          <p role="alert" style={{ color: "#E8798F", fontSize: 13, marginTop: 12 }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-between" style={{ marginTop: 22 }}>
          <button
            onClick={() => {
              setPage((p) => Math.max(0, p - 1));
              window.scrollTo(0, 0);
            }}
            disabled={page === 0}
            className="font-[family-name:var(--font-poppins)] font-medium text-white/50 hover:text-white transition-colors"
            style={{
              opacity: page === 0 ? 0 : 1,
              background: "none",
              border: "none",
              fontSize: 12,
              cursor: page === 0 ? "default" : "pointer",
            }}
          >
            &larr; Back
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            className={
              "font-[family-name:var(--font-poppins)] font-semibold text-white transition-colors " +
              (saving ? "bg-white/[0.12]" : "bg-[#ed1a24] hover:bg-[#c8151e]")
            }
            style={{ height: 46, padding: "0 24px", borderRadius: 8, fontSize: 14, border: "none", cursor: saving ? "default" : "pointer", boxShadow: saving ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
          >
            {saving ? "Scoring…" : page === PAGES - 1 ? "Finish test" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
