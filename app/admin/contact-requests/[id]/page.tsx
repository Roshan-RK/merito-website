import { notFound } from "next/navigation";
import { getContactRequest, ALLOWED_TRANSITIONS } from "@/lib/adminContactRequests";
import ContactRequestStatusForm from "./ContactRequestStatusForm";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminContactRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contactRequest = await getContactRequest(id);

  if (!contactRequest) {
    notFound();
  }

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        {contactRequest.email}
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 28px" }}>
        {contactRequest.linkedinUrl}
        {contactRequest.roleTitle && ` · ${contactRequest.roleTitle}`}
        {" · Requested "}
        {formatDate(contactRequest.requestedAt)}
        {contactRequest.decidedAt && ` · Decided ${formatDate(contactRequest.decidedAt)} by ${contactRequest.decidedBy}`}
      </p>

      <ContactRequestStatusForm
        id={contactRequest.id}
        currentStatus={contactRequest.status}
        allowedNext={ALLOWED_TRANSITIONS[contactRequest.status]}
      />
    </div>
  );
}
