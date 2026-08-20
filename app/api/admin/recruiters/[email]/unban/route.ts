import { requireAdmin } from "@/lib/adminAuth";
import { unbanRecruiter } from "@/lib/adminRecruiters";

type RouteContext = { params: Promise<{ email: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { email } = await params;

  try {
    await unbanRecruiter(email, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unban recruiter.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
