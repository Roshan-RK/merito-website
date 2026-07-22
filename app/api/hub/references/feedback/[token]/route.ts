import { z } from "zod";
import { validateRefereeToken, consumeRefereeToken } from "@/lib/referenceTokens";
import { recordRefereeFeedback, recordRefereeDecline, getRefereeName } from "@/lib/referenceChecks";

const FEEDBACK_CATEGORIES = [
  "knowledge-application",
  "initiative",
  "teamwork",
  "communication",
  "discipline",
  "problem-solving",
  "leadership-skills",
] as const;

const SubmitFeedbackSchema = z.object({
  ratings: z
    .array(z.object({ category: z.enum(FEEDBACK_CATEGORIES), value: z.number().int().min(1).max(5) }))
    .length(FEEDBACK_CATEGORIES.length),
  overallFeedback: z.string().trim().min(1),
});

const DeclineSchema = z.object({ declined: z.literal(true) });

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;
  const validation = await validateRefereeToken(token);

  if (!validation.valid) {
    return Response.json({ valid: false, reason: validation.reason });
  }

  const refereeName = await getRefereeName(validation.refereeId);
  return Response.json({ valid: true, refereeName });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const validation = await validateRefereeToken(token);

  if (!validation.valid) {
    return Response.json({ error: "This link is no longer valid." }, { status: 410 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const decline = DeclineSchema.safeParse(json);
  if (decline.success) {
    try {
      await recordRefereeDecline(validation.refereeId);
    } catch (error) {
      if (error instanceof Error && error.message === "REFEREE_ALREADY_RESPONDED") {
        await consumeRefereeToken(token);
        return Response.json({ error: "This reference has already been responded to." }, { status: 409 });
      }
      throw error;
    }
    await consumeRefereeToken(token);
    return Response.json({ ok: true });
  }

  const feedback = SubmitFeedbackSchema.safeParse(json);
  if (feedback.success) {
    try {
      await recordRefereeFeedback(validation.refereeId, feedback.data);
    } catch (error) {
      if (error instanceof Error && error.message === "REFEREE_ALREADY_RESPONDED") {
        await consumeRefereeToken(token);
        return Response.json({ error: "This reference has already been responded to." }, { status: 409 });
      }
      throw error;
    }
    await consumeRefereeToken(token);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Please provide ratings for all categories, or decline." }, { status: 400 });
}
