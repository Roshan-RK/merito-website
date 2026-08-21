import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { broadcastCandidateNotification } from "@/lib/adminCandidates";
import { HUB_NOTIFICATION_CATEGORIES } from "@/lib/hubNotifications";

const FUNNEL_STAGES = ["fitment_started", "report_unlocked", "interview_ready", "personality_completed", "reference_completed"] as const;

const PostSchema = z.object({
  funnelStages: z.array(z.enum(FUNNEL_STAGES)).optional().default([]),
  roleTitles: z.array(z.string()).optional().default([]),
  message: z.string().min(1).max(2000),
  category: z.enum(HUB_NOTIFICATION_CATEGORIES).default("general"),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "message is required." }, { status: 400 });
  }

  try {
    const result = await broadcastCandidateNotification(
      { funnelStages: parsed.data.funnelStages, roleTitles: parsed.data.roleTitles },
      parsed.data.message.trim(),
      parsed.data.category,
      admin.email as string
    );
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send broadcast.";
    return Response.json({ error: message }, { status: 409 });
  }
}
