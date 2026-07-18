import FeedbackForm from "./FeedbackForm";

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
      <FeedbackForm token={token} />
    </main>
  );
}
