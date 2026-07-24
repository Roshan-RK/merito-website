import { getSupabaseServerClient } from "@/lib/supabase";

export type UnlockableProduct = "personality" | "references";

export async function unlockProduct(userId: string, product: UnlockableProduct): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("product_unlocks")
    .upsert({ user_id: userId, product }, { onConflict: "user_id,product" });

  if (error) {
    throw new Error(`Failed to unlock ${product}: ${error.message}`);
  }
}

export async function isProductUnlocked(userId: string, product: UnlockableProduct): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("product", product)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check ${product} unlock status: ${error.message}`);
  }

  return Boolean(data);
}
