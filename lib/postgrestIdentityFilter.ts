// role_title is unvalidated free text (first line of a pasted JD, sliced to
// 80 chars -- see lib/prospectConversion.ts). postgrest-js does zero
// escaping on .or() filter strings: a value containing a comma, parenthesis,
// or double quote would otherwise split into an extra invalid clause and the
// whole request would 400 -- which every call site swallows into `data:
// null` (looks like "no interview/lead found", not an error). Quoting the
// value as a PostgREST double-quoted string literal (escaping backslashes
// then double quotes) keeps commas/parens/quotes inside role_title from ever
// being interpreted as filter syntax.
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Matches fitment_interviews against a known lead: an exact lead_id link
// when one exists, OR (for rows that predate the lead_id backfill) a
// role_title text match.
export function leadIdOrRoleTitleFilter(leadId: string, roleTitle: string): string {
  return `lead_id.eq.${leadId},role_title.eq.${quoteFilterValue(roleTitle)}`;
}

// Reversed direction: matches fitment_leads.id against an interview's own
// lead_id, OR (for interviews that predate the lead_id backfill) a
// role_title text match.
export function fitmentLeadIdOrRoleTitleFilter(fitmentLeadId: string, roleTitle: string): string {
  return `id.eq.${fitmentLeadId},role_title.eq.${quoteFilterValue(roleTitle)}`;
}
