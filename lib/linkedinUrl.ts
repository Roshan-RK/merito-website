export const LINKEDIN_URL_PATTERN = /^https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+$/;

export function normalizeLinkedinUrl(url: string): string {
  const withoutQuery = url.split("?")[0];
  return withoutQuery.endsWith("/") ? withoutQuery.slice(0, -1) : withoutQuery;
}
