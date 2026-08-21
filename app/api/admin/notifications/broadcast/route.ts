import { z } from "zod";
import { requireAdmin, assertRecentAuth, ReauthRequiredError } from "@/lib/adminAuth";
import { broadcastCandidateNotification, FUNNEL_STAGES } from "@/lib/adminCandidates";
import { HUB_NOTIFICATION_CATEGORIES } from "@/lib/hubNotifications";
import { enforceAdminRateLimit, RateLimitExceededError } from "@/lib/adminRateLimit";

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
    assertRecentAuth(admin);
    await enforceAdminRateLimit(admin.email as string, "notification.broadcast");
    const result = await broadcastCandidateNotification(
      { funnelStages: parsed.data.funnelStages, roleTitles: parsed.data.roleTitles },
      parsed.data.message.trim(),
      parsed.data.category,
      admin.email as string
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof RateLimitExceededError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to send broadcast.";
    return Response.json({ error: message }, { status: 409 });
  }
}
