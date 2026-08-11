const REQUEST_DETAILS_URL = "https://www.merito.ai/api/public/recruiter-preview/request-details";

export type RequestContactDetailsResponse = { status: "pending" | "approved" | "denied" };

export async function requestContactDetails(linkedinUrl: string): Promise<RequestContactDetailsResponse | null> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(REQUEST_DETAILS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-merito-extension-key": extensionKey,
      },
      body: JSON.stringify({ linkedinUrl }),
    });
    if (!response.ok) return null;
    return (await response.json()) as RequestContactDetailsResponse;
  } catch {
    return null;
  }
}
