import type { SupabaseClient } from "@supabase/supabase-js";

// Marks a fitment_interviews row as permanently stuck (stuck_at = now) --
// shared by app/api/hub/interview/launch-link/route.ts and
// app/api/hub/interview/resume/route.ts, both of which call this on either
// vendor-failure branch (the reinvite call throwing, or returning no fresh
// magicLinks) once row.has_resumed is already true. See
// docs/superpowers/specs/2026-08-19-interview-stuck-state-design.md.
export async function markInterviewStuck(admin: SupabaseClient, rowId: string): Promise<void> {
  const { error } = await admin
    .from("fitment_interviews")
    .update({ stuck_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) {
    // The 502 already returned to the candidate is the important part --
    // don't fail harder over a write miss, just don't let it be a silent
    // mystery why a row never actually got flagged stuck.
    console.error("Failed to mark fitment_interviews row stuck", { rowId, error });
  }
}
