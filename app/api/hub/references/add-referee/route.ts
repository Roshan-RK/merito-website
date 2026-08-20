import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { addReferee, getActiveReferenceCheckId, getCandidateDisplayName } from "@/lib/referenceChecks";
import { createRefereeToken } from "@/lib/referenceTokens";
import { sendRefereeInviteEmail } from "@/lib/referenceEmails";

const RefereeSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  experienceLevel: z.enum(["fresher", "experienced"]).optional(),
  role: z.enum(["faculty", "classmate", "internship-colleague", "internship-manager", "manager", "team-lead", "teammate", "client", "other"]),
  customRole: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = RefereeSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Please check the referee details and try again." }, { status: 400 });
  }

  const checkId = await getActiveReferenceCheckId(user.id);
  if (!checkId) {
    return Response.json({ error: "Start a reference check before adding a referee." }, { status: 400 });
  }

  try {
    const { id: refereeId } = await addReferee(checkId, parsed.data);
    const candidateName = await getCandidateDisplayName(user.id);
    const token = await createRefereeToken(refereeId);
    await sendRefereeInviteEmail({ to: parsed.data.email, refereeName: parsed.data.name, candidateName, token });

    return Response.json({ refereeId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "MAX_REFEREES_REACHED") {
      return Response.json({ error: "You've reached the maximum of 10 referees." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "DUPLICATE_REFEREE") {
      return Response.json({ error: "This referee is already added." }, { status: 409 });
    }
    return Response.json({ error: "Something went wrong adding this referee." }, { status: 500 });
  }
}
