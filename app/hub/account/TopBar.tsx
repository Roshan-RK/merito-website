"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, HelpCircle, Briefcase, Receipt, FileText, Brain, Mic, Users, Eye, Megaphone } from "lucide-react";
import type { ComponentType } from "react";
import SignOutButton from "./SignOutButton";
import RoleSwitcherMenu from "./RoleSwitcherMenu";
import { useLeadHref } from "./useLeadHref";
import { useDismiss } from "./useDismiss";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { HubNotification, HubNotificationCategory } from "@/lib/hubNotifications";

// Matches the concept-to-icon mapping already used in Sidebar.tsx (fitment
// report / mock interview / personality / references / recruiter preview /
// order history) so a notification's leading icon means the same thing it
// means everywhere else in the hub. "general" covers the admin's free-form
// manual sends, which don't map to a specific panel.
const NOTIFICATION_ICON: Record<HubNotificationCategory, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  report: FileText,
  personality: Brain,
  interview: Mic,
  references: Users,
  payment: Receipt,
  recruiter: Eye,
  general: Megaphone,
};

type Lead = {
  id: string;
  role_title: string;
  name: string;
  score: number | null;
};

export default function TopBar({
  leads,
  userName,
  userEmail,
  onChangeRole,
}: {
  leads: Lead[];
  userName: string;
  userEmail: string;
  onChangeRole: () => void;
}) {
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get("lead");
  const leadHref = useLeadHref();

  const activeLead = leadIdParam
    ? leads.find((l) => l.id === leadIdParam) || leads[0]
    : leads[0];

  const roleTitle = activeLead?.role_title ?? "";

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

  const [notifications, setNotifications] = useState<HubNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // Fetched once on mount (no SWR/react-query in this codebase -- plain
  // fetch-on-mount matches how the rest of the client-side hub components
  // load data) so the unread badge is correct before the dropdown is ever
  // opened.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/hub/notifications");
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      } catch {
        // Best-effort -- bell just stays empty on failure.
      } finally {
        if (!cancelled) setNotificationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMarkRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.readAt) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/hub/notifications/${id}/read`, { method: "POST" });
    } catch {
      // Best-effort -- local state already reflects "read".
    }
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);
    try {
      await fetch("/api/hub/notifications/mark-all-read", { method: "POST" });
    } catch {
      // Best-effort -- local state already reflects "all read".
    }
  }

  return (
    <header
      className="print:hidden sticky top-0 flex items-center justify-between backdrop-blur-md"
      style={{ height: 64, padding: "0 28px", zIndex: 30, gap: 16, background: "rgba(20,18,22,0.85)", borderBottom: "1px solid rgb(49,47,55)" }}
    >
      <div className="flex items-center shrink-0" style={{ gap: 8 }}>
        <Link href={leadHref("/hub/account")} className="flex items-center" style={{ gap: 8 }}>
          <Image src="/logo-white.png" alt="Merito" width={128} height={36} style={{ height: 30, width: "auto" }} />
          <span
            className="bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold"
            style={{ fontSize: 10, letterSpacing: "0.06em", borderRadius: 50, padding: "2px 8px" }}
          >
            HUB
          </span>
        </Link>
      </div>

      {/* Visual-only: this build has no search index or command palette behind
          it. Rendered disabled rather than omitted so the header keeps the
          mockup's proportions; wire it up when search ships. */}
      <div
        className="hidden md:flex items-center flex-1"
        style={{ maxWidth: 320, height: 43, borderRadius: 14, padding: "8px 12px", gap: 8, cursor: "not-allowed", background: "rgba(39,37,45,0.6)", border: "1px solid rgb(49,47,55)", color: "rgb(156,153,163)" }}
        title="Search is not available yet"
      >
        <Search size={16} strokeWidth={2} />
        <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 14 }}>
          Search or jump to...
        </span>
        <kbd
          className="hidden sm:inline-block"
          style={{ marginLeft: "auto", background: "rgb(20,18,22)", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 500 }}
        >
          &#8984;K
        </kbd>
      </div>

      <div className="flex items-center shrink-0" style={{ gap: 8 }}>
        {/* `?lead=<uuid>` is the single source of truth for the active role;
            RoleSwitcher shows a dropdown to switch between the candidate's
            existing roles when there are 2+, or a static label otherwise, and
            defers "+ Check a new role" back to the ChangeRoleModal flow. */}
        <RoleSwitcherMenu leads={leads} onChangeRole={onChangeRole} />

        <div className="relative">
          <button
            ref={notifTriggerRef}
            onClick={() => setOpenMenu(openMenu === "notifications" ? "none" : "notifications")}
            aria-label="Notifications"
            aria-expanded={openMenu === "notifications"}
            aria-haspopup="dialog"
            className="relative flex items-center justify-center hover:bg-white/[0.06] transition-colors text-white"
            style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid rgb(49,47,55)", background: "rgb(27,25,31)", cursor: "pointer" }}
          >
            <Bell size={16} strokeWidth={2} />
            {unreadCount > 0 && (
              <span
                className="absolute bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold flex items-center justify-center"
                style={{ top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 50, fontSize: 9.5, padding: "0 3px", border: "2px solid rgb(20,18,22)" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {openMenu === "notifications" && (
            <div
              ref={notifPanelRef}
              role="dialog"
              aria-label="Notifications"
              className="absolute right-0 bg-[#141416] border border-white/[0.1]"
              style={{ top: 46, width: 300, borderRadius: 14, padding: 8, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}
            >
              <div className="flex items-center justify-between" style={{ padding: "8px 10px 6px" }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: 0 }}>
                  Activity
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
                    style={{ fontSize: 10.5, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notificationsLoading ? (
                <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12.5, padding: "6px 10px 12px" }}>
                  Loading…
                </p>
              ) : notifications.length === 0 ? (
                <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12.5, padding: "6px 10px 12px" }}>
                  You&apos;re all caught up. Check the Overview page for your latest activity.
                </p>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {notifications.map((n) => {
                    const Icon = NOTIFICATION_ICON[n.category] ?? Megaphone;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className="text-left flex items-start"
                        style={{
                          width: "100%",
                          background: n.readAt ? "transparent" : "rgba(237,26,36,0.1)",
                          border: "none",
                          cursor: n.readAt ? "default" : "pointer",
                          padding: "8px 10px",
                          borderRadius: 8,
                          marginBottom: 2,
                          gap: 10,
                        }}
                      >
                        <div
                          className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24] shrink-0"
                          style={{ width: 30, height: 30, borderRadius: 8 }}
                        >
                          <Icon size={14} strokeWidth={2} />
                        </div>
                        <div>
                          <p className="font-[family-name:var(--font-poppins)] text-white" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                            {n.message}
                          </p>
                          <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11, margin: "3px 0 0" }}>
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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
            className="hidden sm:flex items-center justify-center hover:bg-white/[0.06] transition-colors text-white"
            style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid rgb(49,47,55)", background: "rgb(27,25,31)", cursor: "pointer" }}
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
            className="flex items-center justify-center hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ width: 32, height: 32, borderRadius: "50%", fontSize: 12, background: "rgb(39,37,45)", border: "1px solid #ed1a24", cursor: "pointer" }}
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
                href={leadHref("/hub/account#applications")}
                onClick={close}
                className="flex items-center text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-semibold"
                style={{ gap: 10, fontSize: 12.5, padding: "9px 10px", borderRadius: 8 }}
              >
                <Briefcase size={14} strokeWidth={2} />
                Applications &amp; history
              </Link>
              <Link
                href="/hub/account/orders"
                onClick={close}
                className="flex items-center text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-semibold"
                style={{ gap: 10, fontSize: 12.5, padding: "9px 10px", borderRadius: 8 }}
              >
                <Receipt size={14} strokeWidth={2} />
                Order history
              </Link>
              <div style={{ padding: "4px 10px 8px", marginTop: 2, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <SignOutButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
