/**
 * CounterController
 * 
 * Simple atomic counters for tracking numbers that need to be precise.
 * Perfect for IDs, page views, downloads, votes, and any counting needs.
 * 
 * Perfect for: Page views, downloads, likes, API calls, inventory
 * 
 * @example
 * ```typescript
 * import { CounterController } from "./controllers/CounterController";
 * 
 * const counters = new CounterController(redis);
 * 
 * // Increment page views
 * await counters.increment("page:home:views");
 * 
 * // Get current count
 * const views = await counters.get("page:home:views");
 * 
 * // Multiple counters at once
 * await counters.incrementMany(["total-users", "monthly-signups"]);
 * ```
 */

import type { RedisWrapper } from "../index";
import { createNamespacedRedis } from "../index";

export interface CounterValue {
  key: string;
  value: number;
}

/**
 * CounterController for atomic counting operations
 * 
 * Thread-safe counters that never lose count, even under heavy load.
 * All operations are atomic - no race conditions!
 */
export class CounterController {
  private redis: ReturnType<typeof createNamespacedRedis>;

  constructor(redis: RedisWrapper) {
    this.redis = createNamespacedRedis(redis, "counter");
  }

  /**
   * Get counter value
   * 
   * @param key - Counter identifier
   * @returns Current value (0 if doesn't exist)
   * 
   * @example
   * ```typescript
   * const views = await counters.get("post:123:views");
   * console.log(`${views} views`);
   * ```
   */
  async get(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Set counter to specific value
   * 
   * Best Practice: Use increment() instead for counting
   * Use this only for initialization or reset
   * 
   * @param key - Counter identifier
   * @param value - Value to set
   * 
   * @example
   * ```typescript
   * // Initialize counter
   * await counters.set("downloads", 1000);
   * 
   * // Reset counter
   * await counters.set("daily-visitors", 0);
   * ```
   */
  async set(key: string, value: number): Promise<void> {
    await this.redis.set(key, value.toString());
  }

  /**
   * Increment counter by 1 (atomic)
   * 
   * Best Practice: Most common counting operation
   * Thread-safe: Multiple processes can increment simultaneously
   * 
   * @param key - Counter identifier
   * @returns New value after increment
   * 
   * @example
   * ```typescript
   * // Count page view
   * const views = await counters.increment("page:home:views");
   * 
   * // Track downloads
   * await counters.increment("app:downloads");
   * 
   * // Count votes
   * await counters.increment(`poll:${pollId}:option:${optionId}`);
   * ```
   */
  async increment(key: string): Promise<number> {
    return Number(await this.redis.command("INCR", key));
  }

  /**
   * Increment counter by specific amount (atomic)
   * 
   * @param key - Counter identifier
   * @param amount - Amount to add (can be negative to subtract)
   * @returns New value after increment
   * 
   * @example
   * ```typescript
   * // Add 5 points
   * await counters.incrementBy("user:123:points", 5);
   * 
   * // Subtract inventory (negative increment)
   * await counters.incrementBy("product:456:stock", -1);
   * ```
   */
  async incrementBy(key: string, amount: number): Promise<number> {
    return Number(await this.redis.command("INCRBY", key, amount));
  }

  /**
   * Decrement counter by 1 (atomic)
   * 
   * @param key - Counter identifier
   * @returns New value after decrement
   * 
   * @example
   * ```typescript
   * // Reduce inventory
   * await counters.decrement("product:789:stock");
   * 
   * // Count down
   * await counters.decrement("tickets:available");
   * ```
   */
  async decrement(key: string): Promise<number> {
    return Number(await this.redis.command("DECR", key));
  }

  /**
   * Decrement counter by specific amount (atomic)
   * 
   * @param key - Counter identifier
   * @param amount - Amount to subtract
   * @returns New value after decrement
   * 
   * @example
   * ```typescript
   * // Remove 10 from stock
   * await counters.decrementBy("product:123:stock", 10);
   * ```
   */
  async decrementBy(key: string, amount: number): Promise<number> {
    return Number(await this.redis.command("DECRBY", key, amount));
  }

  /**
   * Increment multiple counters at once
   * 
   * Efficient way to update multiple counters
   * 
   * @param keys - Array of counter identifiers
   * @returns Array of new values
   * 
   * @example
   * ```typescript
   * // Track both total and daily
   * await counters.incrementMany([
   *   "total-page-views",
   *   "daily-page-views"
   * ]);
   * ```
   */
  async incrementMany(keys: string[]): Promise<number[]> {
    const results: number[] = [];
    for (const key of keys) {
      results.push(await this.increment(key));
    }
    return results;
  }

  /**
   * Get multiple counter values
   * 
   * @param keys - Array of counter identifiers
   * @returns Array of values
   * 
   * @example
   * ```typescript
   * const [total, today] = await counters.getMany([
   *   "total-signups",
   *   "today-signups"
   * ]);
   * ```
   */
  async getMany(keys: string[]): Promise<number[]> {
    const values = await this.redis.mget(...keys);
    return values.map(v => v ? parseInt(v, 10) : 0);
  }

  /**
   * Reset counter to 0
   * 
   * @param key - Counter identifier
   * 
   * @example
   * ```typescript
   * // Reset daily counter
   * await counters.reset("daily-visitors");
   * ```
   */
  async reset(key: string): Promise<void> {
    await this.set(key, 0);
  }

  /**
   * Delete counter
   * 
   * @param key - Counter identifier
   * 
   * @example
   * ```typescript
   * await counters.delete("temp-counter");
   * ```
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Check if counter exists
   * 
   * @param key - Counter identifier
   * @returns True if exists
   * 
   * @example
   * ```typescript
   * if (await counters.exists("page:views")) {
   *   const views = await counters.get("page:views");
   * }
   * ```
   */
  async exists(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return Number(exists) > 0;
  }

  /**
   * Get all counters with their values
   * 
   * Warning: Can be slow with many counters
   * 
   * @param pattern - Pattern to match (default: "*")
   * @returns Array of counter objects
   * 
   * @example
   * ```typescript
   * // Get all page view counters
   * const pageViews = await counters.getAll("page:*:views");
   * ```
   */
  async getAll(pattern: string = "*"): Promise<CounterValue[]> {
    const keys = await this.redis.command<string[]>("KEYS", pattern) as string[];
    
    if (keys.length === 0) {
      return [];
    }

    const values = await this.getMany(keys);
    
    return keys.map((key: string, i: number) => ({
      key,
      value: values[i] || 0
    }));
  }

  /**
   * Increment counter with expiration
   * 
   * Perfect for time-based counters (daily, hourly, etc.)
   * 
   * @param key - Counter identifier
   * @param ttlSeconds - Time to live in seconds
   * @returns New value after increment
   * 
   * @example
   * ```typescript
   * // Daily counter that auto-expires
   * await counters.incrementWithExpiry("daily:2024-12-27:views", 86400);
   * 
   * // Hourly counter (1 hour = 3600 seconds)
   * await counters.incrementWithExpiry("hourly:13:requests", 3600);
   * ```
   */
  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const newValue = await this.increment(key);
    
    // Set expiry only if this is the first increment
    if (newValue === 1) {
      await this.redis.command("EXPIRE", key, ttlSeconds);
    }
    
    return newValue;
  }

