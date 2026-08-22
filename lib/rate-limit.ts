export class RateLimiter {
  private cache: Map<string, { count: number; expiresAt: number }>;
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.cache = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public check(identifier: string): boolean {
    const now = Date.now();
    const record = this.cache.get(identifier);

    if (!record) {
      this.cache.set(identifier, {
        count: 1,
        expiresAt: now + this.windowMs,
      });
      return true;
    }

    if (now > record.expiresAt) {
      // Window expired, reset
      this.cache.set(identifier, {
        count: 1,
        expiresAt: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    // Increment count
    record.count += 1;
    this.cache.set(identifier, record);
    return true;
  }

  // Optional: cleanup expired entries periodically if memory becomes an issue
  public cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Global singleton instances to persist across hot reloads in development
// and across invocations in production (per isolated Node instance)
const globalForRateLimiter = globalThis as unknown as {
  checkoutLimiter: RateLimiter | undefined;
};

// Checkout: max 3 requests per 1 minute
export const checkoutLimiter =
  globalForRateLimiter.checkoutLimiter ?? new RateLimiter(3, 60 * 1000);

if (process.env.NODE_ENV !== "production") {
  globalForRateLimiter.checkoutLimiter = checkoutLimiter;
}
