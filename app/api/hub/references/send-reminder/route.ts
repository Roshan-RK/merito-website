import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getRefereeForUser, getCandidateDisplayName, incrementReminderCount, MAX_REMINDERS } from "@/lib/referenceChecks";
import { createRefereeToken } from "@/lib/referenceTokens";
import { sendRefereeReminderEmail } from "@/lib/referenceEmails";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { refereeId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.refereeId) {
    return Response.json({ error: "refereeId is required." }, { status: 400 });
  }

  const referee = await getRefereeForUser(user.id, body.refereeId);
  if (!referee) {
    return Response.json({ error: "Referee not found." }, { status: 404 });
  }
  if (referee.status !== "pending") {
    return Response.json({ error: "This referee has already responded." }, { status: 409 });
  }
  if (referee.reminderCount >= MAX_REMINDERS) {
    return Response.json({ error: "You've already sent the maximum number of reminders." }, { status: 409 });
  }

  const candidateName = await getCandidateDisplayName(user.id);
  const token = await createRefereeToken(referee.id);
  await sendRefereeReminderEmail({ to: referee.email, refereeName: referee.name, candidateName, token });
  await incrementReminderCount(referee.id);

  return Response.json({ ok: true });
}
