import { isRecruiterEmailVerified } from "@/lib/recruiterIdentity";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const verified = await isRecruiterEmailVerified(email);
  return Response.json({ verified });
}
