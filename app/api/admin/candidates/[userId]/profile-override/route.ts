import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { overrideCandidateProfile } from "@/lib/adminCandidates";

const PostSchema = z.object({
  phoneNumber: z.string().nullable(),
  location: z.string().nullable(),
  totalExperience: z.number().nullable(),
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
    return Response.json({ error: "phoneNumber, location, totalExperience, and reason are required." }, { status: 400 });
  }

  try {
    await overrideCandidateProfile(
      userId,
      { phoneNumber: parsed.data.phoneNumber, location: parsed.data.location, totalExperience: parsed.data.totalExperience },
      admin.email as string,
      parsed.data.reason
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to override candidate profile.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
