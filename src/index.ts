/**
 * Redis Namespace Wrapper
 * 
 * A modular Redis wrapper with built-in namespace support for Bun.
 * Enables multiple applications to safely share a Redis instance through automatic key prefixing.
 * 
 * @example
 * ```typescript
 * import { createRedis, createNamespacedRedis } from "./index.ts";
 * 
 * await using redis = await createRedis("redis://localhost:6379");
 * 
 * const authApp = createNamespacedRedis(redis, "auth");
 * const shopApp = createNamespacedRedis(redis, "shop");
 * 
 * await authApp.set("session:123", "data");
 * await shopApp.set("session:123", "data");
 * // Stored as: "auth:session:123" and "shop:session:123"
 * ```
 */

// ============================================================================
// Exports from RedisWrapper module
// ============================================================================

export { RedisWrapper, createRedis, type SetOptions } from "./redis-wrapper";

// ============================================================================
// Imports
// ============================================================================

import type { RedisWrapper } from "./redis-wrapper";
import type { SetOptions } from "./redis-wrapper";

// ============================================================================
// NamespacedRedisWrapper - Namespace Support
// ============================================================================

/**
 * Namespaced Redis wrapper interface
 * Provides the same API as RedisWrapper but with automatic key prefixing
 */
export interface NamespacedRedisWrapper {
  // Core operations
  get(key: string): Promise<string | null>;
  set(key: string, value: string | number, options?: SetOptions): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<boolean>;
  
  // JSON operations
  getJSON<T = unknown>(key: string): Promise<T | null>;
  setJSON<T = unknown>(key: string, value: T, options?: SetOptions): Promise<unknown>;
  
  // Multi operations
  mget(...keys: string[]): Promise<(string | null)[]>;
  mset(data: Record<string, string | number>): Promise<"OK">;
  
  // Hash operations
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string | number): Promise<number>;
  hmget(key: string, ...fields: string[]): Promise<(string | null)[] | null>;
  hmset(key: string, data: Record<string, string | number>): Promise<"OK">;
  hgetAll(key: string): Promise<Record<string, string> | Record<string, never>>;
  
  // Counter operations
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  
  // TTL operations
  ttl(key: string): Promise<number>;
  setTTL(key: string, seconds: number): Promise<boolean>;
  expire(key: string, seconds: number): Promise<number>;
  
  // Pattern matching
  scanAll(pattern: string, count?: number): Promise<string[]>;
  
  // Pub/Sub
  subscribe(channel: string, callback: (message: string, channel: string) => void): Promise<() => Promise<void>>;
  publish(channel: string, message: string): Promise<number>;
  
  // List operations
  lpush(key: string, ...values: (string | number)[]): Promise<number>;
  rpush(key: string, ...values: (string | number)[]): Promise<number>;
  lrange(key: string, start?: number, stop?: number): Promise<string[]>;
  lpop(key: string): Promise<string | null>;
  rpop(key: string): Promise<string | null>;
  
  // Set operations
  sadd(key: string, ...members: (string | number)[]): Promise<number>;
  srem(key: string, ...members: (string | number)[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  
  // Sorted set operations
  zadd(key: string, ...members: [number, string | number][]): Promise<number>;
  zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]>;
  zrangebyscore(key: string, min: string | number, max: string | number, withScores?: boolean): Promise<string[]>;
  zrem(key: string, ...members: (string | number)[]): Promise<number>;
  zscore(key: string, member: string | number): Promise<string | null>;
  zrank(key: string, member: string | number): Promise<number | null>;
  zincrby(key: string, increment: number, member: string | number): Promise<string>;
  zcard(key: string): Promise<number>;
  
  // Stream operations
  xadd(key: string, id: string, fields: Record<string, string | number>): Promise<string>;
  xrange(key: string, start: string, end: string, count?: number): Promise<any[]>;
  xread(streams: Record<string, string>, count?: number, block?: number): Promise<any[]>;
  xlen(key: string): Promise<number>;
  xdel(key: string, ...ids: string[]): Promise<number>;
  
  // Geospatial operations
  geoadd(key: string, ...items: [number, number, string][]): Promise<number>;
  geodist(key: string, member1: string, member2: string, unit?: "m" | "km" | "mi" | "ft"): Promise<string | null>;
  georadius(key: string, longitude: number, latitude: number, radius: number, unit: "m" | "km" | "mi" | "ft"): Promise<string[]>;
  geopos(key: string, ...members: string[]): Promise<([string, string] | null)[]>;
  
  // HyperLogLog operations
  pfadd(key: string, ...elements: (string | number)[]): Promise<number>;
  pfcount(...keys: string[]): Promise<number>;
  pfmerge(destKey: string, ...sourceKeys: string[]): Promise<"OK">;
  
  // Generic command execution
  command<T = unknown>(cmd: string, ...args: any[]): Promise<T>;
  
  // Cleanup
  [Symbol.asyncDispose](): Promise<void>;
}

