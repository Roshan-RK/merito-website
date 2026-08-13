export type BadgeVariant = "success" | "warning" | "neutral" | "danger";

const VARIANT_STYLE: Record<BadgeVariant, { color: string; background: string }> = {
  success: { color: "#16803c", background: "rgba(22,128,60,0.08)" },
  warning: { color: "#c77700", background: "rgba(199,119,0,0.08)" },
  neutral: { color: "#9c9c9c", background: "rgba(156,156,156,0.08)" },
  danger: { color: "#ed1a24", background: "rgba(237,26,36,0.08)" },
};

export default function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  const { color, background } = VARIANT_STYLE[variant];
  return (
    <span
      className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
      style={{
        display: "inline-block",
        color,
        background,
        fontSize: 11,
        letterSpacing: "0.03em",
        padding: "4px 10px",
        borderRadius: 50,
      }}
    >
      {children}
    </span>
  );
}
