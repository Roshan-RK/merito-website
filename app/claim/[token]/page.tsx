import ClaimForm from "./ClaimForm";

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 20px" }}>
      <ClaimForm token={token} />
    </main>
  );
}
