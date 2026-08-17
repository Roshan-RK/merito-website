"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, HelpCircle } from "lucide-react";
import SignOutButton from "./SignOutButton";

// Closes any open dropdown when a click lands outside every registered
// trigger/panel pair, or when Escape is pressed -- shared by the three
// header menus below instead of duplicating the listener three times.
function useDismiss(open: boolean, onDismiss: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (refs.every((ref) => ref.current && !ref.current.contains(e.target as Node))) onDismiss();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onDismiss, refs]);
}

export default function TopBar({
  roleTitle,
  userName,
  userEmail,
  onChangeRole,
}: {
  roleTitle: string;
  userName: string;
  userEmail: string;
  onChangeRole: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<"none" | "notifications" | "help" | "avatar">("none");
  const notifTriggerRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const helpPanelRef = useRef<HTMLDivElement>(null);
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);
  const avatarPanelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpenMenu("none");

  useDismiss(openMenu === "notifications", close, [notifTriggerRef, notifPanelRef]);
  useDismiss(openMenu === "help", close, [helpTriggerRef, helpPanelRef]);
  useDismiss(openMenu === "avatar", close, [avatarTriggerRef, avatarPanelRef]);

  return (
    <header
      className="print:hidden sticky top-0 bg-[#0a0a0a] border-b border-white/[0.08] flex items-center justify-between"
      style={{ height: 66, padding: "0 20px", zIndex: 30, gap: 16 }}
    >
      <div className="flex items-center shrink-0" style={{ gap: 10 }}>
        <Link href="/hub/account" className="flex items-center" style={{ gap: 10 }}>
          <Image src="/logo-white.png" alt="Merito" width={100} height={28} style={{ height: 22, width: "auto" }} />
          <span
            className="bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold"
            style={{ fontSize: 10, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
          >
            HUB
          </span>
        </Link>
      </div>

      {/* Visual-only: this build has no search index or command palette behind
          it. Rendered disabled rather than omitted so the header keeps the
          mockup's proportions; wire it up when search ships. */}
      <div
        className="hidden md:flex items-center flex-1 bg-white/[0.05] border border-white/[0.08] text-white/35"
        style={{ maxWidth: 380, height: 38, borderRadius: 10, padding: "0 12px", gap: 8, cursor: "not-allowed" }}
        title="Search is not available yet"
      >
        <Search size={15} strokeWidth={2} />
        <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13 }}>
          Search or jump to...
        </span>
      </div>

      <div className="flex items-center shrink-0" style={{ gap: 10 }}>
        {/* Single-application model: today's data is always "the latest role
            you checked fitment for", so this is a static label (+ the real
            Change-role flow) rather than the mockup's multi-app switcher,
            which needs a ?lead= selector this app doesn't have yet. */}
        <button
          onClick={onChangeRole}
          className="hidden sm:flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ borderRadius: 50, padding: "6px 6px 6px 14px", fontSize: 12.5, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", gap: 8 }}
        >
          <span>{roleTitle}</span>
          <span className="bg-[#ed1a24] text-white" style={{ borderRadius: 50, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
            Change
          </span>
        </button>

        <div className="relative">
          <button
            ref={notifTriggerRef}
            onClick={() => setOpenMenu(openMenu === "notifications" ? "none" : "notifications")}
            aria-label="Notifications"
            aria-expanded={openMenu === "notifications"}
            aria-haspopup="dialog"
            className="relative flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-white"
            style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
          >
            <Bell size={16} strokeWidth={2} />
          </button>
          {openMenu === "notifications" && (
            <div
              ref={notifPanelRef}
              role="dialog"
              aria-label="Notifications"
              className="absolute right-0 bg-[#141416] border border-white/[0.1]"
              style={{ top: 46, width: 280, borderRadius: 14, padding: 8, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}
            >
              <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.08em", padding: "8px 10px 6px" }}>
                Activity
              </p>
              {/* No notification event system exists yet -- see report gap notes. */}
              <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12.5, padding: "6px 10px 12px" }}>
                You&apos;re all caught up — check the Overview page for your latest activity.
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            ref={helpTriggerRef}
            onClick={() => setOpenMenu(openMenu === "help" ? "none" : "help")}
            aria-label="Help"
            aria-expanded={openMenu === "help"}
            aria-haspopup="dialog"
            className="hidden sm:flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-white"
            style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
          >
            <HelpCircle size={16} strokeWidth={2} />
          </button>
          {openMenu === "help" && (
            <div
              ref={helpPanelRef}
              role="dialog"
              aria-label="How this works"
              className="absolute right-0 bg-[#141416] border border-white/[0.1]"
              style={{ top: 46, width: 300, borderRadius: 14, padding: 16, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}
            >
              <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 10px" }}>
                How this works
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 12.5, margin: 0 }}>
                    Fitment score is per role
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12, margin: "3px 0 0", lineHeight: 1.5 }}>
                    Your score and report are matched to {roleTitle || "the role you checked"}.
                  </p>
                </div>
                <div>
                  <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 12.5, margin: 0 }}>
                    Profile items are one-time
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12, margin: "3px 0 0", lineHeight: 1.5 }}>
                    Personality test and reference checks apply to every application once done.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            ref={avatarTriggerRef}
            onClick={() => setOpenMenu(openMenu === "avatar" ? "none" : "avatar")}
            aria-label={`Account menu for ${userName}`}
            aria-expanded={openMenu === "avatar"}
            aria-haspopup="dialog"
            title={userName}
            className="flex items-center justify-center bg-[#ed1a24]/15 hover:bg-[#ed1a24]/25 transition-colors font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]"
            style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 13, border: "1px solid rgba(237,26,36,0.3)", cursor: "pointer" }}
          >
            {userName.charAt(0).toUpperCase()}
          </button>
          {openMenu === "avatar" && (
            <div
              ref={avatarPanelRef}
              role="dialog"
              aria-label="Account"
              className="absolute right-0 bg-[#141416] border border-white/[0.1]"
              style={{ top: 46, width: 240, borderRadius: 14, padding: 8, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}
            >
              <div style={{ padding: "10px 10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 6 }}>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13, margin: 0 }}>
                  {userName}
                </p>
                {userEmail && (
                  <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 11.5, margin: "2px 0 0", overflowWrap: "anywhere" }}>
                    {userEmail}
                  </p>
                )}
              </div>
              <Link
                href="/hub/account#applications"
                onClick={close}
                className="flex items-center text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-semibold"
                style={{ fontSize: 12.5, padding: "9px 10px", borderRadius: 8 }}
              >
                Applications &amp; history
              </Link>
              <div style={{ padding: "4px 10px 8px" }}>
                <SignOutButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
