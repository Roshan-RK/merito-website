import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import SignOutButton from "./SignOutButton";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = user
    ? await supabase
        .from("fitment_leads")
        .select("id, role_title, score, verdict, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: 0 }}>
          Your Merito HUB account
        </h1>
        <SignOutButton />
      </div>

      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, marginBottom: 20 }}>
        Signed in as {user?.email}.
      </p>

      {leads && leads.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="bg-white border border-black/[0.08]"
              style={{ borderRadius: 14, padding: 16 }}
            >
              <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>
                {lead.role_title}
              </p>
              <p className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "1.5rem", margin: "6px 0" }}>
                {lead.score} / 10
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, margin: 0 }}>
                {lead.verdict}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 14 }}>
          No fitment scores yet. Head back to the HUB to check your fit for a role.
        </p>
      )}
    </main>
  );
}
