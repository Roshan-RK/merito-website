import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { getContactRequest, updateContactRequestStatus, ALLOWED_TRANSITIONS, type ContactRequestStatus } from "@/lib/adminContactRequests";

const PatchSchema = z.object({ status: z.enum(["approved", "denied"]) });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();

  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "status must be approved or denied." }, { status: 400 });
  }

  const current = await getContactRequest(id);
  if (!current) {
    return Response.json({ error: "Contact detail request not found." }, { status: 404 });
  }

  const currentStatus = current.status as ContactRequestStatus;
  if (!ALLOWED_TRANSITIONS[currentStatus].includes(parsed.data.status)) {
    return Response.json({ error: `Invalid transition: ${currentStatus} -> ${parsed.data.status}.` }, { status: 400 });
  }

  await updateContactRequestStatus(id, parsed.data.status, admin.email ?? "admin");

  return Response.json({ ok: true });
}
