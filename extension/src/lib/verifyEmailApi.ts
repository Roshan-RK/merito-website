const VERIFY_EMAIL_URL = "https://www.merito.ai/api/public/recruiter/verify-email";

export async function requestVerificationEmail(email: string): Promise<boolean> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(VERIFY_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-merito-extension-key": extensionKey },
      body: JSON.stringify({ email }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
