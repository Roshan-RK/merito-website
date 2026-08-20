import Link from "next/link";

const LINK_STYLE: React.CSSProperties = {
  background: "transparent",
  color: "#4b4b4d",
  border: "1px solid #dcdcdc",
  fontSize: 13,
  padding: "8px 16px",
  borderRadius: 7,
};

const DISABLED_STYLE: React.CSSProperties = {
  ...LINK_STYLE,
  opacity: 0.6,
  pointerEvents: "none",
};

export default function Pagination({ page, totalPages, basePath }: { page: number; totalPages: number; basePath: string }) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "16px 0" }}>
      {page > 1 ? (
        <Link href={`${basePath}?page=${page - 1}`} className="font-[family-name:var(--font-poppins)] font-semibold" style={LINK_STYLE}>
          Previous
        </Link>
      ) : (
        <span className="font-[family-name:var(--font-poppins)] font-semibold" style={DISABLED_STYLE}>
          Previous
        </span>
      )}
      <span className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13 }}>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`${basePath}?page=${page + 1}`} className="font-[family-name:var(--font-poppins)] font-semibold" style={LINK_STYLE}>
          Next
        </Link>
      ) : (
        <span className="font-[family-name:var(--font-poppins)] font-semibold" style={DISABLED_STYLE}>
          Next
        </span>
      )}
    </div>
  );
}
