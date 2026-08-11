import { purgeStaleProspects } from "@/lib/purgeProspects";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expected || authorization !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await purgeStaleProspects();
  return Response.json(result);
}
