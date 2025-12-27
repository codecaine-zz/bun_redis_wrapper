# Redis Wrapper API Documentation

Complete API reference for the Bun Redis Namespace Wrapper.

## Table of Contents

- [Installation](#installation)
- [Factory Functions](#factory-functions)
- [RedisWrapper Class](#rediswrapper-class)
- [NamespacedRedisWrapper Interface](#namespacedrediswrapper-interface)
- [Types](#types)
- [Core Operations](#core-operations)
- [JSON Operations](#json-operations)
- [Multi Operations](#multi-operations)
- [Hash Operations](#hash-operations)
- [Counter Operations](#counter-operations)
- [TTL Operations](#ttl-operations)
- [Pattern Matching](#pattern-matching)
- [Pub/Sub Operations](#pubsub-operations)
- [List Operations](#list-operations)
- [Set Operations](#set-operations)
- [Cleanup Operations](#cleanup-operations)

---

## Installation

```typescript
// Import from main entry point (recommended)
import { 
  createRedis, 
  createNamespacedRedis, 
  clearNamespace,
  RedisWrapper,
  type NamespacedRedisWrapper,
  type SetOptions
} from "./index.ts";

// Or import core wrapper directly
import { RedisWrapper, createRedis, type SetOptions } from "./redis-wrapper.ts";
```

---

## Factory Functions

### `createRedis(url?: string): Promise<RedisWrapper>`

Creates and connects to a Redis server.

**Parameters:**
- `url` (optional): Redis connection URL. Default: `"redis://localhost:6379"`

**Returns:** `Promise<RedisWrapper>` - Connected Redis wrapper instance

**Example:**
```typescript
// Default connection
await using redis = await createRedis();

// Custom connection
await using redis = await createRedis("redis://user:pass@host:6380/0");
```

---

### `createNamespacedRedis(redis: RedisWrapper, namespace: string): NamespacedRedisWrapper`

Creates a namespaced wrapper that automatically prefixes all keys.

**Parameters:**
- `redis`: Base Redis wrapper instance
- `namespace`: Namespace prefix (e.g., "myapp", "auth:v1")

**Returns:** `NamespacedRedisWrapper` - Namespaced wrapper

**Example:**
```typescript
await using redis = await createRedis();

const authApp = createNamespacedRedis(redis, "auth");
const shopApp = createNamespacedRedis(redis, "shop");

// Keys stored as "auth:user:123" and "shop:user:123"
await authApp.set("user:123", "data");
await shopApp.set("user:123", "data");
```

**Notes:**
- Trailing colons are automatically handled
- Namespace prefixes are transparent to the caller
- Pattern matching is scoped to the namespace

---

### `clearNamespace(redis: RedisWrapper, namespace: string): Promise<number>`

Deletes all keys in a namespace.

**Parameters:**
- `redis`: Base Redis wrapper instance
- `namespace`: Namespace to clear

**Returns:** `Promise<number>` - Number of keys deleted

**Example:**
```typescript
const deleted = await clearNamespace(redis, "test");
console.log(`Deleted ${deleted} keys`);
```

**Warning:** This operation scans and deletes all matching keys. Use carefully in production.

---

## RedisWrapper Class

The base Redis wrapper class. All methods are available on both `RedisWrapper` and `NamespacedRedisWrapper`.

### Static Methods

#### `RedisWrapper.connect(url?: string): Promise<RedisWrapper>`

Static factory method to create a connection.

**Example:**
```typescript
const redis = await RedisWrapper.connect("redis://localhost:6379");
```

---

## Types

### `SetOptions`

Options for SET command.

```typescript
interface SetOptions {
  EX?: number;      // Expire time in seconds
  PX?: number;      // Expire time in milliseconds
  NX?: boolean;     // Only set if key doesn't exist
  XX?: boolean;     // Only set if key exists
  KEEPTTL?: boolean; // Retain existing TTL
}
```

**Example:**
```typescript
// Set with 1 hour expiration
await redis.set("key", "value", { EX: 3600 });

// Set only if doesn't exist
await redis.set("key", "value", { NX: true });

// Set with millisecond precision
await redis.set("key", "value", { PX: 5000 });
```

---

## Core Operations

### `get(key: string): Promise<string | null>`

Get the value of a key.

**Parameters:**
- `key`: Key to retrieve

**Returns:** Value or `null` if key doesn't exist

**Example:**
```typescript
const value = await redis.get("mykey");
if (value) {
  console.log("Found:", value);
}
```

---

### `set(key: string, value: string | number, options?: SetOptions): Promise<string | null>`

Set the value of a key.

**Parameters:**
- `key`: Key to set
- `value`: Value to store (string or number)
- `options`: Optional SET command options

**Returns:** `"OK"` on success, `null` if NX/XX condition not met

**Example:**
```typescript
// Simple set
await redis.set("key", "value");

// Set with expiration
await redis.set("session", "data", { EX: 3600 });

// Atomic set-if-not-exists
const created = await redis.set("lock", "1", { NX: true, EX: 10 });
```

---

### `del(...keys: string[]): Promise<number>`

Delete one or more keys.

**Parameters:**
- `...keys`: Keys to delete

**Returns:** Number of keys deleted

**Example:**
```typescript
const deleted = await redis.del("key1", "key2", "key3");
console.log(`Deleted ${deleted} keys`);
```

---

### `exists(...keys: string[]): Promise<boolean>`

Check if all specified keys exist.

**Parameters:**
- `...keys`: Keys to check

**Returns:** `true` if all keys exist, `false` otherwise

**Example:**
```typescript
if (await redis.exists("user:123")) {
  console.log("User exists");
}

// Check multiple keys
if (await redis.exists("key1", "key2", "key3")) {
  console.log("All keys exist");
}
```

---

## JSON Operations

### `getJSON<T>(key: string): Promise<T | null>`

Get and parse a JSON value.

**Parameters:**
- `key`: Key to retrieve

**Returns:** Parsed object or `null` if key doesn't exist or parsing fails

**Example:**
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user = await redis.getJSON<User>("user:123");
if (user) {
  console.log(user.name);
}
```

---

### `setJSON<T>(key: string, obj: T, options?: SetOptions): Promise<unknown>`

Store an object as JSON.

**Parameters:**
- `key`: Key to set
- `obj`: Object to serialize
- `options`: Optional SET command options

**Returns:** `"OK"` on success

**Example:**
```typescript
const user = {
  id: 123,
  name: "Alice",
  email: "alice@example.com"
};

await redis.setJSON("user:123", user, { EX: 3600 });
```

---

## Multi Operations

### `mget(...keys: string[]): Promise<(string | null)[]>`

Get multiple values by keys.

**Parameters:**
- `...keys`: Keys to retrieve

**Returns:** Array of values (null for non-existent keys)

**Example:**
```typescript
const [val1, val2, val3] = await redis.mget("key1", "key2", "key3");
```

---

### `mset(data: Record<string, string | number>): Promise<"OK">`

Set multiple key-value pairs atomically.

**Parameters:**
- `data`: Object mapping keys to values

**Returns:** `"OK"` on success

**Example:**
```typescript
await redis.mset({
  "key1": "value1",
  "key2": "value2",
  "key3": 123
});
```

---

## Hash Operations

### `hget(key: string, field: string): Promise<string | null>`

Get a hash field value.

**Parameters:**
- `key`: Hash key
- `field`: Field name

**Returns:** Field value or `null`

**Example:**
```typescript
const name = await redis.hget("user:123", "name");
```

---

### `hset(key: string, field: string, value: string | number): Promise<number>`

Set a hash field value.

**Parameters:**
- `key`: Hash key
- `field`: Field name
- `value`: Field value

**Returns:** `1` if new field, `0` if updated

**Example:**
```typescript
await redis.hset("user:123", "name", "Alice");
await redis.hset("user:123", "age", 30);
```

---

### `hmget(key: string, ...fields: string[]): Promise<(string | null)[] | null>`

Get multiple hash field values.

**Parameters:**
- `key`: Hash key
- `...fields`: Field names

**Returns:** Array of field values or `null`

**Example:**
```typescript
const [name, age] = await redis.hmget("user:123", "name", "age");
```

---

### `hmset(key: string, data: Record<string, string | number>): Promise<"OK">`

Set multiple hash field values.

**Parameters:**
- `key`: Hash key
- `data`: Object mapping field names to values

**Returns:** `"OK"` on success

**Example:**
```typescript
await redis.hmset("user:123", {
  name: "Alice",
  age: "30",
  city: "NYC"
});
```

---

### `hgetAll(key: string): Promise<Record<string, string>>`

Get all hash fields and values.

**Parameters:**
- `key`: Hash key

**Returns:** Object mapping field names to values

**Example:**
```typescript
const userData = await redis.hgetAll("user:123");
console.log(userData.name, userData.age);
```

---

## Counter Operations

### `incr(key: string): Promise<number>`

Increment a key's value by 1.

**Parameters:**
- `key`: Key to increment

**Returns:** New value after increment

**Example:**
```typescript
const views = await redis.incr("page:views");
console.log(`Total views: ${views}`);
```

---

### `decr(key: string): Promise<number>`

Decrement a key's value by 1.

**Parameters:**
- `key`: Key to decrement

**Returns:** New value after decrement

**Example:**
```typescript
const remaining = await redis.decr("inventory:item:123");
```

---

## TTL Operations

### `ttl(key: string): Promise<number>`

Get remaining time to live in seconds.

**Parameters:**
- `key`: Key to check

**Returns:** 
- TTL in seconds
- `-1` if key has no expiry
- `-2` if key doesn't exist

**Example:**
```typescript
const ttl = await redis.ttl("session:abc");
if (ttl > 0) {
  console.log(`Expires in ${ttl} seconds`);
}
```

---

### `setTTL(key: string, seconds: number): Promise<boolean>`

Set TTL on an existing key.

**Parameters:**
- `key`: Key to set TTL on
- `seconds`: Expiration time in seconds

**Returns:** `true` if TTL was set, `false` if key doesn't exist

**Example:**
```typescript
await redis.set("key", "value");
await redis.setTTL("key", 3600); // Expire in 1 hour
```

---

### `expire(key: string, seconds: number): Promise<number>`

Set key expiration.

**Parameters:**
- `key`: Key to expire
- `seconds`: Expiration time in seconds

**Returns:** `1` if set, `0` if key doesn't exist

**Example:**
```typescript
await redis.expire("temp:data", 300); // Expire in 5 minutes
```

---

## Pattern Matching

### `scanAll(pattern: string, count?: number): Promise<string[]>`

Scan for keys matching a pattern.

**Parameters:**
- `pattern`: Glob pattern (e.g., `"user:*"`, `"session:*:active"`)
- `count`: Keys to scan per iteration (default: 100)

**Returns:** Array of matching keys

**Example:**
```typescript
// Find all user keys
const userKeys = await redis.scanAll("user:*");

// Find all session keys
const sessions = await redis.scanAll("session:*");

// Namespaced: only scans within namespace
const app = createNamespacedRedis(redis, "myapp");
const keys = await app.scanAll("user:*"); // Scans "myapp:user:*"
```

**Notes:**
- Uses SCAN command for memory-efficient iteration
- For namespaced wrappers, pattern is automatically prefixed
- Returned keys have namespace prefix removed

---

## Pub/Sub Operations

### `subscribe(channel: string, callback: (message: string, channel: string) => void): Promise<() => Promise<void>>`

Subscribe to a channel.

**Parameters:**
- `channel`: Channel name
- `callback`: Function called when message received

**Returns:** Unsubscribe function

**Example:**
```typescript
const unsubscribe = await redis.subscribe("events", (message, channel) => {
  console.log(`[${channel}] ${message}`);
});

// Later: unsubscribe
await unsubscribe();
```

---

### `publish(channel: string, message: string): Promise<number>`

Publish message to channel.

**Parameters:**
- `channel`: Channel name
- `message`: Message to publish

**Returns:** Number of subscribers that received the message

**Example:**
```typescript
const subscribers = await redis.publish("events", "User logged in");
console.log(`Sent to ${subscribers} subscribers`);
```

**Namespaced Example:**
```typescript
const authApp = createNamespacedRedis(redis, "auth");
const shopApp = createNamespacedRedis(redis, "shop");

// Different namespaced channels
await authApp.subscribe("events", (msg) => console.log("Auth:", msg));
await shopApp.subscribe("events", (msg) => console.log("Shop:", msg));

await authApp.publish("events", "Auth event"); // Only auth subscribers
await shopApp.publish("events", "Shop event"); // Only shop subscribers
```

---

## List Operations

### `lpush(key: string, ...values: (string | number)[]): Promise<number>`

Push values to the left (head) of a list.

**Parameters:**
- `key`: List key
- `...values`: Values to push

**Returns:** Length of list after push

**Example:**
```typescript
await redis.lpush("queue", "task1", "task2", "task3");
```

---

### `rpush(key: string, ...values: (string | number)[]): Promise<number>`

Push values to the right (tail) of a list.

**Parameters:**
- `key`: List key
- `...values`: Values to push

**Returns:** Length of list after push

**Example:**
```typescript
await redis.rpush("queue", "task1", "task2");
```

---

### `lrange(key: string, start?: number, stop?: number): Promise<string[]>`

Get a range of elements from a list.

**Parameters:**
- `key`: List key
- `start`: Start index (default: 0)
- `stop`: Stop index (default: -1 for end)

**Returns:** Array of elements

**Example:**
```typescript
// Get all elements
const all = await redis.lrange("queue", 0, -1);

// Get first 10 elements
const first10 = await redis.lrange("queue", 0, 9);
```

---

### `lpop(key: string): Promise<string | null>`

Remove and return the first (leftmost) element.

**Parameters:**
- `key`: List key

**Returns:** First element or `null` if list is empty

**Example:**
```typescript
const task = await redis.lpop("queue");
if (task) {
  console.log("Processing:", task);
}
```

---

### `rpop(key: string): Promise<string | null>`

Remove and return the last (rightmost) element.

**Parameters:**
- `key`: List key

**Returns:** Last element or `null` if list is empty

**Example:**
```typescript
const last = await redis.rpop("history");
```

---

## Set Operations

### `sadd(key: string, ...members: (string | number)[]): Promise<number>`

Add members to a set.

**Parameters:**
- `key`: Set key
- `...members`: Members to add

**Returns:** Number of elements added (excludes duplicates)

**Example:**
```typescript
const added = await redis.sadd("tags", "redis", "cache", "database");
```

---

### `srem(key: string, ...members: (string | number)[]): Promise<number>`

Remove members from a set.

**Parameters:**
- `key`: Set key
- `...members`: Members to remove

**Returns:** Number of elements removed

**Example:**
```typescript
await redis.srem("tags", "cache");
```

---

### `smembers(key: string): Promise<string[]>`

Get all members of a set.

**Parameters:**
- `key`: Set key

**Returns:** Array of set members

**Example:**
```typescript
const tags = await redis.smembers("article:tags");
console.log("Tags:", tags);
```

---

## Cleanup Operations

### `close(): Promise<void>`

Close the Redis connection.

**Example:**
```typescript
const redis = await createRedis();
// ... use redis ...
await redis.close();
```

---

### `[Symbol.asyncDispose](): Promise<void>`

Async dispose support for `await using` syntax.

**Example:**
```typescript
await using redis = await createRedis();
// Connection automatically closed when out of scope
```

---

## Common Patterns

### Cache-Aside Pattern

```typescript
async function getCachedData<T>(
  cache: NamespacedRedisWrapper,
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Try cache first
  const cached = await cache.getJSON<T>(key);
  if (cached) return cached;
  
  // Cache miss - fetch data
  const data = await fetchFn();
  
  // Store in cache
  await cache.setJSON(key, data, { EX: ttl });
  
  return data;
}
```

### Rate Limiting

```typescript
async function checkRateLimit(
  redis: NamespacedRedisWrapper,
  userId: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `ratelimit:${userId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.setTTL(key, windowSeconds);
  }
  
  return count <= maxRequests;
}
```

### Distributed Lock

```typescript
async function acquireLock(
  redis: RedisWrapper,
  lockKey: string,
  ttl: number = 10
): Promise<boolean> {
  const acquired = await redis.set(lockKey, "1", { NX: true, EX: ttl });
  return acquired === "OK";
}

async function releaseLock(redis: RedisWrapper, lockKey: string): Promise<void> {
  await redis.del(lockKey);
}
```

### Session Management

```typescript
interface Session {
  userId: string;
  loginAt: number;
  data: Record<string, any>;
}

const sessions = createNamespacedRedis(redis, "sessions");

// Create session
async function createSession(sessionId: string, userId: string): Promise<void> {
  const session: Session = {
    userId,
    loginAt: Date.now(),
    data: {}
  };
  await sessions.setJSON(sessionId, session, { EX: 3600 });
}

// Get session
async function getSession(sessionId: string): Promise<Session | null> {
  return await sessions.getJSON<Session>(sessionId);
}

// Extend session
async function extendSession(sessionId: string): Promise<void> {
  await sessions.setTTL(sessionId, 3600);
}
```

---

## Error Handling

```typescript
try {
  await redis.set("key", "value");
} catch (error) {
  console.error("Redis error:", error);
  // Handle connection errors, timeouts, etc.
}
```

---

## Best Practices

1. **Use `await using` for automatic cleanup:**
   ```typescript
   await using redis = await createRedis();
   ```

2. **Share base connection across namespaces:**
   ```typescript
   await using redis = await createRedis();
   const app1 = createNamespacedRedis(redis, "app1");
   const app2 = createNamespacedRedis(redis, "app2");
   ```

3. **Use type parameters for JSON operations:**
   ```typescript
   const user = await redis.getJSON<User>("user:123");
   ```

4. **Set appropriate TTLs:**
   ```typescript
   await redis.setJSON("cache:data", data, { EX: 300 });
   ```

5. **Use pattern matching carefully:**
   ```typescript
   // ✅ Specific pattern
   await redis.scanAll("user:session:*");
   
   // ❌ Too broad
   await redis.scanAll("*");
   ```

---

## Performance Tips

- Use `mget`/`mset` for batch operations
- Set appropriate TTLs to manage memory
- Use namespaces to organize keys logically
- Scan with specific patterns to reduce overhead
- Reuse connections instead of creating new ones

---

## Type Safety

All operations are fully typed with TypeScript:

```typescript
// Type-safe JSON operations
interface User {
  id: number;
  name: string;
}

const user = await redis.getJSON<User>("user:123");
if (user) {
  console.log(user.name); // TypeScript knows this is a string
}

// Options are type-checked
await redis.set("key", "value", {
  EX: 3600,
  NX: true
  // TypeScript prevents invalid options
});
```
