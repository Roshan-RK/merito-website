import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { generateCandidateMagicLink } from "@/lib/adminCandidates";

const PostSchema = z.object({ email: z.string().email() });

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  await params; // userId not needed by generateCandidateMagicLink (keyed by email), but kept for route consistency/logging context

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    const link = await generateCandidateMagicLink(parsed.data.email, admin.email as string);
    return Response.json({ link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate magic link.";
    return Response.json({ error: message }, { status: 409 });
  }
}
