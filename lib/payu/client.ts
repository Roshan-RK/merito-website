import crypto from "crypto";

function requireEnv(name: "PAYU_MERCHANT_KEY" | "PAYU_MERCHANT_SALT" | "PAYU_BASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`PayU is not configured (${name} missing).`);
  }
  return value;
}

export type PayuPaymentParams = {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  surl: string;
  furl: string;
};

export function buildRequestHash(params: PayuPaymentParams): string {
  const key = requireEnv("PAYU_MERCHANT_KEY");
  const salt = requireEnv("PAYU_MERCHANT_SALT");
  const fields = [
    key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    ...Array(10).fill(""), // udf1-udf10, unused
  ];
  return crypto.createHash("sha512").update(`${fields.join("|")}|${salt}`).digest("hex");
}

export type PayuPaymentForm = {
  action: string;
  fields: Record<string, string>;
};

export function buildPaymentForm(params: PayuPaymentParams): PayuPaymentForm {
  const key = requireEnv("PAYU_MERCHANT_KEY");
  const baseUrl = requireEnv("PAYU_BASE_URL").replace(/\/$/, "");
  const hash = buildRequestHash(params);
  return {
    action: `${baseUrl}/_payment`,
    fields: {
      key,
      txnid: params.txnid,
      amount: params.amount,
      productinfo: params.productinfo,
      firstname: params.firstname,
      email: params.email,
      surl: params.surl,
      furl: params.furl,
      hash,
    },
  };
}

export type PayuResponseFields = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  hash: string;
};

export function verifyResponseHash(fields: PayuResponseFields): boolean {
  const salt = requireEnv("PAYU_MERCHANT_SALT");
  const reverseFields = [
    salt,
    fields.status,
    ...Array(10).fill(""), // udf10-udf1, unused
    fields.email,
    fields.firstname,
    fields.productinfo,
    fields.amount,
    fields.txnid,
    fields.key,
  ];
  const expected = crypto.createHash("sha512").update(reverseFields.join("|")).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(fields.hash, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
