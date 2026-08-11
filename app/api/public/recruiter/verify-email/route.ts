import { requestRecruiterEmailVerification } from "@/lib/recruiterIdentity";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const verifyRateLimit = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (typeof body.email !== "string" || !EMAIL_PATTERN.test(body.email.trim())) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const email = body.email.trim();

  if (!verifyRateLimit(email.toLowerCase())) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  await requestRecruiterEmailVerification(email);
  return Response.json({ sent: true });
}
