import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import AppShell from "./AppShell";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("role_title, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const userName = lead?.name || user.email?.split("@")[0] || "there";

  return (
    <AppShell roleTitle={lead?.role_title ?? ""} userName={userName}>
      {children}
    </AppShell>
  );
}
