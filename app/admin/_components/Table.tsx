import type { ReactNode } from "react";
import EmptyState from "@/app/admin/_components/EmptyState";

const HEAD_CELL_STYLE: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 11,
  letterSpacing: "0.04em",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const BODY_CELL_STYLE: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
};

export function Table({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="bg-white border border-black/[0.08]" style={{ overflowX: "auto", borderRadius: 14 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth }}>{children}</table>
    </div>
  );
}

export function TableHeadRow({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: "1px solid #eee" }}>
        {columns.map((label) => (
          <th
            key={label}
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
            style={HEAD_CELL_STYLE}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr style={{ borderBottom: "1px solid #eee" }}>{children}</tr>;
}

export function TableCell({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <td className="font-[family-name:var(--font-poppins)] text-black" style={{ ...BODY_CELL_STYLE, textAlign: align }}>
      {children}
    </td>
  );
}

export function TableEmptyRow({
  colSpan,
  message,
  tone = "neutral",
}: {
  colSpan: number;
  message: string;
  tone?: "neutral" | "success";
}) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <EmptyState message={message} tone={tone} />
      </td>
    </tr>
  );
}
