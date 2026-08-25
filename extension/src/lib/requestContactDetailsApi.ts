const REQUEST_DETAILS_URL = "https://www.merito.ai/api/public/recruiter-preview/request-details";

export async function requestContactDetails(
  linkedinUrl: string,
  recruiterEmail: string,
  leadId?: string | null
): Promise<{ email: string } | { error: string } | null> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(REQUEST_DETAILS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-merito-extension-key": extensionKey,
      },
      body: JSON.stringify(leadId ? { linkedinUrl, recruiterEmail, leadId } : { linkedinUrl, recruiterEmail }),
    });
    const data = (await response.json()) as { email?: string; error?: string };
    if (!response.ok || !data.email) {
      return { error: data.error || "Couldn't reveal contact details." };
    }
    return { email: data.email };
  } catch {
    return null;
  }
}
