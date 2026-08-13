import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "#ed1a24", color: "#fff", border: "1px solid #ed1a24" },
  secondary: { background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc" },
  danger: { background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24" },
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export default function Button({ variant = "primary", loading = false, disabled, type = "button", children, style, ...rest }: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      className="font-[family-name:var(--font-poppins)] font-semibold"
      style={{
        ...VARIANT_STYLE[variant],
        fontSize: 13,
        padding: "8px 16px",
        borderRadius: 7,
        cursor: isDisabled ? "default" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        ...style,
      }}
    >
      {loading ? "…" : children}
    </button>
  );
}
