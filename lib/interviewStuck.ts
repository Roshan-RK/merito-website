import type { SupabaseClient } from "@supabase/supabase-js";

// Sets stuck_at = now on a fitment_interviews row, flagging it permanently
// stuck so ops gets a signal. No longer called directly by the routes -- it
// fires via recordLaunchFailure below, on the 2nd consecutive vendor failure
// of a never-resumed row or on any failure of an already-has_resumed row.
// Shared by app/api/hub/interview/launch-link/route.ts and
// app/api/hub/interview/resume/route.ts. See
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

// Count a vendor launch/resume failure on a fitment_interviews row. A lone
// failure just bumps launch_fail_count; the 2nd consecutive one -- or any
// failure on a row that's already used its one resume -- escalates to stuck,
// so ops gets a signal instead of a first-timer looping on a 502 forever.
// A successful launch/resume resets the counter inline, via launch_fail_count: 0
// in the route's success-path .update().
export async function recordLaunchFailure(
  admin: SupabaseClient,
  row: { id: string; has_resumed: boolean; launch_fail_count: number }
): Promise<void> {
  const next = row.launch_fail_count + 1;
  await admin.from("fitment_interviews").update({ launch_fail_count: next }).eq("id", row.id);
  if (row.has_resumed || next >= 2) {
    await markInterviewStuck(admin, row.id);
  }
}
