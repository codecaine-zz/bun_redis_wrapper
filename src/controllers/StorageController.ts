/**
 * StorageController
 * 
 * Simple key-value storage with automatic JSON serialization,
 * namespacing, and bulk operations.
 * 
 * @example
 * ```typescript
 * import { StorageController } from "./controllers/StorageController.ts";
 * 
 * const storage = new StorageController(redis, "user-settings");
 * 
 * await storage.set("theme", { mode: "dark", accent: "blue" });
 * const theme = await storage.get("theme");
 * ```
 */

import type { RedisWrapper } from "../redis-wrapper.ts";

export class StorageController {
  private redis: RedisWrapper;
  private namespace: string;

  constructor(redis: RedisWrapper, namespace: string = "storage") {
    this.redis = redis;
    this.namespace = namespace;
  }

  /**
   * Store a value
   * 
   * @param key - Storage key
   * @param value - Value to store (auto JSON serialized)
   * @param ttl - Optional TTL in seconds
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const options = ttl ? { EX: ttl } : undefined;
    await this.redis.setJSON(fullKey, value, options);
  }

  /**
   * Retrieve a value
   * 
   * @param key - Storage key
   * @returns Stored value or null
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);
    return await this.redis.getJSON<T>(fullKey);
  }

  /**
   * Check if key exists
   * 
   * @param key - Storage key
   * @returns True if exists
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.getKey(key);
    const exists = await this.redis.exists(fullKey);
    return Number(exists) > 0;
  }

  /**
   * Delete a value
   * 
   * @param key - Storage key
   * @returns True if deleted
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.getKey(key);
    const deleted = await this.redis.del(fullKey);
    return deleted > 0;
  }

  /**
   * Delete multiple keys
   * 
   * @param keys - Array of storage keys
   * @returns Number of keys deleted
   */
  async deleteMany(...keys: string[]): Promise<number> {
    const fullKeys = keys.map(k => this.getKey(k));
    return await this.redis.del(...fullKeys);
  }

  /**
   * Store multiple values at once
   * 
   * @param entries - Object with key-value pairs
   * @param ttl - Optional TTL for all entries
   */
  async setMany(entries: Record<string, any>, ttl?: number): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Retrieve multiple values at once
   * 
   * @param keys - Array of storage keys
   * @returns Object with key-value pairs
   */
  async getMany<T = any>(...keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};

    for (const key of keys) {
      result[key] = await this.get<T>(key);
    }

    return result;
  }

  /**
   * Get all keys matching pattern
   * 
   * @param pattern - Key pattern (e.g., "user:*")
   * @returns Array of keys (without namespace prefix)
   */
  async keys(pattern: string = "*"): Promise<string[]> {
    const fullPattern = this.getKey(pattern);
    const keys = await this.redis.scanAll(fullPattern);

    // Remove namespace prefix
    const prefix = `${this.namespace}:`;
    return keys.map(key => key.replace(prefix, ""));
  }

  /**
   * Get all key-value pairs
   * 
   * @returns Object with all key-value pairs
   */
  async getAll<T = any>(): Promise<Record<string, T>> {
    const keys = await this.keys();
    const result: Record<string, T> = {};

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Count keys in storage
   * 
   * @param pattern - Optional pattern to match
   * @returns Number of keys
   */
  async count(pattern: string = "*"): Promise<number> {
    const keys = await this.keys(pattern);
    return keys.length;
  }

  /**
   * Clear all keys in this namespace
   * 
   * @returns Number of keys deleted
   */
  async clear(): Promise<number> {
    const fullPattern = this.getKey("*");
    const keys = await this.redis.scanAll(fullPattern);

    if (keys.length === 0) {
      return 0;
    }

    return await this.redis.del(...keys);
  }

  /**
   * Increment a numeric value
   * 
   * @param key - Storage key
   * @param amount - Amount to increment (default: 1)
   * @returns New value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const fullKey = this.getKey(key);
    
    if (amount === 1) {
      return await this.redis.incr(fullKey);
    } else {
      return await this.redis.command<number>("INCRBY", fullKey, amount);
    }
  }

  /**
   * Decrement a numeric value
   * 
   * @param key - Storage key
   * @param amount - Amount to decrement (default: 1)
   * @returns New value
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    const fullKey = this.getKey(key);
    
    if (amount === 1) {
      return await this.redis.decr(fullKey);
    } else {
      return await this.redis.command<number>("DECRBY", fullKey, amount);
    }
  }

  /**
   * Get TTL for a key
   * 
   * @param key - Storage key
   * @returns Seconds remaining or -1 if no expiry, -2 if not found
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.getKey(key);
    return await this.redis.ttl(fullKey);
  }

  /**
   * Set expiration for a key
   * 
   * @param key - Storage key
   * @param seconds - Seconds until expiration
   * @returns True if expiration was set
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const fullKey = this.getKey(key);
    const result = await this.redis.expire(fullKey, seconds);
    return result === 1;
  }

  /**
   * Remove expiration from a key
   * 
   * @param key - Storage key
   * @returns True if expiration was removed
   */
  async persist(key: string): Promise<boolean> {
    const fullKey = this.getKey(key);
    const result = await this.redis.command<number>("PERSIST", fullKey);
    return result === 1;
  }

  /**
   * Append to an array value
   * 
   * @param key - Storage key
   * @param items - Items to append
   * @returns Updated array length
   */
  async appendToArray<T = any>(key: string, ...items: T[]): Promise<number> {
    const current = await this.get<T[]>(key) || [];
    const updated = [...current, ...items];
    await this.set(key, updated);
    return updated.length;
  }

  /**
   * Remove from an array value
   * 
   * @param key - Storage key
   * @param item - Item to remove
   * @returns True if item was removed
   */
  async removeFromArray<T = any>(key: string, item: T): Promise<boolean> {
    const current = await this.get<T[]>(key);
    
    if (!current || !Array.isArray(current)) {
      return false;
    }

    const index = current.indexOf(item);
    
    if (index === -1) {
      return false;
    }

    current.splice(index, 1);
    await this.set(key, current);
    return true;
  }

  /**
   * Update nested property in an object
   * 
   * @param key - Storage key
   * @param path - Property path (e.g., "user.settings.theme")
   * @param value - New value
   */
  async updateProperty(key: string, path: string, value: any): Promise<void> {
    const current = await this.get(key) || {};
    const parts = path.split(".");
    let obj: any = current;

    // Navigate to parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;
      if (!(part in obj)) {
        obj[part] = {};
      }
      obj = obj[part];
    }

    // Set value
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      obj[lastPart] = value;
    }

    await this.set(key, current);
  }

  /**
   * Get full key with namespace
   */
  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
