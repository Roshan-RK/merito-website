import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { isCompleteAnswerSet, scoreAllTraits, computeValidity, type Answers } from "@/lib/personality";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { roleTitle?: string; answers?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle.trim() : "";
  if (!roleTitle) {
    return Response.json({ error: "roleTitle is required." }, { status: 400 });
  }

  const rawAnswers = body.answers;
  if (!rawAnswers || typeof rawAnswers !== "object") {
    return Response.json({ error: "answers is required." }, { status: 400 });
  }

  const answers: Answers = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    const id = Number(key);
    if (!Number.isInteger(id) || typeof value !== "number") {
      return Response.json({ error: "answers must map item id to a 1-5 rating." }, { status: 400 });
    }
    answers[id] = value;
  }

  if (!isCompleteAnswerSet(answers)) {
    return Response.json({ error: "All statements must be answered before scoring." }, { status: 400 });
  }

  const scores = scoreAllTraits(answers);
  const validity = computeValidity(answers);

  const admin = getSupabaseServerClient();
  const { error: upsertError } = await admin.from("personality_tests").upsert(
    {
      user_id: user.id,
      role_title: roleTitle,
      scores,
      validity,
      answers,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,role_title" }
  );

  if (upsertError) {
    console.error("personality_tests upsert failed", { user_id: user.id, role_title: roleTitle, error: upsertError });
    return Response.json({ error: "Something went wrong saving your results — please try again." }, { status: 500 });
  }

  return Response.json({ scores, validity });
}
