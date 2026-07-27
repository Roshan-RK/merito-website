import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createOrder } from "@/lib/razorpay/client";
import { PRODUCT_PRICING, PRODUCT_LABELS, DEFAULT_LEVEL, type CandidateLevel, type RazorpayProduct } from "@/lib/razorpay/pricing";

export const runtime = "nodejs";

// "report" has its own dedicated route (app/api/hub/unlock-report) because
// it's tied to a specific fitment_leads row (leadId) — this generic route
// is for account-level products that aren't tied to any one lead.
const INITIATABLE_PRODUCTS: RazorpayProduct[] = ["counselling", "personality", "references"];

function isInitiatableProduct(value: unknown): value is RazorpayProduct {
  return typeof value === "string" && (INITIATABLE_PRODUCTS as string[]).includes(value);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { product?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isInitiatableProduct(body.product)) {
    return Response.json({ error: "Unknown product." }, { status: 400 });
  }
  const product = body.product;

  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const level = (lead?.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
  const amountPaise = PRODUCT_PRICING[product][level];

  const { orderId } = await createOrder({
    amountPaise,
    currency: "INR",
    receipt: `${product}-${Date.now()}`,
  });

  const admin = getSupabaseServerClient();
  const { error: insertError } = await admin.from("razorpay_transactions").insert({
    order_id: orderId,
    user_id: user.id,
    product,
    level,
    lead_id: null,
    amount_paise: amountPaise,
    status: "initiated",
  });

  if (insertError) {
    return Response.json({ error: "Something went wrong starting payment." }, { status: 500 });
  }

  return Response.json({
    status: "checkout",
    orderId,
    amountPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID,
    name: "Merito",
    description: PRODUCT_LABELS[product],
    prefill: { name: user.email?.split("@")[0] || "Candidate", email: user.email ?? "" },
  });
}
