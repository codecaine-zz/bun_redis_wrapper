/**
 * Demo 4: Rate Limiting
 * 
 * Demonstrates various rate limiting patterns:
 * - Fixed window rate limiting
 * - Sliding window rate limiting
 * - Token bucket algorithm
 * - Per-user and per-IP rate limits
 * 
 * Run with: bun run demos/04-rate-limiting.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

class RateLimiter {
  private limiter;

  constructor(redis: any) {
    this.limiter = createNamespacedRedis(redis, "ratelimit");
  }

  /**
   * Strategy 1: Fixed Window Rate Limiting
   * - Simple counter that resets every window (e.g., every minute)
   * - Fast and memory efficient
   * - Can allow burst at window boundaries
   */
  async checkFixedWindow(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `fixed:${identifier}`;
    
    // Increment counter
    const count = await this.limiter.incr(key);
    
    // Set TTL on first request
    if (count === 1) {
      await this.limiter.expire(key, windowSeconds);
    }

    // Get TTL for reset time
    const ttl = await this.limiter.ttl(key);
    const resetAt = Date.now() + (ttl * 1000);

    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : ttl
    };
  }

  /**
   * Strategy 2: Sliding Window Rate Limiting (using sorted sets)
   * - More accurate than fixed window
   * - Prevents burst at window boundaries
   * - Uses timestamps as scores
   */
  async checkSlidingWindow(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `sliding:${identifier}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Remove old entries outside the window
    await this.limiter.command("ZREMRANGEBYSCORE", key, 0, windowStart);

    // Count requests in current window
    const count = await this.limiter.zcard(key);

    const allowed = count < maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    if (allowed) {
      // Add current request with timestamp as score
      await this.limiter.zadd(key, [now, `${now}-${Math.random()}`]);
      // Set expiry to clean up old data
      await this.limiter.expire(key, windowSeconds * 2);
    }

    // Calculate when the oldest request will expire
    const oldest = await this.limiter.zrange(key, 0, 0, true);
    let resetAt = now + (windowSeconds * 1000);
    if (oldest && oldest.length > 0 && Array.isArray(oldest[0])) {
      const oldestTimestamp = Number(oldest[0][1]);
      resetAt = oldestTimestamp + (windowSeconds * 1000);
    }

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000)
    };
  }

  /**
   * Strategy 3: Token Bucket Algorithm
   * - Smooth rate limiting with burst capacity
   * - Tokens replenish over time
   * - Allows short bursts while maintaining average rate
   */
  async checkTokenBucket(
    identifier: string,
    capacity: number,
    refillRate: number, // tokens per second
    cost: number = 1
  ): Promise<RateLimitResult> {
    const key = `bucket:${identifier}`;
    const now = Date.now();

    // Get bucket state
    const state = await this.limiter.getJSON<{
      tokens: number;
      lastRefill: number;
    }>(key);

    let tokens = capacity;
    let lastRefill = now;

    if (state) {
      // Calculate new tokens based on time elapsed
      const elapsed = (now - state.lastRefill) / 1000;
      const newTokens = elapsed * refillRate;
      tokens = Math.min(capacity, state.tokens + newTokens);
      lastRefill = now;
    }

    const allowed = tokens >= cost;
    
    if (allowed) {
      tokens -= cost;
    }

    // Save updated state
    await this.limiter.setJSON(key, { tokens, lastRefill }, { EX: 3600 });

    return {
      allowed,
      remaining: Math.floor(tokens),
      resetAt: now + Math.ceil(((capacity - tokens) / refillRate) * 1000)
    };
  }

  /**
   * Multi-tier rate limiting (per user + per IP)
   */
  async checkMultiTier(
    userId: string,
    ipAddress: string,
    userLimit: number,
    ipLimit: number,
    windowSeconds: number
  ): Promise<{ user: RateLimitResult; ip: RateLimitResult }> {
    const [userResult, ipResult] = await Promise.all([
      this.checkFixedWindow(userId, userLimit, windowSeconds),
      this.checkFixedWindow(ipAddress, ipLimit, windowSeconds)
    ]);

    return { user: userResult, ip: ipResult };
  }

  /**
   * Get rate limit info without consuming quota
   */
  async getInfo(identifier: string, type: "fixed" | "sliding"): Promise<RateLimitResult> {
    const key = `${type}:${identifier}`;
    
    if (type === "fixed") {
      const count = parseInt(await this.limiter.get(key) || "0");
      const ttl = await this.limiter.ttl(key);
      
      return {
        allowed: true,
        remaining: 0,
        resetAt: Date.now() + (ttl * 1000)
      };
    } else {
      const count = await this.limiter.zcard(key);
      return {
        allowed: true,
        remaining: 0,
        resetAt: Date.now()
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    await this.limiter.del(
      `fixed:${identifier}`,
      `sliding:${identifier}`,
      `bucket:${identifier}`
    );
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function simulateRequest(
  result: RateLimitResult,
  requestNum: number
): Promise<void> {
  if (result.allowed) {
    console.log(`  ✅ Request ${requestNum}: ALLOWED (${result.remaining} remaining)`);
  } else {
    console.log(`  ❌ Request ${requestNum}: DENIED (retry in ${result.retryAfter}s)`);
  }
}

async function main() {
  console.log("🚦 Demo 4: Rate Limiting\n");

  await using redis = await createRedis("redis://localhost:6379");
  const rateLimiter = new RateLimiter(redis);

  // ============================================================================
  // Strategy 1: Fixed Window
  // ============================================================================
  console.log("📊 Strategy 1: Fixed Window Rate Limiting");
  console.log("─────────────────────────────────────────");
  console.log("Limit: 5 requests per 10 seconds\n");

  for (let i = 1; i <= 7; i++) {
    const result = await rateLimiter.checkFixedWindow("user:alice", 5, 10);
    await simulateRequest(result, i);
    
    if (i === 5) {
      console.log("");
    }
  }

  console.log("");

  // ============================================================================
  // Strategy 2: Sliding Window
  // ============================================================================
  console.log("🎯 Strategy 2: Sliding Window Rate Limiting");
  console.log("─────────────────────────────────────────");
  console.log("Limit: 5 requests per 10 seconds\n");

  // Reset for clean demo
  await rateLimiter.reset("user:bob");

  for (let i = 1; i <= 6; i++) {
    const result = await rateLimiter.checkSlidingWindow("user:bob", 5, 10);
    await simulateRequest(result, i);
    
    // Pause to show sliding window effect
    if (i === 3) {
      console.log("  ⏸️  Waiting 3 seconds...\n");
      await Bun.sleep(3000);
    }
  }

  console.log("");

  // ============================================================================
  // Strategy 3: Token Bucket
  // ============================================================================
  console.log("🪣 Strategy 3: Token Bucket Algorithm");
  console.log("─────────────────────────────────────────");
  console.log("Capacity: 10 tokens, Refill: 2 tokens/second\n");

  await rateLimiter.reset("user:charlie");

  // Burst of requests
  console.log("  🔥 Initial burst:");
  for (let i = 1; i <= 5; i++) {
    const result = await rateLimiter.checkTokenBucket("user:charlie", 10, 2, 1);
    console.log(`    Request ${i}: ${result.allowed ? '✅' : '❌'} (${result.remaining} tokens)`);
  }

  console.log("\n  ⏸️  Waiting 3 seconds (6 tokens refill)...\n");
  await Bun.sleep(3000);

  console.log("  🔥 After refill:");
  for (let i = 6; i <= 10; i++) {
    const result = await rateLimiter.checkTokenBucket("user:charlie", 10, 2, 1);
    console.log(`    Request ${i}: ${result.allowed ? '✅' : '❌'} (${result.remaining} tokens)`);
  }

  console.log("");

  // ============================================================================
  // Strategy 4: Multi-Tier Rate Limiting
  // ============================================================================
  console.log("🎚️  Strategy 4: Multi-Tier Rate Limiting");
  console.log("─────────────────────────────────────────");
  console.log("User limit: 10 req/min, IP limit: 20 req/min\n");

  await rateLimiter.reset("user:dave");
  await rateLimiter.reset("ip:192.168.1.100");

  // Simulate multiple users from same IP
  for (let i = 1; i <= 3; i++) {
    const result = await rateLimiter.checkMultiTier(
      "user:dave",
      "ip:192.168.1.100",
      10,
      20,
      60
    );

    console.log(`  Request ${i}:`);
    console.log(`    User: ${result.user.allowed ? '✅' : '❌'} (${result.user.remaining} remaining)`);
    console.log(`    IP:   ${result.ip.allowed ? '✅' : '❌'} (${result.ip.remaining} remaining)`);
  }

  console.log("");

  // ============================================================================
  // Real-World API Example
  // ============================================================================
  console.log("🌐 Real-World API Rate Limiting Example");
  console.log("─────────────────────────────────────────");

  async function simulateAPIRequest(
    apiKey: string,
    endpoint: string,
    tier: "free" | "pro" | "enterprise"
  ): Promise<void> {
    const limits = {
      free: { requests: 10, window: 60 },
      pro: { requests: 100, window: 60 },
      enterprise: { requests: 1000, window: 60 }
    };

    const config = limits[tier];
    const identifier = `api:${apiKey}:${endpoint}`;

    const result = await rateLimiter.checkSlidingWindow(
      identifier,
      config.requests,
      config.window
    );

    if (result.allowed) {
      console.log(`  ✅ ${tier.toUpperCase()} - ${endpoint}: Success (${result.remaining} remaining)`);
    } else {
      console.log(`  ❌ ${tier.toUpperCase()} - ${endpoint}: Rate limited (retry in ${result.retryAfter}s)`);
    }
  }

  console.log("\nFree tier (10 req/min):");
  await rateLimiter.reset("api:free-key-123:/api/data");
  for (let i = 1; i <= 3; i++) {
    await simulateAPIRequest("free-key-123", "/api/data", "free");
  }

  console.log("\nPro tier (100 req/min):");
  await rateLimiter.reset("api:pro-key-456:/api/data");
  for (let i = 1; i <= 3; i++) {
    await simulateAPIRequest("pro-key-456", "/api/data", "pro");
  }

  console.log("\nEnterprise tier (1000 req/min):");
  await rateLimiter.reset("api:ent-key-789:/api/data");
  for (let i = 1; i <= 3; i++) {
    await simulateAPIRequest("ent-key-789", "/api/data", "enterprise");
  }

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("\n\n💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Fixed window: Simple, fast, good for basic limits");
  console.log("  ✓ Sliding window: More accurate, prevents edge-case bursts");
  console.log("  ✓ Token bucket: Smooth limiting with burst capacity");
  console.log("  ✓ Multi-tier: Combine user + IP limits for better protection");
  console.log("  ✓ Return retry-after headers in responses");
  console.log("  ✓ Use different limits per tier/endpoint");
  console.log("  ✓ Monitor and adjust limits based on usage patterns");

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  const keys = await rateLimiter["limiter"].scanAll("*");
  if (keys.length > 0) {
    await rateLimiter["limiter"].del(...keys);
  }

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
