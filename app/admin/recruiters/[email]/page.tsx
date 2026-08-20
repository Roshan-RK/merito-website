import { notFound } from "next/navigation";
import { getRecruiter } from "@/lib/adminRecruiters";
import RecruiterActions from "./RecruiterActions";

export default async function AdminRecruiterDetailPage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const recruiter = await getRecruiter(decodeURIComponent(email));
  if (!recruiter) notFound();

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        {recruiter.email}
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 32px" }}>
        Verified: {recruiter.verifiedAt ? "Yes" : "No"} · Banned: {recruiter.bannedAt ? "Yes" : "No"}
      </p>
      <RecruiterActions email={recruiter.email} banned={Boolean(recruiter.bannedAt)} verified={Boolean(recruiter.verifiedAt)} companyName={recruiter.companyName} />
    </div>
  );
}
