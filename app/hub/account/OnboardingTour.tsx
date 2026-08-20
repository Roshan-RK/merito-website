"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Adapted from mockups/merito-dashboard-v34.html's 10-step tour (target/panel/
// title/body array + spotlight-overlay engine). That mockup is a single-page
// app with a panel switcher and a command palette -- this app has neither, so
// two of its steps are dropped outright (see below) and the rest are rewritten
// to describe this app's real, per-application behavior instead of the
// mockup's invented multi-app-switching and search features.
//
// Design choice: this tour is Overview-page-scoped, not cross-route. Every
// remaining step's target (ScoreCard, the 4 ProgressRail pills, CounsellingCard,
// BundlePromoCard, the Sidebar's Consolidated report link) already renders on
// this one page -- so unlike the mockup, no panel/route navigation is needed
// mid-tour. That also sidesteps having to persist tour progress across a full
// page navigation.
//
// Dropped vs. mockup:
// - "Switch applications" (app-switcher) -- no multi-app switcher exists yet
//   (separate, deferred project per this task's brief).
// - "Lost? Press ⌘K" (search) -- no search/command-palette exists in this app
//   (explicit product decision).
export type TourStep = {
  target: string;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    target: "score",
    title: "Your fitment score",
    body: "How well your CV matches this role's requirements. Apply to a different role and you'll get a fresh score just for that one.",
  },
  {
    target: "pill-report",
    title: "Fitment report",
    body: "Doesn't just explain your score -- it tells you specific fixes for your CV, so you walk into conversations already ahead.",
  },
  {
    target: "pill-personality",
    title: "Personality test",
    body: "One-time, and it applies to every application you make. Recruiters get a real read on culture fit instead of a guess.",
  },
  {
    target: "pill-references",
    title: "Reference checks",
    body: "Also one-time. Verified praise from people who've actually worked with you carries more weight than anything you'd say yourself.",
  },
  {
    target: "pill-interview",
    title: "Mock AI interview",
    body: "Practice the hard questions before the real thing, and see exactly where to tighten your answers.",
  },
  {
    target: "guidance",
    title: "Talk to a career expert",
    body: "Book 1:1 time with a Merito career coach who's already read your report, personality, and interview results.",
  },
  {
    target: "bundle",
    title: "Bundle when it's worth it",
    body: "We'll only suggest bundling report + personality + references when it actually saves you money -- never just to upsell you.",
  },
  {
    target: "nav-consolidated",
    title: "Everything in one place",
    body: "Once you're done, it all rolls into one shareable consolidated report you can download or send a link to.",
  },
];

// Same mechanism/key convention as OnboardingBanner.tsx: localStorage flag +
// useSyncExternalStore, so both bits of onboarding state survive reloads the
// same way and a dispatched "storage" event re-syncs same-tab subscribers.
const STORAGE_KEY = "merito-hub-tour-dismissed";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export function markTourDismissed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private browsing / storage disabled -- tour just offers to run again
    // next visit, which is a fine fallback.
  }
  window.dispatchEvent(new Event("storage"));
}

// Exported so QuickTipsCard can label its launch button "Take the tour" vs
// "Replay the tour" without duplicating the storage-read plumbing.
export function useTourDismissed() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Pure, DOM-free: walks from `fromIndex` in `direction` until it lands on a
// step whose target is present, or runs off the end (returns an out-of-range
// index). Mirrors the mockup's "target not found -> skip to next step"
// behavior, but direction-aware -- the mockup always skips forward even when
// the user pressed Back, which would make Back silently jump ahead if a step
// were missing. Only "bundle" is ever conditionally absent here (it's not
// rendered when the candidate isn't bundle-eligible), but this stays correct
// regardless of which/how many steps end up conditional later.
export function findVisibleStepIndex(
  steps: TourStep[],
  fromIndex: number,
  direction: 1 | -1,
  isPresent: (target: string) => boolean
): number {
  let i = fromIndex;
  while (i >= 0 && i < steps.length && !isPresent(steps[i].target)) {
    i += direction;
  }
  return i;
}

export type TooltipPlacement = { top?: number; bottom?: number; left: number; width: number };

// Pure placement math, split out from the component so it's testable without
// jsdom (this repo's vitest runs in the "node" environment). Same approach as
// the mockup: put the card below the target if there's reasonable room,
// otherwise above it; clamp horizontally so it never runs off-screen.
export function computeTooltipPlacement(
  rect: { top: number; bottom: number; left: number },
  viewportWidth: number,
  viewportHeight: number,
  cardWidth = 320
): TooltipPlacement {
  const spaceBelow = viewportHeight - rect.bottom;
  const left = Math.min(Math.max(16, rect.left), viewportWidth - cardWidth - 20);
  if (spaceBelow > 200) {
    return { top: rect.bottom + 16, left, width: cardWidth };
  }
  return { bottom: viewportHeight - rect.top + 16, left, width: cardWidth };
}

