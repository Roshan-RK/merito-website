import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { getRecruiter } from "@/lib/adminRecruiters";
import RecruiterActions from "./RecruiterActions";

export default async function AdminRecruiterDetailPage({ params }: { params: Promise<{ email: string }> }) {
  await requireAdmin();
  const { email } = await params;
  const recruiter = await getRecruiter(decodeURIComponent(email));
  if (!recruiter) notFound();

  return (
    <div style={{ padding: 24 }}>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 22, marginBottom: 4 }}>
        {recruiter.email}
      </h2>
      <p style={{ fontSize: 13, color: "#9c9c9c", marginBottom: 20 }}>
        Verified: {recruiter.verifiedAt ? "Yes" : "No"} · Banned: {recruiter.bannedAt ? "Yes" : "No"}
      </p>
      <RecruiterActions email={recruiter.email} banned={Boolean(recruiter.bannedAt)} verified={Boolean(recruiter.verifiedAt)} companyName={recruiter.companyName} />
    </div>
  );
}
