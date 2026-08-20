import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { updateRecruiterCompany } from "@/lib/adminRecruiters";

const PatchSchema = z.object({ companyName: z.string().min(1) });

type RouteContext = { params: Promise<{ email: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { email } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "companyName is required." }, { status: 400 });
  }

  try {
    await updateRecruiterCompany(email, parsed.data.companyName, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update company.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
