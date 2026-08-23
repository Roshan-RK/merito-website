export function resolveActiveLead<T extends { id: string }>(
  leads: T[],
  leadIdOverride?: string
): T {
  if (leads.length === 0) {
    throw new Error("resolveActiveLead: leads array must not be empty");
  }
  if (leadIdOverride) {
    const match = leads.find((lead) => lead.id === leadIdOverride);
    if (match) return match;
  }
  return leads[0];
}
