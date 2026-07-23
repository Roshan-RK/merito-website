import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { finalizeRazorpayOrder, markRazorpayPaymentFailed, markRazorpayRefunded } from "@/lib/razorpay/finalize";
import { sendPaymentFailedAlertEmail } from "@/lib/paymentEmails";

export const runtime = "nodejs";

type RazorpayWebhookPayload = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        email?: string;
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

  // order_id/payment id live at the same payload.payment.entity path for
  // payment.captured, payment.failed, and refund.processed (refund.processed's
  // own payload.refund.entity only carries the refund's own id, not the
  // order — verified against Razorpay's webhook payload docs).
  const orderId = payload.payload?.payment?.entity?.order_id;
  const paymentId = payload.payload?.payment?.entity?.id;

  if (payload.event === "payment.captured") {
    if (orderId && paymentId) {
      await finalizeRazorpayOrder(orderId, paymentId);
    }
    return Response.json({ received: true });
  }

  if (payload.event === "payment.failed") {
    if (orderId) {
      const result = await markRazorpayPaymentFailed(orderId);
      if (result.ok && !result.alreadyProcessed) {
        const candidateEmail = payload.payload?.payment?.entity?.email ?? "unknown";
        // A failed send here is a lost notification, not a lost transaction
        // — the DB update above already succeeded, and markRazorpayPaymentFailed's
        // idempotency gate means a Razorpay retry of this webhook would skip
        // re-sending anyway. Log and continue rather than 500 (which would
        // just cause a retry that can't actually recover the email).
        await sendPaymentFailedAlertEmail({ orderId, amountPaise: result.amountPaise, candidateEmail }).catch((err) => {
          console.error("Failed to send payment-failed alert email", { orderId, error: err });
        });
      }
    }
    return Response.json({ received: true });
  }

  if (payload.event === "refund.processed") {
    if (orderId) {
      await markRazorpayRefunded(orderId);
    }
    return Response.json({ received: true });
  }

  return Response.json({ received: true });
}
