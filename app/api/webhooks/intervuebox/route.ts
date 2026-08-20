import crypto from "crypto";
import { sweepPendingInterviews } from "@/lib/intervuebox/sweepPendingInterviews";

export const runtime = "nodejs";

function verifySignature(secret: string, rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(request: Request) {
  const secret = process.env.INTERVUEBOX_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-ib-signature");
  if (!verifySignature(secret, rawBody, signatureHeader)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  // The webhook delivery body's per-event JSON shape isn't documented by
  // IntervueBox -- sweepPendingInterviews() re-checks every "invited" row
  // instead of trying to parse identifiers out of this payload.
  await sweepPendingInterviews();

  return Response.json({ received: true });
}
