import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { finalizeRazorpayOrder } from "@/lib/razorpay/finalize";

export const runtime = "nodejs";

type RazorpayWebhookPayload = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ received: true });
  }

  // Only payment.captured means the payment actually succeeded — entity
  // shape is identical for payment.failed, so without this check a failed
  // payment's webhook would still unlock the report.
  if (payload.event !== "payment.captured") {
    return Response.json({ received: true });
  }

  const orderId = payload.payload?.payment?.entity?.order_id;
  const paymentId = payload.payload?.payment?.entity?.id;

  if (!orderId || !paymentId) {
    return Response.json({ received: true });
  }

  await finalizeRazorpayOrder(orderId, paymentId);

  return Response.json({ received: true });
}
