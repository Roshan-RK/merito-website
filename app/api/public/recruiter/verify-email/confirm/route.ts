import { confirmRecruiterEmail } from "@/lib/recruiterIdentity";

export const runtime = "nodejs";

function page(status: number, message: string): Response {
  return new Response(
    `<!doctype html><html><body style="font-family: sans-serif; padding: 40px; text-align: center;"><p>${message}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return page(400, "This confirmation link is invalid.");
  }

  const result = await confirmRecruiterEmail(token);
  if (!result) {
    return page(400, "This confirmation link is invalid or has expired. Please request a new one from the extension.");
  }

  return page(200, `${result.email} is confirmed — you can close this tab and go back to LinkedIn.`);
}
