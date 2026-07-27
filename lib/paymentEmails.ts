import { Resend } from "resend";

type PaymentFailedAlertParams = {
  orderId: string;
  amountPaise: number;
  candidateEmail: string;
};

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing).");
  }
  return new Resend(apiKey);
}

function getFromEmail(): string {
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("Email service is not configured (CONTACT_FROM_EMAIL missing).");
  }
  return fromEmail;
}

function getOpsEmail(): string {
  const toEmail = process.env.CONTACT_TO_EMAIL;
  if (!toEmail) {
    throw new Error("Email service is not configured (CONTACT_TO_EMAIL missing).");
  }
  return toEmail;
}

// Candidate-facing payment emails are deliberately not sent from here —
// Razorpay's own checkout already sends the payer a receipt/failure email;
// a second, Merito-branded one for the same event would be redundant.
export async function sendPaymentFailedAlertEmail(params: PaymentFailedAlertParams): Promise<void> {
  const resend = getResendClient();
  const rupees = (params.amountPaise / 100).toFixed(2);

  await resend.emails.send({
    from: getFromEmail(),
    to: [getOpsEmail()],
    subject: `Payment failed — order ${params.orderId}`,
    text: `A payment failed.\n\nOrder: ${params.orderId}\nAmount: ₹${rupees}\nCandidate: ${params.candidateEmail}`,
    html: `<p>A payment failed.</p><p>Order: ${params.orderId}<br/>Amount: ₹${rupees}<br/>Candidate: ${params.candidateEmail}</p>`,
  });
}
