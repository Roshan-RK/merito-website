import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { overrideInterviewReport } from "@/lib/adminCandidates";

const PostSchema = z.object({
  overallScore: z.number().min(0).max(10),
  overallSummary: z.string(),
  reason: z.string().min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "overallScore, overallSummary, and reason are required." }, { status: 400 });
  }

  try {
    await overrideInterviewReport(
      id,
      { overallScore: parsed.data.overallScore, overallSummary: parsed.data.overallSummary },
      admin.email as string,
      parsed.data.reason
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to override interview report.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
