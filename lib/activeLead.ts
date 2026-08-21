export function resolveActiveLead<T extends { id: string }>(
  leads: T[],
  requestedLeadId?: string | null
): T | null {
  if (leads.length === 0) return null;
  if (requestedLeadId) {
    const match = leads.find((lead) => lead.id === requestedLeadId);
    if (match) return match;
  }
  return leads[0];
}
