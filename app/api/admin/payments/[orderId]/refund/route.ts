import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { refundTransaction } from "@/lib/adminPayments";

const PostSchema = z.object({ reason: z.string().min(1) });

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { orderId } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "reason is required." }, { status: 400 });
  }

  try {
    await refundTransaction(orderId, parsed.data.reason, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refund transaction.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