/**
 * Creates a namespaced Redis wrapper that automatically prefixes all keys
 * 
 * This allows multiple applications to safely share the same Redis instance
 * by ensuring keys from different apps never collide.
 * 
 * @param redis - The base Redis wrapper instance
 * @param namespace - The namespace prefix (e.g., "myapp", "auth", "cache")
 * @returns A namespaced Redis wrapper
 * 
 * @example
 * ```typescript
 * const redis = await createRedis("redis://localhost:6379");
 * const myAppRedis = createNamespacedRedis(redis, "myapp");
 * 
 * // Internally stores as "myapp:user:123"
 * await myAppRedis.set("user:123", "data");
 * 
 * // Pattern matching works within namespace
 * const keys = await myAppRedis.scanAll("user:*");
 * ```
 * 
 * @example Environment-based namespaces
 * ```typescript
 * const namespace = `${process.env.APP_NAME}:${process.env.NODE_ENV}`;
 * const redis = createNamespacedRedis(baseRedis, namespace);
 * // Results in: "myapp:production:" or "myapp:staging:"
 * ```
 */
export function createNamespacedRedis(
  redis: RedisWrapper,
  namespace: string
): NamespacedRedisWrapper {
  // Ensure namespace ends with colon
  const prefix = namespace.endsWith(":") ? namespace : `${namespace}:`;

  /**
   * Add namespace prefix to key
   */
  const addPrefix = (key: string): string => `${prefix}${key}`;
  
  /**
   * Remove namespace prefix from key (for results)
   */
  const removePrefix = (key: string): string => 
    key.startsWith(prefix) ? key.slice(prefix.length) : key;

  return {
    // Core Operations
    async get(key: string) {
      return redis.get(addPrefix(key));
    },

    async set(key: string, value: string | number, options?: SetOptions): Promise<string | null> {
      return redis.set(addPrefix(key), value, options) as Promise<string | null>;
    },

    async command<T = unknown>(cmd: string, ...args: any[]): Promise<T> {
      // Auto-prefix key arguments for common commands.
      // Default heuristic: prefix the first argument if it's a string.
      // Special cases: commands that take multiple keys.
      const upper = cmd.toUpperCase();

      // Commands where all provided args are keys.
      // (Used by this repo: SINTER)
      const allKeyArgs = new Set([
        "SINTER",
        "SUNION",
        "SDIFF",
        "SINTERSTORE",
        "SUNIONSTORE",
        "SDIFFSTORE"
      ]);

      if (allKeyArgs.has(upper)) {
        args = args.map((arg) => (typeof arg === "string" ? addPrefix(arg) : arg));
        return redis.command<T>(cmd, ...args);
      }

      if (args.length > 0 && typeof args[0] === "string") {
        args[0] = addPrefix(args[0]);
      }

      return redis.command<T>(cmd, ...args);
    },

    async del(...keys: string[]) {
      return redis.del(...keys.map(addPrefix));
    },

    async exists(...keys: string[]) {
      return redis.exists(...keys.map(addPrefix));
    },

    // JSON Operations
    async getJSON<T = unknown>(key: string) {
      return redis.getJSON<T>(addPrefix(key));
    },

    async setJSON<T = unknown>(key: string, value: T, options?: SetOptions) {
      return redis.setJSON(addPrefix(key), value, options);
    },

    // Multi Operations
    async mget(...keys: string[]) {
      return redis.mget(...keys.map(addPrefix));
    },

    async mset(data: Record<string, string | number>) {
      const prefixedData: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(data)) {
        prefixedData[addPrefix(key)] = value;
      }
      return redis.mset(prefixedData);
    },

    // Hash Operations
    async hget(key: string, field: string) {
      return redis.hget(addPrefix(key), field);
    },

    async hset(key: string, field: string, value: string | number) {
      return redis.hset(addPrefix(key), field, value);
    },

    async hmget(key: string, ...fields: string[]) {
      return redis.hmget(addPrefix(key), ...fields);
    },

    async hmset(key: string, data: Record<string, string | number>) {
      return redis.hmset(addPrefix(key), data);
    },

    async hgetAll(key: string) {
      return redis.hgetAll(addPrefix(key));
    },

    // Counter Operations
    async incr(key: string) {
      return redis.incr(addPrefix(key));
    },

    async decr(key: string) {
      return redis.decr(addPrefix(key));
    },

    // TTL Operations
    async ttl(key: string) {
      return redis.ttl(addPrefix(key));
    },

    async setTTL(key: string, seconds: number) {
      return redis.setTTL(addPrefix(key), seconds);
    },

    async expire(key: string, seconds: number) {
      return redis.expire(addPrefix(key), seconds);
    },

    // Pattern Matching (within namespace)
    async scanAll(pattern: string, count?: number) {
      const prefixedPattern = addPrefix(pattern);
      const keys = await redis.scanAll(prefixedPattern, count);
      // Remove prefix from returned keys so they appear namespace-relative
      return keys.map(removePrefix);
    },

    // Pub/Sub (with namespaced channels)
    async subscribe(channel: string, callback: (message: string, channel: string) => void) {
      return redis.subscribe(addPrefix(channel), callback);
    },

    async publish(channel: string, message: string) {
      return redis.publish(addPrefix(channel), message);
    },

    // List Operations
    async lpush(key: string, ...values: (string | number)[]) {
      return redis.lpush(addPrefix(key), ...values);
    },

    async rpush(key: string, ...values: (string | number)[]) {
      return redis.rpush(addPrefix(key), ...values);
    },

    async lrange(key: string, start = 0, stop = -1) {
      return redis.lrange(addPrefix(key), start, stop);
    },

    async lpop(key: string) {
      return redis.lpop(addPrefix(key));
    },

    async rpop(key: string) {
      return redis.rpop(addPrefix(key));
    },

    // Set Operations
    async sadd(key: string, ...members: (string | number)[]) {
      return redis.sadd(addPrefix(key), ...members);
    },

    async srem(key: string, ...members: (string | number)[]) {
      return redis.srem(addPrefix(key), ...members);
    },

    async smembers(key: string) {
      return redis.smembers(addPrefix(key));
    },

    // Sorted Set Operations
    async zadd(key: string, ...members: [number, string | number][]) {
      return redis.zadd(addPrefix(key), ...members);
    },

    async zrange(key: string, start: number, stop: number, withScores = false) {
      return redis.zrange(addPrefix(key), start, stop, withScores);
    },

    async zrangebyscore(key: string, min: string | number, max: string | number, withScores = false) {
      return redis.zrangebyscore(addPrefix(key), min, max, withScores);
    },

    async zrem(key: string, ...members: (string | number)[]) {
      return redis.zrem(addPrefix(key), ...members);
    },

    async zscore(key: string, member: string | number) {
      return redis.zscore(addPrefix(key), member);
    },

    async zrank(key: string, member: string | number) {
      return redis.zrank(addPrefix(key), member);
    },

    async zincrby(key: string, increment: number, member: string | number) {
      return redis.zincrby(addPrefix(key), increment, member);
    },

    async zcard(key: string) {
      return redis.zcard(addPrefix(key));
    },

    // Stream Operations
    async xadd(key: string, id: string, fields: Record<string, string | number>) {
      return redis.xadd(addPrefix(key), id, fields);
    },

    async xrange(key: string, start: string, end: string, count?: number) {
      return redis.xrange(addPrefix(key), start, end, count);
    },

    async xread(streams: Record<string, string>, count?: number, block?: number) {
      const namespacedStreams: Record<string, string> = {};
      for (const [key, id] of Object.entries(streams)) {
        namespacedStreams[addPrefix(key)] = id;
      }
      return redis.xread(namespacedStreams, count, block);
    },

    async xlen(key: string) {
      return redis.xlen(addPrefix(key));
    },

    async xdel(key: string, ...ids: string[]) {
      return redis.xdel(addPrefix(key), ...ids);
    },

    // Geospatial Operations
    async geoadd(key: string, ...items: [number, number, string][]) {
      return redis.geoadd(addPrefix(key), ...items);
    },

    async geodist(key: string, member1: string, member2: string, unit: "m" | "km" | "mi" | "ft" = "m") {
      return redis.geodist(addPrefix(key), member1, member2, unit);
    },

    async georadius(key: string, longitude: number, latitude: number, radius: number, unit: "m" | "km" | "mi" | "ft") {
      return redis.georadius(addPrefix(key), longitude, latitude, radius, unit);
    },

    async geopos(key: string, ...members: string[]) {
      return redis.geopos(addPrefix(key), ...members);
    },

    // HyperLogLog Operations
    async pfadd(key: string, ...elements: (string | number)[]) {
      return redis.pfadd(addPrefix(key), ...elements);
    },

    async pfcount(...keys: string[]) {
      return redis.pfcount(...keys.map(addPrefix));
    },

    async pfmerge(destKey: string, ...sourceKeys: string[]) {
      return redis.pfmerge(addPrefix(destKey), ...sourceKeys.map(addPrefix));
    },

    // Cleanup
    async [Symbol.asyncDispose]() {
      // Don't dispose the underlying Redis connection
      // as it might be shared across multiple namespaces
      // The base Redis wrapper will handle cleanup
    }
  };
}

