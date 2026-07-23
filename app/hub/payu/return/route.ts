import { finalizePaymentFromPayu } from "@/lib/payu/finalize";
import type { PayuResponseFields } from "@/lib/payu/client";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const fields: PayuResponseFields = {
    key: params.get("key") ?? "",
    txnid: params.get("txnid") ?? "",
    amount: params.get("amount") ?? "",
    productinfo: params.get("productinfo") ?? "",
    firstname: params.get("firstname") ?? "",
    email: params.get("email") ?? "",
    status: params.get("status") ?? "",
    hash: params.get("hash") ?? "",
  };

  const result = await finalizePaymentFromPayu(fields);

  const destination = result.ok ? `${siteUrl}/hub/account?payu=success` : `${siteUrl}/hub/account?payu=failed`;

  return Response.redirect(destination, 303);
}
