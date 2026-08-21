import { getSupabaseServerClient } from "@/lib/supabase";
import type { SweepResult } from "@/lib/intervuebox/sweepPendingInterviews";

const PAGE_SIZE = 20;

export type WebhookEventRow = {
  id: string;
  rawPayload: unknown;
  sweepResult: SweepResult | null;
  sweepError: string | null;
  createdAt: string;
};

export type PaginatedWebhookEvents = { rows: WebhookEventRow[]; total: number; totalPages: number; page: number };

export async function recordWebhookEvent(params: {
  rawPayload: unknown;
  sweepResult: SweepResult | null;
  sweepError: string | null;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("intervuebox_webhook_events").insert({
    raw_payload: params.rawPayload,
    sweep_result: params.sweepResult,
    sweep_error: params.sweepError,
  });

  if (error) {
    console.error("Failed to record IntervueBox webhook event", { params, error });
  }
}

export async function listWebhookEvents(page: number = 1): Promise<PaginatedWebhookEvents> {
  const supabase = getSupabaseServerClient();

  const { count } = await supabase.from("intervuebox_webhook_events").select("id", { count: "exact", head: true });
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;

  const { data } = await supabase
    .from("intervuebox_webhook_events")
    .select("id, raw_payload, sweep_result, sweep_error, created_at")
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      rawPayload: r.raw_payload,
      sweepResult: r.sweep_result,
      sweepError: r.sweep_error,
      createdAt: r.created_at,
    })),
    total,
    totalPages,
    page: clampedPage,
  };
}
