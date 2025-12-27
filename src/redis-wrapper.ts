/**
 * Redis Wrapper
 * 
 * Core Redis wrapper class using Bun's RedisClient.
 * Provides a clean API for all common Redis operations.
 */

import { RedisClient } from "bun";

type Key = string;

/**
 * Options for the SET command
 */
export interface SetOptions {
  /** Set expiration in seconds */
  EX?: number;
  /** Set expiration in milliseconds */
  PX?: number;
  /** Only set if key doesn't exist */
  NX?: boolean;
  /** Only set if key exists */
  XX?: boolean;
  /** Keep existing TTL */
  KEEPTTL?: boolean;
}

/**
 * A wrapper class for Redis operations using Bun's RedisClient
 */
export class RedisWrapper {
  private client: RedisClient;
  private url: string;

  private constructor(client: RedisClient, url: string) {
    this.client = client;
    this.url = url;
  }

  /**
   * Connect to a Redis server
   * @param url - Redis connection URL (default: "redis://localhost:6379")
   * @returns A connected RedisWrapper instance
   */
  static async connect(url?: string): Promise<RedisWrapper> {
    const connectionUrl = url || "redis://localhost:6379";
    const client = new RedisClient(connectionUrl);
    // Note: RedisClient auto-connects, no explicit connect() needed
    return new RedisWrapper(client, connectionUrl);
  }

  /**
   * Execute a generic Redis command
   * @param cmd - The Redis command to execute
   * @param args - Command arguments
   * @returns The command result
   */
  async command<T = unknown>(cmd: string, ...args: any[]): Promise<T> {
    return this.client.send(cmd, args) as Promise<T>;
  }

  /**
   * Get the value of a key
   * @param key - The key to retrieve
   * @returns The value or null if key doesn't exist
   */
  async get(key: Key) {
    return this.client.get(key);
  }

  /**
   * Set the string value of a key
   * @param key - The key to set
   * @param value - The value to set
   * @param opts - Optional SET command options (EX, PX, NX, XX, KEEPTTL)
   * @returns OK if successful
   */
  async set(key: Key, value: string | number, opts?: SetOptions) {
    if (!opts) return this.client.set(key, String(value));
    
    const args: any[] = [key, String(value)];
    if (opts.EX !== undefined) args.push("EX", opts.EX);
    if (opts.PX !== undefined) args.push("PX", opts.PX);
    if (opts.NX) args.push("NX");
    if (opts.XX) args.push("XX");
    if (opts.KEEPTTL) args.push("KEEPTTL");
    
    return this.command("SET", ...args);
  }

  /**
   * Get and parse a JSON value from a key
   * Type-safe JSON retrieval with proper error handling
   * @param key - The key to retrieve
   * @returns Parsed JSON object or null if key doesn't exist or parsing fails
   */
  async getJSON<T = unknown>(key: Key): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a JSON value for a key
   * Type-safe JSON storage
   * @param key - The key to set
   * @param obj - The object to stringify and store
   * @param opts - Optional SET command options
   * @returns OK if successful
   */
  async setJSON<T = unknown>(key: Key, obj: T, opts?: SetOptions): Promise<unknown> {
    return this.set(key, JSON.stringify(obj), opts);
  }

  /**
   * Delete one or more keys
   * @param keys - The keys to delete
   * @returns The number of keys that were removed
   */
  async del(...keys: Key[]) {
    if (keys.length === 0) return 0;
    return this.command<number>("DEL", ...keys);
  }

  /**
   * Check if one or more keys exist
   * @param keys - The keys to check
   * @returns True if all keys exist, false otherwise
   */
  async exists(...keys: Key[]) {
    if (keys.length === 0) return false;
    const count = await this.command<number>("EXISTS", ...keys);
    return count === keys.length;
  }

  /**
   * Get multiple values by keys
   * @param keys - The keys to retrieve
   * @returns Array of values or null for non-existent keys
   */
  async mget(...keys: Key[]) {
    if (keys.length === 0) return [];
    return this.command<(string | null)[]>("MGET", ...keys);
  }

  /**
   * Set multiple key-value pairs
   * @param data - Object mapping keys to values
   * @returns OK if successful
   */
  async mset(data: Record<string, string | number>) {
    const args: (string | number)[] = [];
    for (const [key, value] of Object.entries(data)) {
      args.push(key, String(value));
    }
    return this.command<"OK">("MSET", ...args);
  }

  /**
   * Get hash field value
   * @param key - The hash key
   * @param field - The field name
   * @returns The field value or null
   */
  async hget(key: Key, field: string) {
    return this.command<string | null>("HGET", key, field);
  }

