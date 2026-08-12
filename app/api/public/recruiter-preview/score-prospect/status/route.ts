import { buildLookupFitment } from "@/lib/recruiterPreview";
import { getProspectScoreStatus } from "@/lib/recruiterSourcedProspects";

export const runtime = "nodejs";

function deriveRoleLabel(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "your role";
}

export async function GET(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  const prospectId = new URL(request.url).searchParams.get("prospectId");
  if (!prospectId) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const result = await getProspectScoreStatus(prospectId);

  if (result.status === "failed") {
    return Response.json({ error: "Something went wrong." }, { status: 502 });
  }
  if (result.status === "pending") {
    return Response.json({ status: "pending" });
  }

  return Response.json({
    status: "ready",
    prospectId: result.prospectId,
    fitment: buildLookupFitment(result.report, deriveRoleLabel(result.jdText)),
  });
}
