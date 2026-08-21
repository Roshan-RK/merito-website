import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { overrideFitmentReport, clearFitmentOverride } from "@/lib/adminCandidates";

const PostSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  reason: z.string().min(1),
});

const DeleteSchema = z.object({
  reason: z.string().min(1),
});

type RouteContext = { params: Promise<{ leadId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { leadId } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "overallScore, summary, and reason are required." }, { status: 400 });
  }

  try {
    await overrideFitmentReport(
      leadId,
      { overallScore: parsed.data.overallScore, summary: parsed.data.summary },
      admin.email as string,
      parsed.data.reason
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to override fitment report.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { leadId } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = DeleteSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "reason is required." }, { status: 400 });
  }

  try {
    await clearFitmentOverride(leadId, admin.email as string, parsed.data.reason);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clear fitment override.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