  /**
   * Set hash field value
   * @param key - The hash key
   * @param field - The field name
   * @param value - The field value
   * @returns 1 if new field, 0 if updated
   */
  async hset(key: Key, field: string, value: string | number) {
    return this.command<number>("HSET", key, field, String(value));
  }

  /**
   * Get multiple hash field values
   * @param key - The hash key
   * @param fields - The field names
   * @returns Array of field values or null
   */
  async hmget(key: Key, ...fields: string[]) {
    if (fields.length === 0) return null;
    return this.command<(string | null)[] | null>("HMGET", key, ...fields);
  }

  /**
   * Set multiple hash field values
   * @param key - The hash key
   * @param data - Object mapping field names to values
   * @returns OK if successful
   */
  async hmset(key: Key, data: Record<string, string | number>) {
    const args: (string | number)[] = [key];
    for (const [field, value] of Object.entries(data)) {
      args.push(field, String(value));
    }
    return this.command<"OK">("HMSET", ...args);
  }

  /**
   * Get all hash fields and values
   * @param key - The hash key
   * @returns Object mapping fields to values
   */
  async hgetAll(key: Key) {
    return this.command<Record<string, string> | Record<string, never>>("HGETALL", key);
  }

  /**
   * Increment a key's value by 1
   * @param key - The key to increment
   * @returns The new value after increment
   */
  async incr(key: Key) {
    return this.command<number>("INCR", key);
  }

  /**
   * Decrement a key's value by 1
   * @param key - The key to decrement
   * @returns The new value after decrement
   */
  async decr(key: Key) {
    return this.command<number>("DECR", key);
  }

  /**
   * Get remaining time to live in seconds
   * @param key - The key to check
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key: Key) {
    return this.command<number>("TTL", key);
  }

  /**
   * Set TTL on an existing key
   * @param key - The key to set TTL on
   * @param seconds - Expiration time in seconds
   * @returns True if TTL was set, false otherwise
   */
  async setTTL(key: Key, seconds: number) {
    const result = await this.command<number>("EXPIRE", key, seconds);
    return result === 1;
  }

  /**
   * Set key expiration
   * @param key - The key to expire
   * @param seconds - Expiration time in seconds
   * @returns 1 if set, 0 if key doesn't exist
   */
  async expire(key: Key, seconds: number) {
    return this.command<number>("EXPIRE", key, seconds);
  }

  /**
   * Scan for keys matching a pattern
   * @param pattern - Pattern to match (e.g., "user:*")
   * @param count - Number of keys to scan per iteration
   * @returns Array of matching keys
   */
  async scanAll(pattern: string, count: number = 100): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";
    
    do {
      const result = await this.command<[string, string[]]>(
        "SCAN", 
        cursor, 
        "MATCH", 
        pattern, 
        "COUNT", 
        count
      );
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");
    
    return keys;
  }

  /**
   * Subscribe to a channel
   * @param channel - Channel name
   * @param callback - Function to call when message received
   * @returns Unsubscribe function
   */
  async subscribe(channel: string, callback: (message: string, channel: string) => void) {
    await this.command("SUBSCRIBE", channel);
    // Note: Bun's RedisClient pub/sub implementation would need event handling
    // This is a simplified version
    return async () => {
      await this.command("UNSUBSCRIBE", channel);
    };
  }

  /**
   * Publish message to channel
   * @param channel - Channel name
   * @param message - Message to publish
   * @returns Number of subscribers that received the message
   */
  async publish(channel: string, message: string) {
    return this.command<number>("PUBLISH", channel, message);
  }

  /**
   * Push values to the left of a list
   * @param list - The list key
   * @param values - Values to push
   * @returns Length of list after push
   */
  async lpush(list: Key, ...values: (string | number)[]) {
    return this.command<number>("LPUSH", list, ...values.map(String));
  }

  /**
   * Push values to the right of a list
   * @param list - The list key
   * @param values - Values to push
   * @returns Length of list after push
   */
  async rpush(list: Key, ...values: (string | number)[]) {
    return this.command<number>("RPUSH", list, ...values.map(String));
  }

  /**
   * Get a range of elements from a list
   * @param list - The list key
   * @param start - Start index (default: 0)
   * @param stop - Stop index (default: -1 for end of list)
   * @returns Array of elements in the specified range
   */
  async lrange(list: Key, start = 0, stop = -1) {
    return this.command<string[]>("LRANGE", list, start, stop);
  }

  /**
   * Remove and return the first element of a list
   * @param list - The list key
   * @returns The first element or null if list is empty
   */
  async lpop(list: Key) {
    return this.command<string | null>("LPOP", list);
  }

