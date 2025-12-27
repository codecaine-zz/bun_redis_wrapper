# Bun Redis Wrapper - Production Ready

[![npm version](https://img.shields.io/npm/v/@codecaine/bun-redis-wrapper.svg)](https://www.npmjs.com/package/@codecaine/bun-redis-wrapper)
[![npm downloads](https://img.shields.io/npm/dm/@codecaine/bun-redis-wrapper.svg)](https://www.npmjs.com/package/@codecaine/bun-redis-wrapper)
[![license](https://img.shields.io/npm/l/@codecaine/bun-redis-wrapper.svg)](https://github.com/codecaine-zz/bun_redis_wrapper/blob/main/LICENSE)

A powerful Redis wrapper for Bun with **production-ready controllers** for building real applications. Drop-in solutions for sessions, caching, rate limiting, job queues, and more.

## 🎯 Quick Start for Beginners

### Option 1: Use Production Controllers (Recommended)

```typescript
import { createRedis } from "@codecaine/bun-redis-wrapper";
import { SessionController, CacheController } from "@codecaine/bun-redis-wrapper/controllers";

const redis = await createRedis();

// Sessions - ready to use!
const sessions = new SessionController(redis);
const sessionId = await sessions.create("user-123", { name: "Alice" });

// Caching - intelligent and automatic!
const cache = new CacheController(redis);
const user = await cache.getOrSet("user:123", () => db.getUser(123), 300);
```

**📦 Available Controllers:**
- **SessionController** - User sessions with multi-device support
- **CacheController** - Intelligent caching with cache-aside pattern
- **RateLimiterController** - API rate limiting (fixed/sliding window, token bucket)
- **QueueController** - Background job processing with priorities
- **StorageController** - Simple key-value storage with JSON
- **AnalyticsController** - Metrics tracking with HyperLogLog

👉 **[Controllers Documentation](src/controllers/README.md)** - Complete guide with examples  
👉 **[Example Application](demos/14-controller-app.ts)** - Full app using all controllers

### Option 2: Use Core Wrapper Directly

```typescript
import { createRedis, createNamespacedRedis } from "@codecaine/bun-redis-wrapper";

await using redis = await createRedis("redis://localhost:6379");
await redis.set("key", "value");

// With namespaces
const authApp = createNamespacedRedis(redis, "auth");
const shopApp = createNamespacedRedis(redis, "shop");
```

## ✨ Features

✅ **Production-Ready Controllers** - Drop-in solutions for common use cases ⭐ NEW  
✅ **Beginner Friendly** - Clear documentation and examples ⭐ NEW  
✅ **Type-Safe** - Full TypeScript support with proper types  
✅ **Namespace Support** - Automatic key prefixing to prevent collisions  
✅ **Comprehensive API** - All common Redis operations supported  
✅ **JSON Helpers** - Built-in JSON serialization/deserialization  
✅ **Sorted Sets** - Leaderboards, rankings, and priority queues  
✅ **Streams** - Event sourcing and real-time data processing  
✅ **Geospatial** - Location-based queries and proximity search  
✅ **HyperLogLog** - Memory-efficient unique counting  
✅ **Async Dispose** - Works with `await using` syntax  
✅ **Zero Dependencies** - Uses Bun's native RedisClient  

## 📊 Supported Redis Data Types

- **Strings** - GET, SET, INCR, DECR
- **Hashes** - HGET, HSET, HGETALL
- **Lists** - LPUSH, RPUSH, LRANGE
- **Sets** - SADD, SREM, SMEMBERS
- **Sorted Sets** - ZADD, ZRANGE, ZRANK (leaderboards)
- **Streams** - XADD, XREAD, XRANGE (event logs)
- **Geospatial** - GEOADD, GEODIST, GEORADIUS
- **HyperLogLog** - PFADD, PFCOUNT (unique counting)

## 📚 Documentation

### For Beginners
- **[Controllers Guide](src/controllers/README.md)** - Production-ready controllers ⭐ START HERE
- **[Example Application](demos/14-controller-app.ts)** - Complete app example ⭐
- **[Demos](demos/)** - 11 comprehensive examples with best practices

### For Advanced Users
- **[API.md](docs/API.md)** - Complete API reference with all methods
- **[REDIS_FEATURES.md](docs/REDIS_FEATURES.md)** - Redis features coverage analysis
- **[QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Common patterns cheat sheet
- **[index.test.ts](tests/index.test.ts)** - Full test suite (83 tests)

## 🚀 Installation

```bash
# Using Bun
bun add @codecaine/bun-redis-wrapper

# Using npm
npm install @codecaine/bun-redis-wrapper

# Using pnpm
pnpm add @codecaine/bun-redis-wrapper

# Using yarn
yarn add @codecaine/bun-redis-wrapper
```

## 📖 Quick Examples

### Sessions (Production-Ready)

```typescript
import { SessionController } from "@codecaine/bun-redis-wrapper/controllers";

const sessions = new SessionController(redis);

// Create session
const sessionId = await sessions.create("user-123", {
  name: "Alice",
  email: "alice@example.com"
});

// Validate session
const session = await sessions.validate(sessionId);
if (session) {
  console.log(`Welcome ${session.data.name}!`);
}

// Logout
await sessions.destroy(sessionId);
```

### Caching (Production-Ready)

```typescript
import { CacheController } from "@codecaine/bun-redis-wrapper/controllers";

const cache = new CacheController(redis);

// Cache-aside pattern (automatic!)
const user = await cache.getOrSet(
  "user:123",
  async () => await database.getUser(123), // Only called on cache miss
  300 // Cache for 5 minutes
);

// Check cache stats
const stats = await cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

### Rate Limiting (Production-Ready)

```typescript
import { RateLimiterController } from "@codecaine/bun-redis-wrapper/controllers";

const limiter = new RateLimiterController(redis);

// Check rate limit (10 requests per minute)
const result = await limiter.check("user-123", 10, 60);

if (!result.allowed) {
  throw new Error(`Rate limited. Retry after ${result.retryAfter}s`);
}

console.log(`${result.remaining} requests remaining`);
```

### Background Jobs (Production-Ready)

```typescript
import { QueueController } from "@codecaine/bun-redis-wrapper/controllers";

const queue = new QueueController(redis);

// Add job
await queue.add("send-email", {
  to: "user@example.com",
  subject: "Welcome!"
}, { priority: 8 });

// Process jobs (in worker)
const job = await queue.next();
if (job) {
  await sendEmail(job.data);
  await queue.complete(job.id);
}
```

### Core Wrapper Usage
```

### Multi-Tenant Application

```typescript
import { createRedis, createNamespacedRedis } from "@codecaine/bun-redis-wrapper";

await using redis = await createRedis();

// Each tenant gets isolated namespace
const tenant1 = createNamespacedRedis(redis, "tenant:acme");
const tenant2 = createNamespacedRedis(redis, "tenant:globex");

await tenant1.setJSON("config", { theme: "dark" });
await tenant2.setJSON("config", { theme: "light" });

// No collisions - each tenant has separate data
```

### Environment-Based Isolation

```typescript
const env = process.env.NODE_ENV || "development";
const namespace = `myapp:${env}`;
const redis = createNamespacedRedis(baseRedis, namespace);

// Keys stored as: "myapp:development:..." or "myapp:production:..."
```

## API Reference

### Factory Functions

#### `createRedis(url?: string)`

Creates a base Redis connection.

```typescript
await using redis = await createRedis("redis://localhost:6379");
```

#### `createNamespacedRedis(redis, namespace)`

Creates a namespaced wrapper with automatic key prefixing.

```typescript
const app = createNamespacedRedis(redis, "myapp");
```

#### `clearNamespace(redis, namespace)`

Deletes all keys in a namespace.

```typescript
const deleted = await clearNamespace(redis, "myapp");
```

### Available Operations

All operations support both the base `RedisWrapper` and `NamespacedRedisWrapper`:

**Core Operations**
- `get(key)`, `set(key, value, options?)`
- `del(...keys)`, `exists(...keys)`

**JSON Operations**
- `getJSON<T>(key)`, `setJSON<T>(key, value, options?)`

**Multi Operations**
- `mget(...keys)`, `mset(data)`

**Hash Operations**
- `hget(key, field)`, `hset(key, field, value)`
- `hmget(key, ...fields)`, `hmset(key, data)`
- `hgetAll(key)`

**Counter Operations**
- `incr(key)`, `decr(key)`

**TTL Operations**
- `ttl(key)`, `setTTL(key, seconds)`, `expire(key, seconds)`

**Pattern Matching**
- `scanAll(pattern, count?)`

**Pub/Sub**
- `subscribe(channel, callback)`, `publish(channel, message)`

**List Operations**
- `lpush(key, ...values)`, `rpush(key, ...values)`
- `lrange(key, start?, stop?)`, `lpop(key)`, `rpop(key)`

**Set Operations**
- `sadd(key, ...members)`, `srem(key, ...members)`, `smembers(key)`

## Examples

### JSON Storage with TTL

```typescript
interface UserSession {
  userId: number;
  username: string;
  loginAt: number;
}

const sessions = createNamespacedRedis(redis, "sessions");

const session: UserSession = {
  userId: 123,
  username: "alice",
  loginAt: Date.now()
};

// Store with 1 hour expiration
await sessions.setJSON("user:123", session, { EX: 3600 });

// Retrieve
const active = await sessions.getJSON<UserSession>("user:123");
```

### Rate Limiting

```typescript
async function checkRateLimit(
  client: NamespacedRedisWrapper,
  userId: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `ratelimit:${userId}`;
  const count = await client.incr(key);
  
  if (count === 1) {
    await client.setTTL(key, windowSeconds);
  }
  
  return count <= maxRequests;
}

const api = createNamespacedRedis(redis, "api:v1");
const allowed = await checkRateLimit(api, "user:123", 10, 60);
```

### Pattern Matching

```typescript
const app = createNamespacedRedis(redis, "myapp");

// Store user sessions
await app.set("session:user:1", "data1");
await app.set("session:user:2", "data2");
await app.set("config:timeout", "30");

// Find all sessions (scoped to namespace)
const sessionKeys = await app.scanAll("session:*");
console.log(sessionKeys); // ["session:user:1", "session:user:2"]
```

## Best Practices

### 1. Use Consistent Naming

```typescript
// ✅ Good: Clear hierarchy with colons
"app:entity:id:field"
"myapp:user:12345:profile"

// ❌ Avoid: Inconsistent separators
"myapp_user_12345"
```

### 2. Share Base Connection

```typescript
// ✅ Good: One connection, multiple namespaces
await using redis = await createRedis();
const app1 = createNamespacedRedis(redis, "app1");
const app2 = createNamespacedRedis(redis, "app2");

// ❌ Bad: Multiple connections
const redis1 = await createRedis();
const redis2 = await createRedis();
```

### 3. Clean Up in Tests

```typescript
import { test, afterEach } from "bun:test";

afterEach(async () => {
  await clearNamespace(redis, "test");
});
```

## Use Cases

- 🏢 **Microservices** - Isolate data per service
- 👥 **Multi-tenant SaaS** - Separate data per customer
- 🌍 **Environment Isolation** - dev/staging/prod separation
- 🔄 **API Versioning** - v1/v2 namespace isolation
- 👨‍💻 **Team Resources** - Team-based access control

## Performance

The namespace wrapper adds minimal overhead - just string concatenation. No additional network calls or memory overhead.

## 📝 Testing

Run the comprehensive test suite:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch
```

The test suite includes 59 tests covering:
- Core Redis operations
- JSON operations
- Multi operations
- Hash operations
- Counter operations
- TTL operations
- Pattern matching
- List operations
- Set operations
- Namespace isolation
- Multi-tenant scenarios
- Integration tests

## Requirements

- Bun v1.0+
- Redis server

## License

MIT

---

Based on [bun_database_wrappers](https://github.com/codecaine-zz/bun_database_wrappers) project, refactored into a single file for easy import.
