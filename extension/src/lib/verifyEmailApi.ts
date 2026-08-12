const VERIFY_EMAIL_URL = "https://www.merito.ai/api/public/recruiter/verify-email";

export async function requestVerificationEmail(email: string, company: string): Promise<boolean> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(VERIFY_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-merito-extension-key": extensionKey },
      body: JSON.stringify({ email, company }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// null = couldn't reach the server (network error, bad response) — caller should
// fall back to its last-known verified state rather than treat this as "unverified".
export async function checkVerificationStatus(email: string): Promise<boolean | null> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const url = new URL(`${VERIFY_EMAIL_URL}/status`);
    url.searchParams.set("email", email);
    const response = await fetch(url, { headers: { "x-merito-extension-key": extensionKey } });
    if (!response.ok) return null;
    const data = (await response.json()) as { verified?: boolean };
    return Boolean(data.verified);
  } catch {
    return null;
  }
}