  /**
   * Remove and return the last element of a list
   * @param list - The list key
   * @returns The last element or null if list is empty
   */
  async rpop(list: Key) {
    return this.command<string | null>("RPOP", list);
  }

  /**
   * Add one or more members to a set
   * @param key - The set key
   * @param members - Members to add
   * @returns Number of elements added
   */
  async sadd(key: Key, ...members: (string | number)[]) {
    return this.command<number>("SADD", key, ...members.map(String));
  }

  /**
   * Remove one or more members from a set
   * @param key - The set key
   * @param members - Members to remove
   * @returns Number of elements removed
   */
  async srem(key: Key, ...members: (string | number)[]) {
    return this.command<number>("SREM", key, ...members.map(String));
  }

  /**
   * Get all members of a set
   * @param key - The set key
   * @returns Array of set members
   */
  async smembers(key: Key) {
    return this.command<string[]>("SMEMBERS", key);
  }

  // ==================== Sorted Sets Commands ====================

  /**
   * Add one or more members to a sorted set with scores
   * @param key - The sorted set key
   * @param members - Array of [score, member] pairs
   * @returns Number of elements added
   */
  async zadd(key: Key, ...members: [number, string | number][]) {
    const args: (string | number)[] = [key];
    for (const [score, member] of members) {
      args.push(score, String(member));
    }
    return this.command<number>("ZADD", ...args);
  }

  /**
   * Get members in a sorted set by score range
   * @param key - The sorted set key
   * @param min - Minimum score (can use "-inf" for negative infinity)
   * @param max - Maximum score (can use "+inf" for positive infinity)
   * @param withScores - Include scores in result
   * @returns Array of members or [member, score] pairs
   */
  async zrangebyscore(key: Key, min: string | number, max: string | number, withScores = false) {
    const args: (string | number)[] = [key, min, max];
    if (withScores) args.push("WITHSCORES");
    return this.command<string[]>("ZRANGEBYSCORE", ...args);
  }

  /**
   * Get members in a sorted set by index range
   * @param key - The sorted set key
   * @param start - Start index
   * @param stop - Stop index
   * @param withScores - Include scores in result
   * @returns Array of members or [member, score] pairs
   */
  async zrange(key: Key, start: number, stop: number, withScores = false) {
    const args: (string | number)[] = [key, start, stop];
    if (withScores) args.push("WITHSCORES");
    return this.command<string[]>("ZRANGE", ...args);
  }

  /**
   * Remove one or more members from a sorted set
   * @param key - The sorted set key
   * @param members - Members to remove
   * @returns Number of elements removed
   */
  async zrem(key: Key, ...members: (string | number)[]) {
    return this.command<number>("ZREM", key, ...members.map(String));
  }

  /**
   * Get the score of a member in a sorted set
   * @param key - The sorted set key
   * @param member - The member to get score for
   * @returns The score or null if member doesn't exist
   */
  async zscore(key: Key, member: string | number) {
    return this.command<string | null>("ZSCORE", key, String(member));
  }

  /**
   * Get the rank of a member in a sorted set (ascending order)
   * @param key - The sorted set key
   * @param member - The member to get rank for
   * @returns The rank or null if member doesn't exist
   */
  async zrank(key: Key, member: string | number) {
    return this.command<number | null>("ZRANK", key, String(member));
  }

  /**
   * Increment the score of a member in a sorted set
   * @param key - The sorted set key
   * @param increment - The increment value
   * @param member - The member to increment
   * @returns The new score
   */
  async zincrby(key: Key, increment: number, member: string | number) {
    return this.command<string>("ZINCRBY", key, increment, String(member));
  }

  /**
   * Get the number of members in a sorted set
   * @param key - The sorted set key
   * @returns The number of members
   */
  async zcard(key: Key) {
    return this.command<number>("ZCARD", key);
  }

  // ==================== Streams Commands ====================

  /**
   * Add an entry to a stream
   * @param key - The stream key
   * @param id - Entry ID (use "*" for auto-generation)
   * @param fields - Object mapping field names to values
   * @returns The entry ID
   */
  async xadd(key: Key, id: string, fields: Record<string, string | number>) {
    const args: (string | number)[] = [key, id];
    for (const [field, value] of Object.entries(fields)) {
      args.push(field, String(value));
    }
    return this.command<string>("XADD", ...args);
  }

  /**
   * Read entries from a stream
   * @param key - The stream key
   * @param start - Start ID
   * @param end - End ID
   * @param count - Maximum number of entries to return
   * @returns Array of stream entries
   */
  async xrange(key: Key, start: string, end: string, count?: number) {
    const args: (string | number)[] = [key, start, end];
    if (count !== undefined) {
      args.push("COUNT", count);
    }
    return this.command<any[]>("XRANGE", ...args);
  }

