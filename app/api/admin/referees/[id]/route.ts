import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { updateRefereeContact } from "@/lib/referenceChecks";

const PatchSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable(),
  organization: z.string().nullable(),
  reason: z.string().min(1),
});

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
    return Response.json({ error: "name, email, and reason are required." }, { status: 400 });
  }

  try {
    await updateRefereeContact(
      id,
      { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone, organization: parsed.data.organization },
      admin.email as string,
      parsed.data.reason
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update referee.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
