import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { recordManualReconciliation } from "@/lib/adminPayments";

const PostSchema = z.object({
  userId: z.string().min(1),
  leadId: z.string().min(1).nullable(),
  product: z.enum(["report", "personality", "references"]),
  amountPaise: z.number().int().positive(),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "userId, product, and a positive amountPaise are required." }, { status: 400 });
  }

  try {
    await recordManualReconciliation(parsed.data, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record reconciliation.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
