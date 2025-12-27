# Production-Ready Redis Controllers

Drop-in controllers for building production applications with Redis. Each controller is battle-tested, fully typed, and ready to use in your application.

## 🎯 Quick Start

```typescript
import { createRedis } from "../index.ts";
import { SessionController, CounterController } from "./controllers/index.ts";

const redis = await createRedis();
const sessions = new SessionController(redis);
const counters = new CounterController(redis);

// Use in your app
const sessionId = await sessions.create("user-123", {
  name: "Alice",
  email: "alice@example.com"
});

await counters.increment("page:home:views");
```

## 📦 Available Controllers (10 Total)

### Core Controllers

| Controller | Purpose | Use Cases |
|------------|---------|-----------|
| [SessionController](#sessioncontroller) | User sessions | Authentication, login/logout |
| [CacheController](#cachecontroller) | Application caching | API responses, database queries |
| [RateLimiterController](#ratelimitercontroller) | Rate limiting | API protection, abuse prevention |
| [QueueController](#queuecontroller) | Job queue | Background tasks, email sending |
| [StorageController](#storagecontroller) | Key-value storage | User settings, configurations |
| [AnalyticsController](#analyticscontroller) | Metrics tracking | Page views, user activity |

### ⭐ New Beginner-Friendly Controllers

| Controller | Purpose | Use Cases |
|------------|---------|-----------|
| [CounterController](#countercontroller) | Atomic counters | Page views, downloads, votes, inventory |
| [LeaderboardController](#leaderboardcontroller) | Rankings & scores | Games, competitions, top performers |
| [LockController](#lockcontroller) | Distributed locks | Payment processing, critical sections |
| [PubSubController](#pubsubcontroller) | Real-time messaging | Live chat, notifications, updates |

---

## SessionController

**Purpose:** Manage user sessions with automatic expiration and security features.

**Features:**
- Automatic session expiration
- Multi-device support
- IP tracking for security
- Session validation
- Bulk session management

**Example:**

```typescript
import { SessionController } from "./controllers/SessionController.ts";

const sessions = new SessionController(redis);

// Create session (expires in 24 hours by default)
const sessionId = await sessions.create("user-123", {
  name: "Alice",
  email: "alice@example.com",
  role: "admin"
});

// Validate session
const session = await sessions.get(sessionId);
if (session) {
  console.log(`Welcome back, ${session.data.name}!`);
}

// Extend session
await sessions.extend(sessionId, 3600); // +1 hour

// Logout
await sessions.destroy(sessionId);

// Logout from all devices
await sessions.destroyAllForUser("user-123");
```

---

## CacheController

**Purpose:** Intelligent caching layer with TTL, cache warming, and invalidation.

**Features:**
- Automatic cache-aside pattern
- TTL management
- Cache warming
- Tag-based invalidation
- Cache statistics

**Example:**

```typescript
import { CacheController } from "./controllers/CacheController.ts";

const cache = new CacheController(redis);

// Cache with automatic fallback
const user = await cache.getOrSet(
  "user:123",
  async () => {
    // This only runs on cache miss
    return await database.getUser(123);
  },
  300 // TTL: 5 minutes
);

// Invalidate cache
await cache.delete("user:123");

// Invalidate multiple keys
await cache.deletePattern("user:*");

// Get cache stats
const stats = await cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

---

## RateLimiterController

**Purpose:** Protect APIs and resources from abuse with flexible rate limiting.

**Features:**
- Multiple algorithms (fixed window, sliding window, token bucket)
- Per-user or per-IP limits
- Configurable time windows
- Retry-after headers
- Tier-based limits

**Example:**

```typescript
import { RateLimiterController } from "./controllers/RateLimiterController.ts";

const limiter = new RateLimiterController(redis);

// Check rate limit (10 requests per minute)
const result = await limiter.check("user-123", 10, 60);

if (!result.allowed) {
  throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter}s`);
}

console.log(`${result.remaining} requests remaining`);

// Reset limits (for testing/admin)
await limiter.reset("user-123");
```

---

## QueueController

**Purpose:** Background job processing with priorities and retries.

**Features:**
- Priority-based processing
- Automatic retries with backoff
- Job status tracking
- Scheduled jobs
- Worker management

**Example:**

```typescript
import { QueueController } from "./controllers/QueueController.ts";

const queue = new QueueController(redis);

// Add job
const jobId = await queue.add("send-email", {
  to: "user@example.com",
  subject: "Welcome!",
  template: "welcome"
}, {
  priority: 5, // 1-10
  maxRetries: 3,
  delay: 0 // immediate
});

// Process jobs
const job = await queue.next();
if (job) {
  try {
    await sendEmail(job.data);
    await queue.complete(job.id);
  } catch (error) {
    await queue.fail(job.id, error.message);
  }
}

// Get queue stats
const stats = await queue.getStats();
console.log(`${stats.pending} jobs pending`);
```

---

## StorageController

**Purpose:** Simple key-value storage with JSON support and namespacing.

**Features:**
- Automatic JSON serialization
- Namespace support
- Bulk operations
- Pattern matching
- TTL support

**Example:**

```typescript
import { StorageController } from "./controllers/StorageController.ts";

const storage = new StorageController(redis, "settings");

// Store data (auto JSON serialization)
await storage.set("theme", { mode: "dark", accent: "blue" });
await storage.set("notifications", { email: true, sms: false });

// Retrieve data
const theme = await storage.get("theme");

// Bulk operations
await storage.setMany({
  "theme": { mode: "dark" },
  "language": "en",
  "timezone": "UTC"
});

const all = await storage.getAll();

// Pattern matching
const keys = await storage.keys("noti*");

// Delete
await storage.delete("theme");
```

---

## AnalyticsController

**Purpose:** Track metrics and analytics with memory-efficient HyperLogLog.

**Features:**
- Unique visitor counting
- Event tracking
- Time-series data
- Memory efficient (12KB per metric)
- DAU/MAU tracking

**Example:**

```typescript
import { AnalyticsController } from "./controllers/AnalyticsController.ts";

const analytics = new AnalyticsController(redis);

// Track page view
await analytics.trackEvent("page-view", "/dashboard", "user-123");

// Track unique visitor
await analytics.trackUnique("daily-visitors", "user-123");

// Get unique count
const visitors = await analytics.getUniqueCount("daily-visitors");

// Get event count
const views = await analytics.getEventCount("page-view", "/dashboard");

// Get analytics for date range
const stats = await analytics.getDateRange("page-view", 
  new Date("2024-01-01"),
  new Date("2024-01-31")
);
```

---

## 🏗️ Using Controllers in Your Application

### Express.js Example

```typescript
import express from "express";
import { createRedis } from "../index.ts";
import { SessionController, RateLimiterController } from "./controllers";

const app = express();
const redis = await createRedis();
const sessions = new SessionController(redis);
const limiter = new RateLimiterController(redis);

// Session middleware
app.use(async (req, res, next) => {
  const sessionId = req.headers["x-session-id"];
  if (sessionId) {
    req.session = await sessions.get(sessionId);
  }
  next();
});

// Rate limiting middleware
app.use(async (req, res, next) => {
  const userId = req.session?.userId || req.ip;
  const result = await limiter.check(userId, 100, 60);
  
  if (!result.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  
  res.setHeader("X-RateLimit-Remaining", result.remaining);
  next();
});

app.listen(3000);
```

### Hono Example

```typescript
import { Hono } from "hono";
import { createRedis } from "../index.ts";
import { CacheController } from "./controllers";

const app = new Hono();
const redis = await createRedis();
const cache = new CacheController(redis);

app.get("/api/users/:id", async (c) => {
  const id = c.req.param("id");
  
  const user = await cache.getOrSet(
    `user:${id}`,
    async () => await db.getUser(id),
    300
  );
  
  return c.json(user);
});

export default app;
```

---

## 🔒 Best Practices

1. **Connection Management**
   ```typescript
   // Create one connection, share across controllers
   const redis = await createRedis();
   const sessions = new SessionController(redis);
   const cache = new CacheController(redis);
   ```

2. **Error Handling**
   ```typescript
   try {
     await sessions.create("user-123", data);
   } catch (error) {
     console.error("Session creation failed:", error);
     // Fallback logic
   }
   ```

3. **Graceful Shutdown**
   ```typescript
   process.on("SIGTERM", async () => {
     await redis.close();
     process.exit(0);
   });
   ```

4. **Environment Configuration**
   ```typescript
   const redis = await createRedis(
     process.env.REDIS_URL || "redis://localhost:6379"
   );
   ```

5. **Testing**
   ```typescript
   // Use separate namespace for tests
   const testRedis = await createRedis();
   const storage = new StorageController(testRedis, "test");
   
   afterEach(async () => {
     await clearNamespace(testRedis, "test");
   });
   ```

---

## 📚 Additional Resources

- [Demos](../demos/) - 11 comprehensive examples
- [API Documentation](../API.md) - Complete API reference
- [Quick Reference](../QUICK_REFERENCE.md) - Common patterns
- [Redis Features](../REDIS_FEATURES.md) - Redis data types guide

### 12. FormularyController (Healthcare)

Manages Medicare Part D formularies, drug tiers, prior authorization (PA), and step therapy protocols.

**Features:**
- **Drug Management**: Add drugs with tier, therapeutic class, and requirements (PA, ST, QL).
- **Search**: Find drugs by name or therapeutic class.
- **Step Therapy**: Check compliance with step therapy protocols (e.g., try generic before brand).
- **Prior Authorization**: Submit and track PA requests.
- **Formulary Validation**: Validate entire formulary integrity.

**Usage:**
\`\`\`typescript
const formulary = new FormularyController(redis);

// Add a drug
await formulary.addDrug('formulary:2024', {
  id: 'drug-123',
  name: 'Lisinopril',
  tier: 1,
  therapeuticClass: 'Antihypertensive',
  requirements: { priorAuth: false, stepTherapy: false }
});

// Check step therapy
const compliance = await formulary.checkStepTherapyCompliance(
  'formulary:2024',
  'drug-456', // Target drug (e.g., Brand name)
  ['drug-123'] // Patient history
);
\`\`\`

### 13. RadAppController (Rapid Application Development)

A high-level controller designed for building single applications quickly by providing a namespace-scoped environment with simplified data access patterns.

**Features:**
- **Automatic Namespacing**: All keys are prefixed (e.g., `myapp:users:123`).
- **Entity Storage**: Simple CRUD for JSON objects.
- **Global State**: Key-Value storage for app configuration.
- **Feeds/Lists**: Activity streams and lists.
- **Counters**: Atomic counters for IDs and stats.

**Usage:**
\`\`\`typescript
const app = new RadAppController(redis, "my-todo-app");

// 1. Save an entity (User)
await app.saveEntity("users", "u1", { name: "Alice", role: "admin" });

// 2. Create a task with auto-increment ID
const taskId = await app.incrementCounter("task_id");
await app.saveEntity("tasks", `t${taskId}`, { title: "Buy milk", done: false });

// 3. Add to activity feed
await app.pushToFeed("activity", { action: "task_created", id: taskId });

// 4. Get recent activity
const feed = await app.getRecentFeedItems("activity", 10);
\`\`\`

---

## 🤝 Contributing

Found a bug or want to add a controller? Contributions welcome!

1. Controllers should be self-contained
2. Include TypeScript types
3. Add comprehensive JSDoc comments
4. Follow existing patterns
5. Test thoroughly

---

## 📝 License

Same as parent project.
