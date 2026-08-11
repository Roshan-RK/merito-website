const SHORTLIST_URL = "https://www.merito.ai/api/public/recruiter-preview/shortlist";

export async function shortlistProspect(prospectId: string): Promise<{ claimUrl: string; inviteText: string } | null> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(SHORTLIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-merito-extension-key": extensionKey },
      body: JSON.stringify({ prospectId }),
    });
    if (!response.ok) return null;
    return (await response.json()) as { claimUrl: string; inviteText: string };
  } catch {
    return null;
  }
}
