import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { getCounsellingRequest, updateCounsellingStatus, nextCounsellingState, type CounsellingStatus } from "@/lib/adminCounselling";

const STATUSES = ["requested", "scheduled", "completed", "cancelled"] as const;

const PatchSchema = z.object({
  status: z.enum(STATUSES),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  await requireAdmin();

  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "status must be one of requested, scheduled, completed, cancelled." }, { status: 400 });
  }

  const current = await getCounsellingRequest(id);
  if (!current) {
    return Response.json({ error: "Counselling request not found." }, { status: 404 });
  }

  let patch;
  try {
    patch = nextCounsellingState(current.status, parsed.data.status as CounsellingStatus, new Date().toISOString());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid transition.";
    return Response.json({ error: message }, { status: 400 });
  }

  await updateCounsellingStatus(id, patch, parsed.data.notes);

  return Response.json({ ok: true });
}