type Rect = { top: number; bottom: number; left: number; width: number; height: number };

function isTargetPresent(target: string) {
  return typeof document !== "undefined" && document.querySelector(`[data-tour="${target}"]`) !== null;
}

function readRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
}

export default function OnboardingTour({ onClose }: { onClose: () => void }) {
  // Resolved during the initial render (lazy initializer), not in an effect --
  // this is a client-only component only ever mounted after a user click, so
  // `document` is available here. Falls back to 0 in the pathological case
  // where nothing in TOUR_STEPS is present; the DOM-sync effect below then
  // just never finds a target and the tour renders nothing but stays
  // closeable via Escape.
  const [stepIndex, setStepIndex] = useState<number>(() => {
    const idx = findVisibleStepIndex(TOUR_STEPS, 0, 1, isTargetPresent);
    return idx >= 0 && idx < TOUR_STEPS.length ? idx : 0;
  });
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const close = () => {
    markTourDismissed();
    onClose();
  };

  const goTo = (fromIndex: number, direction: 1 | -1) => {
    const resolved = findVisibleStepIndex(TOUR_STEPS, fromIndex, direction, isTargetPresent);
    if (resolved < 0 || resolved >= TOUR_STEPS.length) {
      close();
      return;
    }
    setRect(null);
    setStepIndex(resolved);
  };

  const next = () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      close();
      return;
    }
    goTo(stepIndex + 1, 1);
  };

  const back = () => {
    if (stepIndex <= 0) return;
    goTo(stepIndex - 1, -1);
  };

  // Scroll the target into view and measure it whenever the step changes.
  // If the target's missing (shouldn't happen -- goTo/the initializer above
  // already resolve to a present target before stepIndex changes -- but the
  // DOM could theoretically shift under us), this just renders nothing for
  // that step rather than re-navigating synchronously from inside an effect.
  useEffect(() => {
    const step = TOUR_STEPS[stepIndex];
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setRect(readRect(step.target)), 260);
    return () => clearTimeout(timer);
  }, [stepIndex]);

  // Focus the tooltip card once it's positioned, so keyboard users land
  // somewhere sensible on each step change.
  useEffect(() => {
    if (rect) cardRef.current?.focus({ preventScroll: true });
  }, [rect]);

  // Keep the spotlight aligned if the viewport resizes mid-tour.
  useEffect(() => {
    const onResize = () => {
      const step = TOUR_STEPS[stepIndex];
      if (step) setRect(readRect(step.target));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [stepIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  if (!rect) return null;

  const step = TOUR_STEPS[stepIndex];
  const placement = computeTooltipPlacement(rect, window.innerWidth, window.innerHeight);
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          borderRadius: 12,
          border: "2px solid #ed1a24",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
          pointerEvents: "none",
          zIndex: 300,
          transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
        }}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Guided tour, step ${stepIndex + 1} of ${TOUR_STEPS.length}: ${step.title}`}
        tabIndex={-1}
        className="bg-[#141416] border border-white/[0.08]"
        style={{
          position: "fixed",
          top: placement.top,
          bottom: placement.bottom,
          left: placement.left,
          width: placement.width,
          borderRadius: 14,
          padding: 18,
          zIndex: 301,
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          outline: "none",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <span
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]"
            style={{ fontSize: 10.5, letterSpacing: "0.06em" }}
          >
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={close}
            aria-label="Close guided tour"
            className="flex items-center justify-center text-white/40 hover:text-white transition-colors"
            style={{ width: 22, height: 22, background: "none", border: "none", cursor: "pointer" }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 14.5, margin: "0 0 6px" }}>
          {step.title}
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          {step.body}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={back}
            disabled={stepIndex === 0}
            className="flex items-center font-[family-name:var(--font-poppins)] font-medium text-white/60 hover:text-white transition-colors"
            style={{ gap: 4, fontSize: 12, background: "none", border: "none", cursor: stepIndex === 0 ? "default" : "pointer", opacity: stepIndex === 0 ? 0 : 1 }}
          >
            <ChevronLeft size={13} strokeWidth={2} />
            Back
          </button>

          <div className="flex items-center" style={{ gap: 14 }}>
            <button
              onClick={close}
              className="font-[family-name:var(--font-poppins)] font-medium text-white/40 hover:text-white transition-colors"
              style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer" }}
            >
              Skip
            </button>
            <button
              onClick={next}
              className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
              style={{ gap: 4, fontSize: 12.5, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight size={13} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
