import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { sendCandidateNotification } from "@/lib/adminCandidates";
import { HUB_NOTIFICATION_CATEGORIES } from "@/lib/hubNotifications";

const PostSchema = z.object({
  message: z.string().min(1).max(2000),
  category: z.enum(HUB_NOTIFICATION_CATEGORIES).default("general"),
});

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { userId } = await params;

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
    await sendCandidateNotification(userId, parsed.data.message.trim(), admin.email as string, parsed.data.category);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
