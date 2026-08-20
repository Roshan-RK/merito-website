// Minimal "time ago" formatter for dashboard activity rows -- intentionally
// coarse (minutes/hours/days), matching the granularity the mockup uses
// ("2h ago", "1d ago") rather than pulling in a date library for this.
export function formatRelativeTime(isoDate: string, now: number = Date.now()): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";

  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
