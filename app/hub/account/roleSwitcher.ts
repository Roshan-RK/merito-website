import { resolveActiveLead } from "@/lib/activeLead";

export type SwitcherLead = { id: string; role_title: string; score: number | null };
export type SwitcherState = { activeLead: SwitcherLead | null; showDropdown: boolean };

// leads is assumed newest-first (every hub query orders created_at desc), so
// resolveActiveLead's leads[0] fallback is the "latest role" the whole app uses.
// resolveActiveLead throws on empty -- guard here so the switcher can render
// nothing for a lead-less account.
export function resolveSwitcherState(leads: SwitcherLead[], leadIdParam: string | null): SwitcherState {
  if (leads.length === 0) return { activeLead: null, showDropdown: false };
  return {
    activeLead: resolveActiveLead(leads, leadIdParam ?? undefined),
    showDropdown: leads.length >= 2,
  };
}
