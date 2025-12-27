import { RedisWrapper } from "../redis-wrapper";
import { createNamespacedRedis, type NamespacedRedisWrapper } from "../index";

/**
 * RadAppController (Rapid Application Development)
 * 
 * A high-level controller designed for building single applications quickly
 * by providing a namespace-scoped environment with simplified data access patterns.
 * 
 * Features:
 * - Automatic namespacing (e.g., "myapp:users:123")
 * - Entity/Document storage (JSON)
 * - Simple State management (Key-Value)
 * - Feeds/Lists
 * - Atomic Counters
 * - Search/Scan within namespace
 */
export class RadAppController {
  private redis: NamespacedRedisWrapper;

  /**
   * @param redis Connected RedisWrapper instance
   * @param namespace The application namespace (e.g., "todo-app", "inventory-system")
   */
  constructor(redis: RedisWrapper | NamespacedRedisWrapper, namespace: string) {
    this.redis = redis instanceof RedisWrapper
      ? createNamespacedRedis(redis, namespace)
      : redis;
  }

  /**
   * Generates a fully qualified key with the namespace
   */
  private k(key: string): string {
    return key;
  }

  /**
   * Save a JSON entity to a collection
   * Key format: namespace:collection:id
   * 
   * @param collection Name of the collection (e.g., "users", "products")
   * @param id Unique ID for the entity
   * @param data The object to save
   * @param ttlSeconds Optional expiration in seconds
   */
  async saveEntity<T extends object>(collection: string, id: string, data: T, ttlSeconds?: number): Promise<void> {
    const key = this.k(`${collection}:${id}`);
    const options = ttlSeconds ? { EX: ttlSeconds } : undefined;
    await this.redis.setJSON(key, data, options);
    
    // Add to collection index for easier listing
    const indexKey = this.k(`index:${collection}`);
    await this.redis.sadd(indexKey, id);
  }

  /**
   * Retrieve a JSON entity
   */
  async getEntity<T>(collection: string, id: string): Promise<T | null> {
    const key = this.k(`${collection}:${id}`);
    return await this.redis.getJSON<T>(key);
  }

  /**
   * Delete an entity
   */
  async deleteEntity(collection: string, id: string): Promise<void> {
    const key = this.k(`${collection}:${id}`);
    await this.redis.del(key);
    
    // Remove from index
    const indexKey = this.k(`index:${collection}`);
    await this.redis.srem(indexKey, id);
  }

  /**
   * List all IDs in a collection
   */
  async listEntityIds(collection: string): Promise<string[]> {
    const indexKey = this.k(`index:${collection}`);
    return await this.redis.smembers(indexKey);
  }

  /**
   * List all full entities in a collection
   * Warning: Use with caution on large collections
   */
  async listEntities<T>(collection: string): Promise<T[]> {
    const ids = await this.listEntityIds(collection);
    if (ids.length === 0) return [];

    const keys = ids.map(id => this.k(`${collection}:${id}`));
    // RedisWrapper doesn't have mgetJSON, so we do parallel gets
    // In a real RAD tool, we might want to optimize this, but for prototyping it's fine.
    const promises = keys.map(key => this.redis.getJSON<T>(key));
    const results = await Promise.all(promises);
    return results.filter((item) => item !== null) as T[];
  }

  /**
   * Set a simple global state value for the app
   * Key format: namespace:state:key
   */
  async setState(key: string, value: any): Promise<void> {
    const fullKey = this.k(`state:${key}`);
    await this.redis.setJSON(fullKey, value);
  }

  /**
   * Get a simple global state value
   */
  async getState<T>(key: string): Promise<T | null> {
    const fullKey = this.k(`state:${key}`);
    return await this.redis.getJSON<T>(fullKey);
  }

  /**
   * Add an item to a list/feed (append to end)
   * Key format: namespace:feed:name
   */
  async pushToFeed(feedName: string, item: any): Promise<number> {
    const key = this.k(`feed:${feedName}`);
    const serialized = JSON.stringify(item);
    return await this.redis.rpush(key, serialized);
  }

  /**
   * Get recent items from a feed
   * @param count Number of items to retrieve (default 10)
   */
  async getRecentFeedItems<T>(feedName: string, count: number = 10): Promise<T[]> {
    const key = this.k(`feed:${feedName}`);
    // lrange is inclusive, so 0 to count-1
    const items = await this.redis.lrange(key, 0, count - 1);
    return items.map(item => JSON.parse(item));
  }

  /**
   * Increment a named counter
   * Key format: namespace:counter:name
   */
  async incrementCounter(counterName: string, by: number = 1): Promise<number> {
    const key = this.k(`counter:${counterName}`);
    if (by === 1) {
      return await this.redis.incr(key);
    }
    return await this.redis.command<number>("INCRBY", key, by);
  }

  /**
   * Get current counter value
   */
  async getCounter(counterName: string): Promise<number> {
    const key = this.k(`counter:${counterName}`);
    const val = await this.redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Delete all data associated with this application namespace
   * Useful for resetting state during development
   */
  async nukeApp(): Promise<void> {
    const keys = await this.redis.scanAll("*");
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
