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

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const latestLead = leads?.[0];
  const userName = latestLead?.name || user.email?.split("@")[0] || "there";

  return (
    <AppShell
      leads={leads || []}
      userName={userName}
      userEmail={user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
