/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;

  /** Time window in seconds */
  windowSeconds: number;
}

/**
 * Rate limit storage interface
 * For Cloudflare Workers, we use KV
 * For Go+Redis, we can use Redis with INCR and EXPIRE
 */
interface RateLimitStorage {
  increment(key: string, ttl: number): Promise<number>;
}

/**
 * KV-based rate limit storage
 */
export class KVRateLimitStorage implements RateLimitStorage {
  constructor(private kv: KVNamespace) {}

  async increment(key: string, ttl: number): Promise<number> {
    // Get current count
    const current = await this.kv.get(key);
    const count = current ? parseInt(current, 10) : 0;
    const newCount = count + 1;

    // Store new count with TTL
    await this.kv.put(key, newCount.toString(), {
      expirationTtl: ttl,
    });

    return newCount;
  }
}

/**
 * Extract IP address from request
 * Cloudflare Workers provides this in CF object
 *
 * @param request Request object
 * @returns IP address or "unknown"
 */
function getClientIP(request: Request): string {
  // Cloudflare provides IP in the cf object
  const cf = (request as any).cf;
  if (cf && cf.ip) {
    return cf.ip;
  }

  // Fallback to headers
  const forwarded = request.headers.get("cf-connecting-ip");
  if (forwarded) {
    return forwarded;
  }

  return "unknown";
}

/**
 * Rate limiting middleware
 *
 * @param request Request object
 * @param storage Rate limit storage
 * @param config Rate limit configuration
 * @returns null if allowed, Response if rate limited
 */
export async function rateLimit(
  request: Request,
  storage: RateLimitStorage,
  config: RateLimitConfig
): Promise<Response | null> {
  const ip = getClientIP(request);

  // Create rate limit key
  const window = Math.floor(Date.now() / 1000 / config.windowSeconds);
  const key = `ratelimit:${ip}:${window}`;

  try {
    // Increment counter
    const count = await storage.increment(key, config.windowSeconds);

    // Check if over limit
    if (count > config.limit) {
      const resetTime = (window + 1) * config.windowSeconds;
      const retryAfter = resetTime - Math.floor(Date.now() / 1000);

      const response = new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          statusCode: 429,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": config.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetTime.toString(),
          },
        }
      );

      return response;
    }

    // Under limit, allow request
    return null;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // On error, fail open (allow request)
    return null;
  }
}

/**
 * Create rate limit headers for successful responses
 *
 * @param limit Maximum requests per window
 * @param remaining Remaining requests in window
 * @param resetTime Unix timestamp when the limit resets
 * @returns Headers object
 */
export function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetTime: number
): HeadersInit {
  return {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": Math.max(0, remaining).toString(),
    "X-RateLimit-Reset": resetTime.toString(),
  };
}
