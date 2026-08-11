const EXTRACT_JD_TEXT_URL = "https://www.merito.ai/api/public/recruiter-preview/extract-jd-text";

export async function extractJdTextFromFile(file: File): Promise<{ jdText: string } | { error: string }> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  const form = new FormData();
  form.set("jdFile", file);

  const fallbackError = "Couldn't read that file — try pasting the JD instead.";
  try {
    const response = await fetch(EXTRACT_JD_TEXT_URL, {
      method: "POST",
      headers: { "x-merito-extension-key": extensionKey },
      body: form,
    });
    const data = (await response.json()) as { jdText?: string; error?: string };
    if (!response.ok || !data.jdText) {
      return { error: data.error || fallbackError };
    }
    return { jdText: data.jdText };
  } catch {
    return { error: fallbackError };
  }
}
