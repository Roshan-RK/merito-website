import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { updateRecruiterPreviewOverride } from "@/lib/adminCandidates";

const REPORT_TYPES = ["fitment", "personality", "interview", "references"] as const;

const PostSchema = z.object({
  enabled: z.boolean(),
  sections: z.array(z.enum(REPORT_TYPES)),
  reason: z.string().min(1),
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
    return Response.json({ error: "enabled, sections, and reason are required." }, { status: 400 });
  }

  try {
    await updateRecruiterPreviewOverride(
      userId,
      { enabled: parsed.data.enabled, sections: parsed.data.sections },
      admin.email as string,
      parsed.data.reason
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update recruiter preview settings.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
