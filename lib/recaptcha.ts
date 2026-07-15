export async function verifyRecaptchaToken(token: string, secret: string) {
  const verificationResponse = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
    }),
    cache: "no-store",
  });

  if (!verificationResponse.ok) {
    return false;
  }

  const verificationData = (await verificationResponse.json()) as { success?: boolean };
  return Boolean(verificationData.success);
}
