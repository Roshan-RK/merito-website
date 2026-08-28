"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Check, Plus } from "lucide-react";
import { resolveSwitcherState, type SwitcherLead } from "./roleSwitcher";
import { useDismiss } from "./useDismiss";

// The visible role switcher in the hub TopBar. `?lead=<uuid>` is the single
// source of truth for the active role (every hub page reads it), so switching
// is just router.push(`${pathname}?lead=${id}`). resolveSwitcherState (Task 1)
// decides whether there are enough roles (>= 2) to warrant the dropdown;
// otherwise this renders a static label. "+ Check a new role" defers to the
// existing ChangeRoleModal flow via onChangeRole.
//
// Named ...Menu.tsx (not RoleSwitcher.tsx) to avoid a case-only filename
// collision with the roleSwitcher.ts helper on case-insensitive filesystems.
export default function RoleSwitcherMenu({
  leads,
  onChangeRole,
}: {
  leads: SwitcherLead[];
  onChangeRole: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const leadIdParam = useSearchParams().get("lead");
  const { activeLead, showDropdown } = resolveSwitcherState(leads, leadIdParam);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [triggerRef, panelRef]);

  if (!showDropdown) {
    // Lead-less account: nothing to show (the Overview page owns that flow).
    if (!activeLead) return null;
    // Exactly one role: no role to switch *to*, but ChangeRoleModal is only
    // reachable through onChangeRole here -- so offer a compact "+ Check a new
    // role" affordance. Plus icon (not a chevron) so it reads as "add a role".
    return (
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="role-newcheck-menu"
          className="hidden sm:flex items-center transition-colors font-[family-name:var(--font-poppins)] font-medium"
          style={{ borderRadius: 50, padding: "6px 12px", fontSize: 14, background: "rgba(39,37,45,0.6)", border: "1px solid rgb(49,47,55)", color: "rgb(236,235,233)", cursor: "pointer", gap: 8 }}
        >
          <span data-testid="role-label">{activeLead.role_title}</span>
          <Plus size={14} strokeWidth={2} style={{ color: "rgb(156,153,163)" }} />
        </button>

        {open && (
          <div
            ref={panelRef}
            id="role-newcheck-menu"
            role="menu"
            aria-label="Check a new role"
            className="absolute right-0 bg-[#141416] border border-white/[0.1]"
            style={{ top: 46, width: 300, borderRadius: 14, padding: 8, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChangeRole();
              }}
              className="text-left flex items-center hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
              style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 8, fontSize: 12.5 }}
            >
              + Check a new role
            </button>
          </div>
        )}
      </div>
    );
  }

  function selectLead(id: string) {
    setOpen(false);
    router.push(`${pathname}?lead=${id}`);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        data-testid="role-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="role-switcher-menu"
        className="hidden sm:flex items-center transition-colors font-[family-name:var(--font-poppins)] font-medium"
        style={{ borderRadius: 50, padding: "6px 12px", fontSize: 14, background: "rgba(39,37,45,0.6)", border: "1px solid rgb(49,47,55)", color: "rgb(236,235,233)", cursor: "pointer", gap: 8 }}
      >
        <span data-testid="role-label">{activeLead?.role_title ?? ""}</span>
        <ChevronDown size={14} strokeWidth={2} style={{ color: "rgb(156,153,163)" }} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id="role-switcher-menu"
          role="menu"
          aria-label="Switch role"
          className="absolute right-0 bg-[#141416] border border-white/[0.1]"
          style={{ top: 46, width: 300, borderRadius: 14, padding: 8, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}
        >
          <p
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40"
            style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: 0, padding: "8px 10px 6px" }}
          >
            Switch role
          </p>
          {leads.map((lead) => {
            const isActive = lead.id === activeLead?.id;
            return (
              <button
                key={lead.id}
                role="menuitem"
                data-testid={`role-option-${lead.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => selectLead(lead.id)}
                className="text-left flex items-center hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)]"
                style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 8, marginBottom: 2, gap: 10 }}
              >
                <span className="flex items-center justify-center shrink-0" style={{ width: 16 }}>
                  {isActive && <Check size={14} strokeWidth={2.5} style={{ color: "#ed1a24" }} />}
                </span>
                <span className="text-white" style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
                  {lead.role_title}
                </span>
                {lead.score != null && (
                  <span className="text-white/40 shrink-0" style={{ fontSize: 11.5 }}>
                    {lead.score.toFixed(1)}
                  </span>
                )}
              </button>
            );
          })}
          <div role="separator" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "6px 4px" }} />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onChangeRole();
            }}
            className="text-left flex items-center hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 8, fontSize: 12.5 }}
          >
            + Check a new role
          </button>
        </div>
      )}
    </div>
  );
}
