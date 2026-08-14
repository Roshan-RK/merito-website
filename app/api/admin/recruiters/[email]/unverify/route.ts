import { requireAdmin } from "@/lib/adminAuth";
import { unverifyRecruiter } from "@/lib/adminRecruiters";

type RouteContext = { params: Promise<{ email: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { email } = await params;

  try {
    await unverifyRecruiter(email, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unverify recruiter.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
