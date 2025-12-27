/**
 * RateLimiterController
 * 
 * Production-ready rate limiting with multiple algorithms:
 * - Fixed Window
 * - Sliding Window
 * - Token Bucket
 * 
 * @example
 * ```typescript
 * import { RateLimiterController } from "./controllers/RateLimiterController.ts";
 * 
 * const limiter = new RateLimiterController(redis);
 * const result = await limiter.check("user-123", 10, 60); // 10 req/min
 * 
 * if (!result.allowed) {
 *   throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter}s`);
 * }
 * ```
 */

import type { RedisWrapper } from "../redis-wrapper.ts";
import { createNamespacedRedis } from "../index";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfter?: number;
}

export type RateLimitAlgorithm = "fixed" | "sliding" | "token-bucket";

export interface RateLimitOptions {
  /** Algorithm to use (default: "fixed") */
  algorithm?: RateLimitAlgorithm;
  /** Token bucket capacity (only for token-bucket algorithm) */
  capacity?: number;
  /** Token bucket refill rate per second (only for token-bucket algorithm) */
  refillRate?: number;
}

export class RateLimiterController {
  private redis: any;
  private namespace = "ratelimit";

  constructor(redis: RedisWrapper) {
    this.redis = createNamespacedRedis(redis, this.namespace);
  }

  /**
   * Check rate limit for an identifier
   * 
   * @param identifier - User ID, IP address, or other identifier
   * @param maxRequests - Maximum requests allowed
   * @param windowSeconds - Time window in seconds
   * @param options - Additional options
   * @returns Rate limit result
   */
  async check(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
    options: RateLimitOptions = {}
  ): Promise<RateLimitResult> {
    const algorithm = options.algorithm || "fixed";

    switch (algorithm) {
      case "sliding":
        return await this.checkSlidingWindow(identifier, maxRequests, windowSeconds);
      case "token-bucket":
        return await this.checkTokenBucket(
          identifier,
          options.capacity || maxRequests,
          options.refillRate || maxRequests / windowSeconds
        );
      case "fixed":
      default:
        return await this.checkFixedWindow(identifier, maxRequests, windowSeconds);
    }
  }

  /**
   * Fixed Window Algorithm
   * Simple counter that resets every window
   */
  private async checkFixedWindow(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `fixed:${identifier}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Increment counter
    const count = await this.redis.incr(key);

    // Set expiry on first request in window
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    // Get TTL for reset time
    const ttl = await this.redis.ttl(key);
    const resetAt = now + (ttl * 1000);

    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    return {
      allowed,
      remaining,
      limit: maxRequests,
      resetAt,
      retryAfter: allowed ? undefined : ttl
    };
  }

  /**
   * Sliding Window Algorithm
   * More accurate, prevents edge-case bursts
   */
  private async checkSlidingWindow(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `sliding:${identifier}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Remove old entries
    await this.redis.command("ZREMRANGEBYSCORE", key, 0, windowStart);

    // Count requests in current window
    const count = await this.redis.zcard(key);

    const allowed = count < maxRequests;

    if (allowed) {
      // Add current request
      await this.redis.zadd(key, [now, `${now}-${Math.random()}`]);
      await this.redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, maxRequests - count - (allowed ? 1 : 0));
    const resetAt = now + (windowSeconds * 1000);

    return {
      allowed,
      remaining,
      limit: maxRequests,
      resetAt,
      retryAfter: allowed ? undefined : windowSeconds
    };
  }

  /**
   * Token Bucket Algorithm
   * Allows bursts with smooth refilling
   */
  private async checkTokenBucket(
    identifier: string,
    capacity: number,
    refillRate: number
  ): Promise<RateLimitResult> {
    const key = `bucket:${identifier}`;
    const now = Date.now();

    // Get current bucket state
    const bucketData = await this.redis.get(key);
    
    let tokens: number;
    let lastRefill: number;

    if (bucketData) {
      const data = JSON.parse(bucketData);
      tokens = data.tokens;
      lastRefill = data.lastRefill;

      // Calculate tokens to add based on time elapsed
      const elapsed = (now - lastRefill) / 1000; // seconds
      const tokensToAdd = elapsed * refillRate;
      tokens = Math.min(capacity, tokens + tokensToAdd);
    } else {
      // New bucket
      tokens = capacity;
      lastRefill = now;
    }

    const allowed = tokens >= 1;

    if (allowed) {
      tokens -= 1;
    }

    // Save bucket state
    await this.redis.set(key, JSON.stringify({
      tokens,
      lastRefill: now
    }), { EX: 3600 }); // Expire after 1 hour of inactivity

    return {
      allowed,
      remaining: Math.floor(tokens),
      limit: capacity,
      resetAt: now + ((capacity - tokens) / refillRate * 1000),
      retryAfter: allowed ? undefined : Math.ceil((1 - tokens) / refillRate)
    };
  }

  /**
   * Reset rate limit for an identifier
   * 
   * @param identifier - User ID, IP address, or other identifier
   * @param algorithm - Algorithm to reset (default: all)
   */
  async reset(identifier: string, algorithm?: RateLimitAlgorithm): Promise<void> {
    const patterns = algorithm
      ? [`${algorithm}:${identifier}`]
      : [`fixed:${identifier}`, `sliding:${identifier}`, `bucket:${identifier}`];

    for (const pattern of patterns) {
      await this.redis.del(pattern);
    }
  }

  /**
   * Get current usage for an identifier
   * 
   * @param identifier - User ID, IP address, or other identifier
   * @param algorithm - Algorithm to check (default: "fixed")
   * @returns Current request count
   */
  async getUsage(identifier: string, algorithm: RateLimitAlgorithm = "fixed"): Promise<number> {
    const key = `${algorithm}:${identifier}`;

    switch (algorithm) {
      case "sliding":
        return await this.redis.zcard(key);
      case "token-bucket": {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data).tokens : 0;
      }
      case "fixed":
      default: {
        const count = await this.redis.get(key);
        return count ? parseInt(count) : 0;
      }
    }
  }

  /**
   * Set custom rate limit for specific identifier
   * (Useful for tiered limits: free, pro, enterprise)
   * 
   * @param identifier - User ID or other identifier
   * @param maxRequests - Maximum requests allowed
   * @param windowSeconds - Time window in seconds
   * @returns Rate limit config key
   */
  async setCustomLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<string> {
    const configKey = `config:${identifier}`;
    await this.redis.setJSON(configKey, { maxRequests, windowSeconds }, { EX: 86400 });
    return configKey;
  }

  /**
   * Get custom rate limit configuration
   * 
   * @param identifier - User ID or other identifier
   * @returns Custom limit configuration or null
   */
  async getCustomLimit(identifier: string): Promise<{ maxRequests: number; windowSeconds: number } | null> {
    const configKey = `config:${identifier}`;
    return await this.redis.getJSON(configKey);
  }
}
