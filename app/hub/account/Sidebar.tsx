"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLeadHref } from "./useLeadHref";
import {
  LayoutDashboard,
  FileText,
  Mic,
  FileStack,
  Brain,
  Users,
  Eye,
  Briefcase,
  UserCheck,
  Tag,
  Receipt,
} from "lucide-react";
import type { ComponentType } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  tourId?: string;
};

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "This application",
    items: [
      { label: "Overview", href: "/hub/account", icon: LayoutDashboard },
      { label: "Fitment report", href: "/hub/account/report", icon: FileText },
      { label: "Personality test", href: "/hub/account/personality", icon: Brain },
      // Nav links carry the active ?lead= via useLeadHref, so role switches survive sidebar navigation.
      // A param-less visit still falls back to the candidate's most-recent lead.
      { label: "Mock interview", href: "/hub/account/interview", icon: Mic },
      { label: "Reference checks", href: "/hub/account/references", icon: Users },
      { label: "Consolidated report", href: "/hub/account/combined-report", icon: FileStack, tourId: "nav-consolidated" },
      { label: "Expert guidance", href: "/hub/account/expert", icon: UserCheck },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Applications & history", href: "/hub/account/applications", icon: Briefcase },
      { label: "Recruiter preview", href: "/hub/account/recruiter-preview", icon: Eye },
      { label: "Pricing", href: "/hub/account/pricing", icon: Tag },
      { label: "Order history", href: "/hub/account/orders", icon: Receipt },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const leadHref = useLeadHref();

  return (
    <nav
      aria-label="Account navigation"
      className="print:hidden hidden md:flex flex-col shrink-0 sticky overflow-y-auto"
      style={{ width: 250, top: 64, height: "calc(100vh - 64px)", padding: "20px 12px", borderRight: "1px solid rgb(49,47,55)" }}
    >
      {GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 4 }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
            style={{ fontSize: 11, letterSpacing: "0.025em", color: "rgb(156,153,163)", margin: "0 0 6px", padding: "4px 12px 0" }}
          >
            {group.title}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {group.items.map((item) => {
              // Items linking to an in-page anchor on Overview should only
              // highlight when we're actually on that page+hash, but
              // pathname alone can't see the hash -- treat any #-link as
              // never "active" rather than falsely matching /hub/account.
              const isActive = !item.href.includes("#") && pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={leadHref(item.href)}
                  data-tour={item.tourId}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "relative flex items-center overflow-hidden text-white"
                      : "relative flex items-center overflow-hidden text-white/90 hover:bg-white/[0.06] transition-colors"
                  }
                  style={{
                    gap: 10,
                    padding: "8px 12px 8px 16px",
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? "rgba(237,29,39,0.07)" : "transparent",
                  }}
                >
                  {isActive && (
                    <span
                      className="absolute rounded-full"
                      style={{ top: 4, bottom: 4, left: 0, width: 3, background: "#ed1a24", boxShadow: "0 0 6px rgba(237,29,39,0.9), 0 0 14px rgba(237,29,39,0.5)" }}
                    />
                  )}
                  <Icon size={16} strokeWidth={2} />
                  <span className="font-[family-name:var(--font-poppins)]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
