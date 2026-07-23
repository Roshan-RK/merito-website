"use client";

import { useMemo, useState } from "react";
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
      <div
        className="bg-white border border-black/[0.08]"
        style={{ borderRadius: 20, padding: 28, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
      >
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: "0 0 8px" }}>
          Big Five (OCEAN) Personality Test
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          A short questionnaire that maps how you tend to think, work and relate to others across five broad dimensions of personality — for {roleTitle}.
        </p>
        <div className="flex flex-wrap" style={{ gap: 10, marginBottom: 18 }}>
          {[`${ALL.length} scored statements`, "~11 minutes", "No right or wrong answers"].map((b) => (
            <span
              key={b}
              className="bg-[#fdf8fb] font-[family-name:var(--font-poppins)] text-[#4b4b4d]"
              style={{ fontSize: 12.5, borderRadius: 999, padding: "7px 13px", border: "1px solid #ece4da" }}
            >
              {b}
            </span>
          ))}
        </div>
        <ul className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.8, margin: "0 0 20px", paddingLeft: 18 }}>
          <li>Rate how accurately each statement describes you, from 1 (very inaccurate) to 5 (very accurate).</li>
          <li>Answer for how you actually are — not how you think you should be.</li>
          <li>Try not to sit on the fence: pick the side that fits you better.</li>
          <li>A few statements are worded in reverse, so read each one carefully.</li>
        </ul>
        <button
          onClick={() => setPhase("quiz")}
          className="font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 50, padding: "0 26px", borderRadius: 8, fontSize: 15, background: "#ed1a24", border: "none", cursor: "pointer", boxShadow: "0 4px 6px rgba(236,34,40,0.3)" }}
        >
          Start test
        </button>
        <p className="text-[#9c9c9c]" style={{ fontSize: 12, marginTop: 12 }}>Your answers stay private and are only used to build your Merito profile.</p>
      </div>
    );
  }

  // phase === "quiz"
  return (
    <div>
      <div className="sticky bg-[#fdf8fb]" style={{ top: 0, zIndex: 10, padding: "10px 0" }}>
        <div className="flex items-center justify-between font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, marginBottom: 6 }}>
          <span>Set {page + 1} of {PAGES}</span>
          <span>{answeredCount}/{ALL.length} answered</span>
        </div>
        <div className="bg-[#f0e6ea] overflow-hidden" style={{ height: 8, borderRadius: 6 }}>
          <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: `${(answeredCount / ALL.length) * 100}%`, transition: "width .25s ease" }} />
        </div>
      </div>

      <div
        className="bg-white border border-black/[0.08]"
        style={{ borderRadius: 20, padding: "20px 24px", marginTop: 10, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
      >
        <div className="hidden sm:grid font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ gridTemplateColumns: "1fr repeat(5,64px)", fontSize: 10.5, textAlign: "center", marginBottom: 10 }}>
          <div />
          <div>Very inaccurate</div>
          <div>Moderately inaccurate</div>
          <div>Neither</div>
          <div>Moderately accurate</div>
          <div>Very accurate</div>
        </div>

        {pageItems.map((it, i) => (
          <div key={it.id} className="border-b border-[#ece4da]" style={{ padding: "14px 0" }}>
            <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, margin: "0 0 10px" }}>
              <span className="font-bold text-[#ed1a24]" style={{ marginRight: 8 }}>{page * PER_PAGE + i + 1}.</span>
              {it.s}
            </p>
            <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAnswer(it.id, v)}
                  aria-pressed={answers[it.id] === v}
                  className="font-[family-name:var(--font-poppins)] font-semibold"
                  style={{
                    height: 42,
                    borderRadius: 8,
                    border: answers[it.id] === v ? "1px solid #ed1a24" : "1px solid #dfdcd6",
                    background: answers[it.id] === v ? "#ed1a24" : "#fff",
                    color: answers[it.id] === v ? "#fff" : "#6e6e6e",
                    cursor: "pointer",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}

        {hint && <p style={{ color: "#ed1a24", fontSize: 13, marginTop: 10 }}>{hint}</p>}
        {error && <p style={{ color: "#ed1a24", fontSize: 13, marginTop: 10 }}>{error}</p>}

        <div className="flex items-center justify-between" style={{ marginTop: 20 }}>
          <button
            onClick={() => { setPage((p) => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
            className="font-[family-name:var(--font-poppins)] font-semibold"
            style={{ visibility: page === 0 ? "hidden" : "visible", height: 46, padding: "0 20px", borderRadius: 8, fontSize: 14, background: "#fff", border: "1px solid #dcdcdc", cursor: "pointer" }}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            className="font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ height: 46, padding: "0 24px", borderRadius: 8, fontSize: 14, background: saving ? "#dcdcdc" : "#ed1a24", border: "none", cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Scoring…" : page === PAGES - 1 ? "See my results" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
