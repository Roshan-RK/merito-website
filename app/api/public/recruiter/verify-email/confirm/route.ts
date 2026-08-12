import { confirmRecruiterEmail } from "@/lib/recruiterIdentity";

export const runtime = "nodejs";

function page(status: number, ok: boolean, heading: string, body: string): Response {
  const iconColor = ok ? "#16a34a" : "#dc2626";
  const icon = ok
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="${iconColor}"/><path d="M7 12.5l3 3 7-7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="${iconColor}"/><path d="M12 7v6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.15" fill="#fff"/></svg>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading} — Merito</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f6f7f9; color: #1a1a1a; padding: 24px;
  }
  .card {
    max-width: 380px; width: 100%; background: #fff; border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);
    padding: 36px 32px; text-align: center;
  }
  .icon { margin-bottom: 16px; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.5; color: #555; margin: 0; }
  .brand { margin-top: 24px; font-size: 12px; color: #999; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
    <div class="brand">Merito</div>
  </div>
</body>
</html>`;

  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return page(400, false, "Invalid link", "This confirmation link is invalid.");
  }

  const result = await confirmRecruiterEmail(token);
  if (!result) {
    return page(
      400,
      false,
      "Link expired",
      "This confirmation link is invalid or has expired. Please request a new one from the extension."
    );
  }

  return page(
    200,
    true,
    "Email confirmed",
    `${result.email} is confirmed. You can close this tab and go back to LinkedIn.`
  );
}
