import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";

export async function requireAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("Admin area is not configured (ADMIN_EMAIL missing).");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login?next=/admin");
  }

  if (user.email !== adminEmail) {
    notFound();
  }

  return user;
}