  /**
   * Read entries from streams (blocking or non-blocking)
   * @param streams - Object mapping stream keys to IDs
   * @param count - Maximum number of entries per stream
   * @param block - Block for specified milliseconds (0 = forever)
   * @returns Array of [stream, entries] pairs
   */
  async xread(streams: Record<string, string>, count?: number, block?: number) {
    const args: (string | number)[] = [];
    if (count !== undefined) {
      args.push("COUNT", count);
    }
    if (block !== undefined) {
      args.push("BLOCK", block);
    }
    args.push("STREAMS");
    const keys = Object.keys(streams);
    const ids = Object.values(streams);
    args.push(...keys, ...ids);
    return this.command<any[]>("XREAD", ...args);
  }

  /**
   * Get the length of a stream
   * @param key - The stream key
   * @returns The number of entries in the stream
   */
  async xlen(key: Key) {
    return this.command<number>("XLEN", key);
  }

  /**
   * Delete entries from a stream
   * @param key - The stream key
   * @param ids - Entry IDs to delete
   * @returns Number of entries deleted
   */
  async xdel(key: Key, ...ids: string[]) {
    return this.command<number>("XDEL", key, ...ids);
  }

  // ==================== Geospatial Commands ====================

  /**
   * Add geospatial items (longitude, latitude, member)
   * @param key - The geo key
   * @param items - Array of [longitude, latitude, member] tuples
   * @returns Number of elements added
   */
  async geoadd(key: Key, ...items: [number, number, string][]) {
    const args: (string | number)[] = [key];
    for (const [longitude, latitude, member] of items) {
      args.push(longitude, latitude, member);
    }
    return this.command<number>("GEOADD", ...args);
  }

  /**
   * Get the distance between two members in a geospatial index
   * @param key - The geo key
   * @param member1 - First member
   * @param member2 - Second member
   * @param unit - Unit of distance (m, km, mi, ft)
   * @returns The distance
   */
  async geodist(key: Key, member1: string, member2: string, unit: "m" | "km" | "mi" | "ft" = "m") {
    return this.command<string | null>("GEODIST", key, member1, member2, unit);
  }

  /**
   * Get geospatial members within a radius
   * @param key - The geo key
   * @param longitude - Center longitude
   * @param latitude - Center latitude
   * @param radius - Search radius
   * @param unit - Unit of radius (m, km, mi, ft)
   * @returns Array of members within radius
   */
  async georadius(key: Key, longitude: number, latitude: number, radius: number, unit: "m" | "km" | "mi" | "ft") {
    return this.command<string[]>("GEORADIUS", key, longitude, latitude, radius, unit);
  }

  /**
   * Get positions (longitude, latitude) of members
   * @param key - The geo key
   * @param members - Members to get positions for
   * @returns Array of [longitude, latitude] pairs or null
   */
  async geopos(key: Key, ...members: string[]) {
    return this.command<([string, string] | null)[]>("GEOPOS", key, ...members);
  }

  // ==================== HyperLogLog Commands ====================

  /**
   * Add elements to a HyperLogLog
   * @param key - The HyperLogLog key
   * @param elements - Elements to add
   * @returns 1 if modified, 0 if not
   */
  async pfadd(key: Key, ...elements: (string | number)[]) {
    return this.command<number>("PFADD", key, ...elements.map(String));
  }

  /**
   * Get the cardinality (count) of a HyperLogLog
   * @param keys - One or more HyperLogLog keys
   * @returns Approximate cardinality
   */
  async pfcount(...keys: Key[]) {
    return this.command<number>("PFCOUNT", ...keys);
  }

  /**
   * Merge multiple HyperLogLogs into one
   * @param destKey - Destination key
   * @param sourceKeys - Source keys to merge
   * @returns OK if successful
   */
  async pfmerge(destKey: Key, ...sourceKeys: Key[]) {
    return this.command<"OK">("PFMERGE", destKey, ...sourceKeys);
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    this.client.close();
  }

  /**
   * Support for async dispose pattern (await using ... syntax)
   * Automatically closes connection when wrapper goes out of scope
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}

/**
 * Factory function to create a Redis wrapper instance
 * @param url - Redis connection URL (default: "redis://localhost:6379")
 * @returns A connected RedisWrapper instance
 * 
 * @example
 * ```typescript
 * await using redis = await createRedis();
 * await redis.set("key", "value");
 * ```
 */
export async function createRedis(url?: string): Promise<RedisWrapper> {
  return await RedisWrapper.connect(url);
}
