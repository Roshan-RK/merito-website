import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { banRecruiter } from "@/lib/adminRecruiters";
import { enforceAdminRateLimit, RateLimitExceededError } from "@/lib/adminRateLimit";

const PostSchema = z.object({ reason: z.string().min(1) });

type RouteContext = { params: Promise<{ email: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { email } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "reason is required." }, { status: 400 });
  }

  try {
    await enforceAdminRateLimit(admin.email as string, "recruiter.ban");
    await banRecruiter(email, admin.email as string, parsed.data.reason);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to ban recruiter.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
