export type CriteriaMatchStatus = "Matched" | "Partially Matched" | "Not Matched";

export function getCriteriaStatusColor(status: CriteriaMatchStatus): string {
  if (status === "Matched") return "#16803c";
  if (status === "Partially Matched") return "#d97706";
  return "#ed1a24";
}
