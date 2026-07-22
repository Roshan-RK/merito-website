import { getStaleRefereesForReminder, getReferenceCheckOwner, getCandidateDisplayName, incrementReminderCount } from "@/lib/referenceChecks";
import { createRefereeToken } from "@/lib/referenceTokens";
import { sendRefereeReminderEmail } from "@/lib/referenceEmails";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expected || authorization !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stale = await getStaleRefereesForReminder();
  let remindersSent = 0;

  for (const referee of stale) {
    const ownerId = await getReferenceCheckOwner(referee.reference_check_id);
    if (!ownerId) continue;

    try {
      const candidateName = await getCandidateDisplayName(ownerId);
      const token = await createRefereeToken(referee.id);
      await sendRefereeReminderEmail({ to: referee.email, refereeName: referee.name, candidateName, token });
      await incrementReminderCount(referee.id);
      remindersSent++;
    } catch (error) {
      console.error(`reminder-sweep: failed to send reminder for referee ${referee.id}`, error);
      continue;
    }
  }

  return Response.json({ remindersSent });
}
