import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { sendTestEmail, TEMPLATE_KEYS } from "@/lib/emailTemplates";
import type { TemplateKey } from "@/lib/emailTemplates";

const PostSchema = z.object({
  subject: z.string().min(1),
  bodyText: z.string().min(1),
  bodyHtml: z.string().min(1),
});

type RouteContext = { params: Promise<{ key: string }> };

function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { key } = await params;
  if (!isTemplateKey(key)) {
    return Response.json({ error: "Unknown template key." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "subject, bodyText, and bodyHtml are required." }, { status: 400 });
  }

  try {
    await sendTestEmail(key, parsed.data, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send test email.";
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ ok: true });
}
