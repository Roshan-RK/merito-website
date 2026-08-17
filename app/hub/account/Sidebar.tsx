"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  Mic,
  BarChart3,
  Brain,
  Users,
  Eye,
  Briefcase,
  LifeBuoy,
  IndianRupee,
  ReceiptText,
} from "lucide-react";
import type { ComponentType } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "This application",
    items: [
      { label: "Overview", href: "/hub/account", icon: LayoutGrid },
      { label: "Fitment report", href: "/hub/account/report", icon: FileText },
      { label: "Mock interview", href: "/hub/account/interview", icon: Mic },
      { label: "Consolidated report", href: "/hub/account/combined-report", icon: BarChart3 },
    ],
  },
  {
    title: "Your profile",
    items: [
      { label: "Personality test", href: "/hub/account/personality", icon: Brain },
      { label: "Reference checks", href: "/hub/account/references", icon: Users },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Recruiter preview", href: "/hub/account/recruiter-preview", icon: Eye },
      { label: "Pricing", href: "/hub/account/pricing", icon: IndianRupee },
      { label: "Order history", href: "/hub/account/orders", icon: ReceiptText },
      { label: "Applications & history", href: "/hub/account#applications", icon: Briefcase },
      { label: "Expert guidance", href: "/hub/account#guidance", icon: LifeBuoy },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account navigation"
      className="print:hidden hidden md:flex flex-col shrink-0 sticky overflow-y-auto bg-[#0a0a0a] border-r border-white/[0.08]"
      style={{ width: 248, top: 66, height: "calc(100vh - 66px)", padding: "22px 14px" }}
    >
      {GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 20 }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40"
            style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 8px", padding: "0 10px" }}
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
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "flex items-center bg-[#ed1a24]/15 text-white"
                      : "flex items-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                  }
                  style={{
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 10,
                    fontSize: 13.5,
                    borderLeft: isActive ? "3px solid #ed1a24" : "3px solid transparent",
                  }}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span className="font-[family-name:var(--font-poppins)] font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
