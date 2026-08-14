import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { mergeCandidateAccounts } from "@/lib/adminCandidates";

const PostSchema = z.object({ keepUserId: z.string().min(1), mergeUserId: z.string().min(1) });

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
    return Response.json({ error: "keepUserId and mergeUserId are required." }, { status: 400 });
  }
  if (parsed.data.keepUserId === parsed.data.mergeUserId) {
    return Response.json({ error: "keepUserId and mergeUserId must be different." }, { status: 400 });
  }

  try {
    await mergeCandidateAccounts(parsed.data.keepUserId, parsed.data.mergeUserId, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to merge accounts.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
