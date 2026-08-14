import { requireAdmin } from "@/lib/adminAuth";
import { voidStuckTransaction } from "@/lib/adminPayments";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { orderId } = await params;

  try {
    await voidStuckTransaction(orderId, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to void transaction.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
