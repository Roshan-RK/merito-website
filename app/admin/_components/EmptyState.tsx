export default function EmptyState({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div
      className="font-[family-name:var(--font-poppins)]"
      style={{ padding: "28px 16px", textAlign: "center", fontSize: 14, color: tone === "success" ? "#16803c" : "#9c9c9c" }}
    >
      {message}
    </div>
  );
}
