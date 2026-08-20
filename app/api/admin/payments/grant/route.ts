import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { grantFreeAccess } from "@/lib/adminPayments";
import { enforceAdminRateLimit, RateLimitExceededError } from "@/lib/adminRateLimit";

const PostSchema = z.object({
  email: z.string().email(),
  product: z.enum(["report", "personality", "references", "interview", "counselling", "bundle"]),
  level: z.enum(["entry", "mid", "senior"]),
  reason: z.string().min(1),
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
    return Response.json({ error: "email, product, level, and reason are required." }, { status: 400 });
  }

  try {
    await enforceAdminRateLimit(admin.email as string, "payment.grant_free_access");
    await grantFreeAccess(parsed.data, admin.email as string);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to grant access.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
