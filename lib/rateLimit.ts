type RateLimitOptions = {
  max: number;
  windowMs: number;
};

export function createRateLimiter({ max, windowMs }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  };
}
