import { requireAdmin } from "@/lib/adminAuth";
import { resetRefereeReminders } from "@/lib/referenceChecks";
import { logAdminAction } from "@/lib/adminAuditLog";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { id } = await params;

  try {
    await resetRefereeReminders(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset reminders.";
    return Response.json({ error: message }, { status: 409 });
  }

  await logAdminAction({
    adminEmail: admin.email as string,
    action: "referee.reset_reminders",
    targetType: "candidate",
    targetId: id,
    priorValue: null,
    newValue: { reminderCount: 0 },
  });

  return Response.json({ ok: true });
}