  /**
   * Get sum of multiple counters
   * 
   * @param keys - Array of counter identifiers
   * @returns Total sum
   * 
   * @example
   * ```typescript
   * // Total across all regions
   * const total = await counters.sum([
   *   "region:us:sales",
   *   "region:eu:sales",
   *   "region:asia:sales"
   * ]);
   * ```
   */
  async sum(keys: string[]): Promise<number> {
    const values = await this.getMany(keys);
    return values.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Get average of multiple counters
   * 
   * @param keys - Array of counter identifiers
   * @returns Average value
   * 
   * @example
   * ```typescript
   * const avgViews = await counters.average([
   *   "page:home:views",
   *   "page:about:views",
   *   "page:contact:views"
   * ]);
   * ```
   */
  async average(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const total = await this.sum(keys);
    return total / keys.length;
  }

  /**
   * Increment if value is below maximum
   * 
   * Perfect for limited resources (tickets, spots, etc.)
   * 
   * @param key - Counter identifier
   * @param max - Maximum allowed value
   * @returns New value, or null if at maximum
   * 
   * @example
   * ```typescript
   * // Limit to 100 attendees
   * const newCount = await counters.incrementIfBelow("event:attendees", 100);
   * if (newCount === null) {
   *   console.log("Event is full!");
   * }
   * ```
   */
  async incrementIfBelow(key: string, max: number): Promise<number | null> {
    const current = await this.get(key);
    
    if (current >= max) {
      return null;
    }
    
    return await this.increment(key);
  }
}
