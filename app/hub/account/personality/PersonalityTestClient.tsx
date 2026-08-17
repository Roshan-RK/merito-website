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

  const answeredCount = Object.keys(answers).length;
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
        setError(data.error || "Something went wrong — please try again.");
        setSaving(false);
        return;
      }
      setResult({ scores: data.scores, validity: data.validity });
      setSaving(false);
      setPhase("report");
      window.scrollTo(0, 0);
    } catch {
      setError("Something went wrong — please try again.");
      setSaving(false);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setPage(0);
    setResult(null);
    setPhase("intro");
    window.scrollTo(0, 0);
  };

  if (phase === "report" && result) {
    return (
      <PersonalityReport
        candidateName={candidateName}
        roleTitle={roleTitle}
        scores={result.scores}
        validity={result.validity}
        onRetake={handleRetake}
      />
    );
  }

  if (phase === "intro") {
    return (
      <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 24 }}>
        <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
          <div
            className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0"
            style={{ width: 40, height: 40, borderRadius: 10 }}
          >
            <ClipboardList size={19} strokeWidth={2} />
          </div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.4rem", margin: 0 }}>
            Big Five (OCEAN) Personality Test
          </h1>
        </div>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 16px" }}>
          A short questionnaire that maps how you tend to think, work and relate to others across five broad dimensions of personality — for {roleTitle}.
        </p>
        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 20 }}>
          {[`${ALL.length} scored statements`, "~11 minutes", "No right or wrong answers"].map((b) => (
            <span
              key={b}
              className="bg-white/[0.05] border border-white/[0.08] font-[family-name:var(--font-poppins)] text-white/60"
              style={{ fontSize: 12, borderRadius: 999, padding: "6px 13px" }}
            >
              {b}
            </span>
          ))}
        </div>
        <ul className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, lineHeight: 1.8, margin: "0 0 22px", paddingLeft: 18 }}>
          <li>Rate how accurately each statement describes you, from 1 (very inaccurate) to 5 (very accurate).</li>
          <li>Answer for how you actually are — not how you think you should be.</li>
          <li>Try not to sit on the fence: pick the side that fits you better.</li>
          <li>A few statements are worded in reverse, so read each one carefully.</li>
        </ul>
        <button
          onClick={() => setPhase("quiz")}
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
          style={{ gap: 8, height: 48, padding: "0 24px", borderRadius: 8, fontSize: 14.5, border: "none", cursor: "pointer" }}
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
  return (
    <div>
      <div className="sticky bg-[#0a0a0a]" style={{ top: 0, zIndex: 10, padding: "10px 0" }}>
        <div className="flex items-center justify-between font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12.5, marginBottom: 8 }}>
          <span>
            Set {page + 1} of {PAGES}
          </span>
          <span>
            {answeredCount}/{ALL.length} answered
          </span>
        </div>
        <div
          className="bg-white/[0.08] overflow-hidden"
          style={{ height: 8, borderRadius: 6 }}
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={ALL.length}
          aria-label="Test progress"
        >
          <div
            className="bg-[#ed1a24] h-full"
            style={{ borderRadius: 6, width: `${(answeredCount / ALL.length) * 100}%`, transition: "width .25s ease" }}
          />
        </div>
      </div>

      <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: "20px 24px", marginTop: 10 }}>
        <div
          className="hidden sm:grid font-[family-name:var(--font-poppins)] text-white/35"
          style={{ gridTemplateColumns: "1fr repeat(5,64px)", fontSize: 10.5, textAlign: "center", marginBottom: 12 }}
        >
          <div />
          {SCALE_LABELS.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>

        {pageItems.map((it, i) => {
          const qNum = page * PER_PAGE + i + 1;
          return (
            <div key={it.id} className="border-b border-white/[0.08]" style={{ padding: "16px 0" }}>
              <p id={`q-${it.id}-label`} className="font-[family-name:var(--font-poppins)] text-white/85" style={{ fontSize: 14.5, margin: "0 0 10px" }}>
                <span className="font-bold text-[#ed1a24]" style={{ marginRight: 8 }}>
                  {qNum}.
                </span>
                {it.s}
              </p>
              <div role="radiogroup" aria-labelledby={`q-${it.id}-label`} className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((v) => {
                  const selected = answers[it.id] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAnswer(it.id, v)}
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${v} — ${SCALE_LABELS[v - 1]}`}
                      className={
                        "font-[family-name:var(--font-poppins)] font-semibold border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#ed1a24] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416] " +
                        (selected
                          ? "border-[#ed1a24] bg-[#ed1a24] text-white"
                          : "border-white/[0.12] bg-white/[0.03] text-white/60 hover:border-white/25 hover:bg-white/[0.06]")
                      }
                      style={{ height: 42, borderRadius: 8, cursor: "pointer" }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

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
            className="font-[family-name:var(--font-poppins)] font-semibold text-white/60 hover:text-white transition-colors"
            style={{
              visibility: page === 0 ? "hidden" : "visible",
              height: 46,
              padding: "0 20px",
              borderRadius: 8,
              fontSize: 14,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
            }}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            className={
              "font-[family-name:var(--font-poppins)] font-semibold text-white transition-colors " +
              (saving ? "bg-white/[0.12]" : "bg-[#ed1a24] hover:bg-[#c8151e]")
            }
            style={{ height: 46, padding: "0 24px", borderRadius: 8, fontSize: 14, border: "none", cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Scoring…" : page === PAGES - 1 ? "See my results" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
