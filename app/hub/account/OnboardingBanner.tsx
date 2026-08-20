"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "merito-hub-onboarding-dismissed";

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

// SSR (and the very first client paint, before hydration) can't read
// localStorage -- render the banner hidden by default and let
// useSyncExternalStore re-sync to the real value right after hydration.
// This avoids both a hydration mismatch and the setState-in-an-effect
// pattern a plain useEffect read would need.
function getServerSnapshot() {
  return true;
}

export default function OnboardingBanner({ roleTitle }: { roleTitle: string }) {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private browsing / storage disabled -- the banner just reappears
      // next visit, which is a fine fallback.
    }
    // The native `storage` event only fires in *other* tabs -- dispatch one
    // here so this tab's useSyncExternalStore subscription re-reads too.
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div
      role="note"
      className="flex items-start bg-[#ed1a24]/[0.08] border border-[#ed1a24]/[0.25]"
      style={{ borderRadius: 16, padding: "16px 18px", gap: 12 }}
    >
      <span
        className="flex items-center justify-center text-[#ed1a24] shrink-0"
        style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #ed1a24", fontSize: 12, fontWeight: 700, marginTop: 1 }}
        aria-hidden="true"
      >
        i
      </span>
      <div style={{ flex: 1 }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13.5, margin: 0 }}>
          New here? Quick orientation.
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "4px 0 0" }}>
          Your score and report are specific to {roleTitle || "the role you checked"}. Personality and reference checks live under
          &quot;Your profile.&quot; Do them once, they apply everywhere.
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss orientation banner"
        className="flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0"
        style={{ width: 24, height: 24, background: "none", border: "none", cursor: "pointer" }}
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
