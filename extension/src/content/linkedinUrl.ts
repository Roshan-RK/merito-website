export const LINKEDIN_URL_PATTERN = /^https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+$/;

export function normalizeLinkedinUrl(url: string): string {
  const withoutQueryOrHash = url.split(/[?#]/)[0];
  return withoutQueryOrHash.endsWith("/") ? withoutQueryOrHash.slice(0, -1) : withoutQueryOrHash;
}
