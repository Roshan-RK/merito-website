"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import { logAuditEvent } from "@/lib/recruiterPreviewAudit";
import type { Database } from "@/lib/database.types";

export interface Lead {
  id: string;
  role_title: string;
  name?: string | null;
}

export interface SectionRow {
  lead_id: string;
  sections: string[];
}

export const SECTION_OPTIONS = ["fitment", "personality", "interview"] as const;
export type SectionOption = (typeof SECTION_OPTIONS)[number];

/** Pure: turn recruiter_preview_sections rows into a lead_id -> sections[] map. */
export function groupSectionsByLead(rows: SectionRow[]): Record<string, string[]> {
  const byLead: Record<string, string[]> = {};
  for (const row of rows) {
    byLead[row.lead_id] = row.sections;
  }
  return byLead;
}

/** Pure: compute the next sections array for one lead after a checkbox toggle. */
export function nextSections(current: string[], section: string, checked: boolean): string[] {
  return checked ? [...current, section] : current.filter((s) => s !== section);
}

/**
 * Upsert one lead's section config, then fire-and-forget an audit log entry.
 * Exported so behavior can be tested directly against a mock Supabase client,
 * without rendering the component (this repo's vitest config runs in a
 * DOM-less "node" environment -- see app/hub/account/__tests__/OnboardingTour.test.ts
 * for the established pattern of testing extracted pure/async logic instead of JSX).
 */
export async function saveSections(
  supabase: SupabaseClient<Database>,
  userId: string,
  leadId: string,
  sections: string[]
): Promise<{ error: unknown | null }> {
  const { error } = await supabase.from("recruiter_preview_sections").upsert({
    user_id: userId,
    lead_id: leadId,
    sections,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("recruiter_preview_sections upsert failed", { user_id: userId, lead_id: leadId, error });
    return { error };
  }

  try {
    await logAuditEvent(supabase, userId, leadId, "sections_updated");
  } catch (e) {
    console.error("recruiter_preview_audit log failed (non-fatal)", e);
  }

  return { error: null };
}

export function RecruiterpPreviewRoleConfig() {
  const [supabase] = useState<SupabaseClient<Database>>(() => createSupabaseBrowserClient() as SupabaseClient<Database>);
  const [userId, setUserId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sectionsByLead, setSectionsByLead] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (cancelled) return;
      setUserId(user.id);

      const [{ data: leadsData }, { data: sectionsData }] = await Promise.all([
        supabase
          .from("fitment_leads")
          .select("id, role_title, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("recruiter_preview_sections").select("lead_id, sections").eq("user_id", user.id),
      ]);

      if (cancelled) return;
      setLeads((leadsData as Lead[] | null) ?? []);
      setSectionsByLead(groupSectionsByLead((sectionsData as SectionRow[] | null) ?? []));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleToggle(leadId: string, section: string, checked: boolean) {
    if (!userId) return;
    const current = sectionsByLead[leadId] || [];
    const updated = nextSections(current, section, checked);

    // Optimistic update; revert if the save fails.
    setSectionsByLead((prev) => ({ ...prev, [leadId]: updated }));

    const { error } = await saveSections(supabase, userId, leadId, updated);
    if (error) {
      setSectionsByLead((prev) => ({ ...prev, [leadId]: current }));
    }
  }

  if (loading) return <div>Loading...</div>;

  if (leads.length === 0) {
    return <p className="text-gray-500">Enable preview and configure apps.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Choose which details recruiters can see for each of your applications.
      </p>
      {leads.map((lead) => {
        const enabledSections = sectionsByLead[lead.id] || [];
        return (
          <div key={lead.id} className="border rounded-lg p-4" data-testid={`role-config-${lead.id}`}>
            <h3 className="font-medium text-lg mb-4">{lead.role_title}</h3>
            <div className="space-y-2">
              {SECTION_OPTIONS.map((section) => (
                <label key={section} className="flex items-center">
                  <input
                    type="checkbox"
                    data-testid={`section-checkbox-${lead.id}-${section}`}
                    checked={enabledSections.includes(section)}
                    onChange={(e) => handleToggle(lead.id, section, e.target.checked)}
                    className="mr-2"
                  />
                  <span className="capitalize">{section}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
