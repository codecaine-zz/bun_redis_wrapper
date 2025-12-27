# Redis Wrapper Quick Reference

Quick reference for the most commonly used operations.

## Import

```typescript
// Import everything from main entry point
import { 
  createRedis, 
  createNamespacedRedis, 
  clearNamespace 
} from "./index.ts";

// Or import core wrapper only
import { RedisWrapper, createRedis } from "./redis-wrapper.ts";
```

## Connection

```typescript
// Basic connection
await using redis = await createRedis();

// Custom URL
await using redis = await createRedis("redis://localhost:6379");

// Create namespaced wrapper
const app = createNamespacedRedis(redis, "myapp");
```

## Core Operations

```typescript
// Set & Get
await redis.set("key", "value");
await redis.set("key", "value", { EX: 3600 }); // with TTL
const value = await redis.get("key");

// Delete
await redis.del("key1", "key2", "key3");

// Check existence
const exists = await redis.exists("key");
```

## JSON Operations

```typescript
// Store object
await redis.setJSON("user:123", { name: "Alice", age: 30 });
await redis.setJSON("key", data, { EX: 3600 }); // with TTL

// Retrieve object (type-safe)
const user = await redis.getJSON<User>("user:123");
```

## Counters

```typescript
// Increment
const views = await redis.incr("page:views");

// Decrement
const remaining = await redis.decr("stock:item:123");
```

## TTL

```typescript
// Get TTL
const ttl = await redis.ttl("key"); // seconds remaining

// Set TTL
await redis.setTTL("key", 300); // 5 minutes

// Set expiration
await redis.expire("key", 3600); // 1 hour
```

## Hash Operations

```typescript
// Set field
await redis.hset("user:123", "name", "Alice");

// Get field
const name = await redis.hget("user:123", "name");

// Set multiple fields
await redis.hmset("user:123", {
  name: "Alice",
  age: "30",
  city: "NYC"
});

// Get all fields
const data = await redis.hgetAll("user:123");
```

## List Operations

```typescript
// Push (right/left)
await redis.rpush("queue", "task1", "task2");
await redis.lpush("stack", "item1", "item2");

// Get range
const items = await redis.lrange("queue", 0, -1); // all

// Pop (left/right)
const task = await redis.lpop("queue");
const last = await redis.rpop("stack");
```

## Set Operations

```typescript
// Add members
await redis.sadd("tags", "redis", "cache", "database");

// Get all members
const tags = await redis.smembers("tags");

// Remove members
await redis.srem("tags", "cache");
```

## Multi Operations

```typescript
// Get multiple
const [val1, val2, val3] = await redis.mget("key1", "key2", "key3");

// Set multiple
await redis.mset({
  "key1": "value1",
  "key2": "value2",
  "key3": "value3"
});
```

## Pattern Matching

```typescript
// Scan for keys
const userKeys = await redis.scanAll("user:*");
const sessions = await redis.scanAll("session:*");

// With namespace (auto-scoped)
const app = createNamespacedRedis(redis, "myapp");
const keys = await app.scanAll("user:*"); // only within "myapp:" namespace
```

## Pub/Sub

```typescript
// Subscribe
const unsubscribe = await redis.subscribe("events", (message, channel) => {
  console.log(`[${channel}] ${message}`);
});

// Publish
await redis.publish("events", "User logged in");

// Unsubscribe
await unsubscribe();
```

## Namespaces

```typescript
// Create namespaced wrappers
const auth = createNamespacedRedis(redis, "auth");
const shop = createNamespacedRedis(redis, "shop");

// Keys are automatically prefixed
await auth.set("session:123", "data"); // stored as "auth:session:123"
await shop.set("session:123", "data"); // stored as "shop:session:123"

// Clear namespace
const deleted = await clearNamespace(redis, "auth");
```

## Common Patterns

### Cache with TTL
```typescript
await redis.setJSON("cache:products", products, { EX: 300 }); // 5 min
const cached = await redis.getJSON("cache:products");
```

### Rate Limiting
```typescript
const count = await redis.incr(`ratelimit:${userId}`);
if (count === 1) await redis.setTTL(`ratelimit:${userId}`, 60);
const allowed = count <= 10; // 10 requests per minute
```

### Distributed Lock
```typescript
const acquired = await redis.set("lock:resource", "1", { NX: true, EX: 10 });
if (acquired === "OK") {
  // Do work
  await redis.del("lock:resource");
}
```

### Session Management
```typescript
const sessions = createNamespacedRedis(redis, "sessions");
await sessions.setJSON(sessionId, sessionData, { EX: 3600 });
const session = await sessions.getJSON(sessionId);
```

## SET Options

```typescript
// Expire in seconds
{ EX: 3600 }

// Expire in milliseconds
{ PX: 5000 }

// Only set if doesn't exist (create)
{ NX: true }

// Only set if exists (update)
{ XX: true }

// Keep existing TTL
{ KEEPTTL: true }

// Combine options
{ NX: true, EX: 10 } // atomic lock with TTL
```

## Multi-Tenant Example

```typescript
const tenant1 = createNamespacedRedis(redis, "tenant:acme");
const tenant2 = createNamespacedRedis(redis, "tenant:globex");

await tenant1.setJSON("config", { theme: "dark" });
await tenant2.setJSON("config", { theme: "light" });
```

## Environment Separation

```typescript
const env = process.env.NODE_ENV || "development";
const app = createNamespacedRedis(redis, `myapp:${env}`);
// Keys: "myapp:development:..." or "myapp:production:..."
```

## Error Handling

```typescript
try {
  await redis.set("key", "value");
} catch (error) {
  console.error("Redis error:", error);
}
```

## Cleanup

```typescript
// Auto-cleanup with await using
await using redis = await createRedis();
// Connection closed automatically

// Manual cleanup
const redis = await createRedis();
await redis.close();
```

## Type Safety

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Type-safe JSON operations
const user = await redis.getJSON<User>("user:123");
if (user) {
  console.log(user.name); // TypeScript knows type
}
```

---

For complete documentation, see [API.md](API.md)