// ============================================================================
// Namespace Helper Functions
// ============================================================================

export interface CopyNamespaceOptions {
  /** Pattern within the source namespace (default: "*") */
  match?: string;
  /** SCAN COUNT hint (default: 100) */
  count?: number;
  /** Overwrite destination keys if they already exist (default: false) */
  replace?: boolean;
  /** If true, don't write anything; only report what would happen (default: false) */
  dryRun?: boolean;
}

export interface CopyNamespaceResult {
  /** Number of keys seen via SCAN */
  scanned: number;
  /** Number of keys written to destination namespace */
  copied: number;
  /** Number of keys skipped (e.g., destination existed and replace=false) */
  skipped: number;
}

/**
 * Copy all keys from one namespace to another.
 *
 * This is useful for promoting data between environment namespaces
 * like `dev -> staging -> prod` when environments share a Redis instance.
 *
 * Implementation details:
 * - Uses `SCAN` to enumerate keys in the source namespace.
 * - Uses `DUMP` + `RESTORE` to preserve key type and TTL.
 *
 * @param redis - The base Redis wrapper instance
 * @param fromNamespace - Source namespace
 * @param toNamespace - Destination namespace
 * @param options - Copy behavior options
 */
export async function copyNamespace(
  redis: RedisWrapper,
  fromNamespace: string,
  toNamespace: string,
  options: CopyNamespaceOptions = {}
): Promise<CopyNamespaceResult> {
  const fromPrefix = fromNamespace.endsWith(":") ? fromNamespace : `${fromNamespace}:`;
  const toPrefix = toNamespace.endsWith(":") ? toNamespace : `${toNamespace}:`;

  if (fromPrefix === toPrefix) {
    throw new Error("fromNamespace and toNamespace must be different");
  }

  const match = options.match ?? "*";
  const scanCount = options.count ?? 100;
  const replace = options.replace ?? false;
  const dryRun = options.dryRun ?? false;

  const pattern = `${fromPrefix}${match}`;

  const result: CopyNamespaceResult = {
    scanned: 0,
    copied: 0,
    skipped: 0
  };

  let cursor = "0";

  do {
    const scan = await redis.command<[string, string[]]>(
      "SCAN",
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      scanCount
    );

    cursor = scan[0];
    const keys = scan[1];

    for (const sourceKey of keys) {
      // Defensive: SCAN MATCH should ensure prefix, but keep it safe.
      if (!sourceKey.startsWith(fromPrefix)) continue;

      result.scanned++;

      const relativeKey = sourceKey.slice(fromPrefix.length);
      const destKey = `${toPrefix}${relativeKey}`;

      if (!replace) {
        const exists = await redis.command<number>("EXISTS", destKey);
        if (exists === 1) {
          result.skipped++;
          continue;
        }
      }

      if (dryRun) {
        result.copied++;
        continue;
      }

      // Server-side copy avoids binary DUMP payload issues in some clients.
      // TTL is explicitly synced to ensure consistent behavior.
      const pttl = await redis.command<number>("PTTL", sourceKey);

      const copyArgs: any[] = [sourceKey, destKey];
      if (replace) copyArgs.push("REPLACE");

      const didCopy = await redis.command<number>("COPY", ...copyArgs);
      if (didCopy !== 1) {
        result.skipped++;
        continue;
      }

      if (pttl > 0) {
        await redis.command<number>("PEXPIRE", destKey, pttl);
      } else if (pttl === -1) {
        // Ensure destination is persistent if source is persistent.
        await redis.command<number>("PERSIST", destKey);
      }

      result.copied++;
    }
  } while (cursor !== "0");

  return result;
}

/**
 * Helper function to clear all keys in a namespace
 * 
 * @param redis - The base Redis wrapper instance
 * @param namespace - The namespace to clear
 * @returns Number of keys deleted
 * 
 * @example
 * ```typescript
 * const redis = await createRedis("redis://localhost:6379");
 * 
 * // Clear all keys in the "myapp" namespace
 * const deleted = await clearNamespace(redis, "myapp");
 * console.log(`Deleted ${deleted} keys from myapp namespace`);
 * ```
 */
export async function clearNamespace(
  redis: RedisWrapper,
  namespace: string
): Promise<number> {
  const prefix = namespace.endsWith(":") ? namespace : `${namespace}:`;
  const pattern = `${prefix}*`;
  const keys = await redis.scanAll(pattern);
  
  if (keys.length > 0) {
    return await redis.del(...keys);
  }
  
  return 0;
}