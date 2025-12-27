/**
 * CacheController
 * 
 * Intelligent caching layer with automatic cache-aside pattern,
 * TTL management, and cache statistics.
 * 
 * @example
 * ```typescript
 * import { CacheController } from "./controllers/CacheController.ts";
 * 
 * const cache = new CacheController(redis);
 * const user = await cache.getOrSet("user:123", () => db.getUser(123), 300);
 * ```
 */

import { RedisWrapper } from "../redis-wrapper";
import { createNamespacedRedis, type NamespacedRedisWrapper } from "../index";

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
}

export interface CacheOptions {
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttl?: number;
  /** Namespace prefix for keys */
  namespace?: string;
}

export class CacheController {
  private redis: NamespacedRedisWrapper;
  private statsKey = "stats";

  constructor(redis: RedisWrapper | NamespacedRedisWrapper, namespace: string = "cache") {
    this.redis = redis instanceof RedisWrapper
      ? createNamespacedRedis(redis, namespace)
      : redis;
  }

  /**
   * Get cached value or set it using a loader function
   * (Cache-Aside Pattern)
   * 
   * @param key - Cache key
   * @param loader - Function to load data on cache miss
   * @param ttl - Time to live in seconds
   * @returns Cached or loaded value
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.redis.getJSON<T>(key);

    if (cached !== null) {
      await this.incrementHits();
      return cached;
    }

    // Cache miss - load data
    await this.incrementMisses();
    const data = await loader();

    // Store in cache
    await this.redis.setJSON(key, data, { EX: ttl });

    return data;
  }

  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.getJSON<T>(key);

    if (value !== null) {
      await this.incrementHits();
    } else {
      await this.incrementMisses();
    }

    return value;
  }

  /**
   * Set value in cache
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    await this.redis.setJSON(key, value, { EX: ttl });
  }

  /**
   * Delete cached value
   * 
   * @param key - Cache key
   * @returns True if deleted
   */
  async delete(key: string): Promise<boolean> {
    const deleted = await this.redis.del(key);
    return deleted > 0;
  }

  /**
   * Delete multiple keys matching pattern
   * 
   * @param pattern - Key pattern (e.g., "user:*")
   * @returns Number of keys deleted
   */
  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.redis.scanAll(pattern);

    if (keys.length === 0) {
      return 0;
    }

    return await this.redis.del(...keys);
  }

  /**
   * Check if key exists in cache
   * 
   * @param key - Cache key
   * @returns True if exists
   */
  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return Number(exists) > 0;
  }

  /**
   * Get remaining TTL for a key
   * 
   * @param key - Cache key
   * @returns Seconds remaining or -1 if no expiry, -2 if not found
   */
  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  /**
   * Update TTL for a key
   * 
   * @param key - Cache key
   * @param ttl - New TTL in seconds
   * @returns True if updated
   */
  async updateTTL(key: string, ttl: number): Promise<boolean> {
    const result = await this.redis.expire(key, ttl);
    return result === 1;
  }

  /**
   * Warm cache with multiple values
   * 
   * @param entries - Array of [key, value, ttl] tuples
   */
  async warm(entries: Array<[string, any, number?]>): Promise<void> {
    for (const [key, value, ttl = 300] of entries) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const hits = parseInt(await this.redis.get(`${this.statsKey}:hits`) || "0");
    const misses = parseInt(await this.redis.get(`${this.statsKey}:misses`) || "0");
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;

    // Count keys in namespace
    const keys = await this.redis.scanAll("*");
    const totalKeys = keys.length;

    return {
      hits,
      misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalKeys
    };
  }

  /**
   * Reset cache statistics
   */
  async resetStats(): Promise<void> {
    await this.redis.del(`${this.statsKey}:hits`, `${this.statsKey}:misses`);
  }

  /**
   * Clear all cache in this namespace
   * 
   * @returns Number of keys deleted
   */
  async clear(): Promise<number> {
    const keys = await this.redis.scanAll("*");

    if (keys.length === 0) {
      return 0;
    }

    return await this.redis.del(...keys);
  }

  /**
   * Get all keys in cache
   * 
   * @returns Array of keys (without namespace prefix)
   */
  async keys(pattern: string = "*"): Promise<string[]> {
    return await this.redis.scanAll(pattern);
  }

  /**
   * Get cache size (number of keys)
   * 
   * @returns Number of keys in cache
   */
  async size(): Promise<number> {
    const keys = await this.redis.scanAll("*");
    return keys.length;
  }

  /**
   * Increment cache hit counter
   */
  private async incrementHits(): Promise<void> {
    await this.redis.incr(`${this.statsKey}:hits`);
  }

  /**
   * Increment cache miss counter
   */
  private async incrementMisses(): Promise<void> {
    await this.redis.incr(`${this.statsKey}:misses`);
  }

}
