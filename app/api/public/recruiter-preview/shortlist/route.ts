import { shortlistProspect } from "@/lib/prospectShortlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let body: { prospectId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (typeof body.prospectId !== "string" || body.prospectId.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const result = await shortlistProspect(body.prospectId);
  if (!result) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  return Response.json(result);
}
