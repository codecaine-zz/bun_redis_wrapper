# Production-Ready Redis Controllers

Drop-in controllers for building production applications with Redis. Each controller is battle-tested, fully typed, and ready to use in your application.

## 🎯 Quick Start

```typescript
import { createRedis } from "@codecaine/bun-redis-wrapper";
import { SessionController, CounterController } from "@codecaine/bun-redis-wrapper/controllers";

const redis = await createRedis();

// Best practice: Use namespaces to organize keys
const sessions = new SessionController(redis, "myapp"); // Keys: myapp:session:*
const counters = new CounterController(redis, "myapp"); // Keys: myapp:counter:*

// Use in your app
const sessionId = await sessions.create("user-123", {
  name: "Alice",
  email: "alice@example.com"
});

await counters.increment("page:home:views"); // Key: myapp:counter:page:home:views
```

## 📦 Available Controllers (13 Total)

All controllers support **namespace best practices** - pass a namespace as the second parameter to automatically prefix all keys.

### Core Controllers

| Controller | Purpose | Use Cases |
|------------|---------|-----------|
| [SessionController](#sessioncontroller) | User sessions | Authentication, login/logout |
| [CacheController](#cachecontroller) | Application caching | API responses, database queries |
| [RateLimiterController](#ratelimitercontroller) | Rate limiting | API protection, abuse prevention |
| [QueueController](#queuecontroller) | Job queue | Background tasks, email sending |
| [StorageController](#storagecontroller) | Key-value storage | User settings, configurations |
| [AnalyticsController](#analyticscontroller) | Metrics tracking | Page views, user activity |

### Data Structure Controllers

| Controller | Purpose | Use Cases |
|------------|---------|-----------|
| [CounterController](#countercontroller) | Atomic counters | Page views, downloads, votes, inventory |
| [LeaderboardController](#leaderboardcontroller) | Rankings & scores | Games, competitions, top performers |
| [LockController](#lockcontroller) | Distributed locks | Payment processing, critical sections |
| [PubSubController](#pubsubcontroller) | Real-time messaging | Live chat, notifications, updates |

### Specialized Controllers

| Controller | Purpose | Use Cases |
|------------|---------|-----------|
| [FormularyController](#formularycontroller) | Healthcare formularies | Medicare Part D, drug management |
| [RadAppController](#radappcontroller) | Rapid app development | Quick prototypes, single-app namespacing |

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

const sessions = new SessionController(redis, "app"); // Namespace: app:session:*

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

const cache = new CacheController(redis, "api"); // Namespace: api:cache:*

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

const limiter = new RateLimiterController(redis, "api"); // Namespace: api:ratelimit:*

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

const queue = new QueueController(redis, "jobs"); // Namespace: jobs:queue:*

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

const storage = new StorageController(redis, "settings"); // Namespace: settings:*

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

const analytics = new AnalyticsController(redis, "metrics"); // Namespace: metrics:*

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

## CounterController

**Purpose:** Atomic counter operations for tracking metrics, IDs, and statistics.

**Features:**
- Atomic increment/decrement
- Auto-increment IDs
- Bulk counter operations
- Namespace support
- Counter resets

**Example:**

```typescript
import { CounterController } from "./controllers/CounterController.ts";

const counters = new CounterController(redis, "myapp"); // Namespace: myapp:*

// Increment page views
await counters.increment("page:home:views"); // Key: myapp:page:home:views
const views = await counters.get("page:home:views");

// Decrement inventory
await counters.decrement("inventory:item-123");

// Increment by specific amount
await counters.incrementBy("points:user-456", 10);

// Generate auto-increment ID
const orderId = await counters.incrementBy("order:id", 1);

// Bulk operations
await counters.incrementMany({
  "downloads:file1": 1,
  "downloads:file2": 1,
  "downloads:total": 2
});

// Reset counter
await counters.set("page:home:views", 0);
```

---

## LeaderboardController

**Purpose:** Rankings and scoreboards using Redis sorted sets.

**Features:**
- Add/update scores
- Get rankings
- Top N retrieval
- Score ranges
- Rank by score

**Example:**

```typescript
import { LeaderboardController } from "./controllers/LeaderboardController.ts";

const leaderboard = new LeaderboardController(redis, "game"); // Namespace: game:*

// Add/update player score
await leaderboard.addScore("highscores", "player-123", 1500); // Key: game:highscores

// Get top 10 players
const top10 = await leaderboard.getTopN("highscores", 10);
// Returns: [{ member: "player-456", score: 2000, rank: 1 }, ...]

// Get player rank
const rank = await leaderboard.getRank("highscores", "player-123");
console.log(`You are rank #${rank + 1}`);

// Get player score
const score = await leaderboard.getScore("highscores", "player-123");

// Get players around a specific player
const nearby = await leaderboard.getRange("highscores", "player-123", 2);

// Get score range
const midTier = await leaderboard.getByScoreRange("highscores", 1000, 2000);

// Remove player
await leaderboard.remove("highscores", "player-123");
```

---

## LockController

**Purpose:** Distributed locking for coordinating access to shared resources.

**Features:**
- Acquire/release locks
- Lock expiration
- Deadlock prevention
- Automatic lock extension
- Resource protection

**Example:**

```typescript
import { LockController } from "./controllers/LockController.ts";

const locks = new LockController(redis, "payments"); // Namespace: payments:*

// Acquire lock for payment processing
const lockId = await locks.acquire("order-123", 10); // 10 second TTL

if (lockId) {
  try {
    // Critical section - only one process can be here
    await processPayment("order-123");
    console.log("Payment processed successfully");
  } finally {
    // Always release lock
    await locks.release("order-123", lockId);
  }
} else {
  console.log("Order is being processed by another worker");
}

// Try with automatic timeout handling
const success = await locks.withLock(
  "order-456",
  async () => {
    // Your critical code here
    await processPayment("order-456");
  },
  { ttl: 15, retries: 3 }
);
```

---

## PubSubController

**Purpose:** Real-time publish/subscribe messaging for event-driven architecture.

**Features:**
- Publish messages
- Subscribe to channels
- Pattern subscriptions
- Message broadcasting
- Event notifications

**Example:**

```typescript
import { PubSubController } from "./controllers/PubSubController.ts";

const pubsub = new PubSubController(redis, "events"); // Namespace: events:*

// Publisher: Send notifications
await pubsub.publish("user-signup", {
  userId: "user-123",
  email: "alice@example.com",
  timestamp: new Date()
});

// Subscriber: Listen for events
await pubsub.subscribe("user-signup", (message) => {
  console.log("New user signed up:", message);
  sendWelcomeEmail(message.email);
});

// Pattern subscription (all user events)
await pubsub.psubscribe("user-*", (channel, message) => {
  console.log(`Event on ${channel}:`, message);
  logToAnalytics(channel, message);
});

// Broadcast to multiple channels
await pubsub.broadcast({
  "notifications": { type: "system", msg: "Maintenance in 1 hour" },
  "admin-alerts": { type: "warning", msg: "High CPU usage" }
});

// Unsubscribe
await pubsub.unsubscribe("user-signup");
```

---

## FormularyController

**Purpose:** Healthcare formulary management for Medicare Part D drug plans.

**Features:**
- Drug tier management
- Prior authorization tracking
- Step therapy compliance
- Therapeutic class grouping
- Formulary validation

**Example:**

```typescript
import { FormularyController } from "./controllers/FormularyController.ts";

const formulary = new FormularyController(redis, "medicare"); // Namespace: medicare:*

// Add a drug to formulary
await formulary.addDrug("2024", {
  id: "drug-123",
  name: "Lisinopril",
  tier: 1, // Preferred generic
  therapeuticClass: "Antihypertensive",
  requirements: {
    priorAuth: false,
    stepTherapy: false,
    quantityLimit: null
  }
});

// Search drugs by therapeutic class
const antihypertensives = await formulary.searchByTherapeuticClass(
  "2024",
  "Antihypertensive"
);

// Check step therapy compliance
const compliance = await formulary.checkStepTherapyCompliance(
  "2024",
  "drug-456", // Brand name drug
  ["drug-123"] // Patient has tried generic
);

// Submit prior authorization request
const paId = await formulary.submitPriorAuth("2024", {
  drugId: "drug-789",
  patientId: "patient-456",
  prescriberId: "doctor-123",
  reason: "Patient cannot tolerate preferred alternatives"
});

// Validate formulary integrity
const validation = await formulary.validateFormulary("2024");
```

---

## RadAppController

**Purpose:** Rapid application development with automatic namespacing and simplified patterns.

**Features:**
- Automatic key namespacing
- Entity CRUD operations
- Global state management
- Activity feeds
- Auto-increment counters

**Example:**

```typescript
import { RadAppController } from "./controllers/RadAppController.ts";

const app = new RadAppController(redis, "my-todo-app"); // All keys: my-todo-app:*

// 1. Create entities with auto-namespacing
const taskId = await app.incrementCounter("task_id"); // my-todo-app:counter:task_id
await app.saveEntity("tasks", `t${taskId}`, {  // my-todo-app:entity:tasks:t1
  title: "Buy milk",
  done: false,
  createdAt: new Date()
});

// 2. Retrieve entity
const task = await app.getEntity("tasks", "t1");

// 3. Update entity
await app.saveEntity("tasks", "t1", { ...task, done: true });

// 4. Global state (app configuration)
await app.setState("theme", "dark"); // my-todo-app:state:theme
const theme = await app.getState("theme");

// 5. Activity feed
await app.pushToFeed("activity", { // my-todo-app:feed:activity
  action: "task_created",
  taskId: taskId,
  timestamp: new Date()
});

// 6. Get recent activity
const recentActivity = await app.getRecentFeedItems("activity", 10);

// 7. List all tasks
const allTasks = await app.listEntities("tasks");

// 8. Delete entity
await app.deleteEntity("tasks", "t1");
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

// Use namespaces for clean key organization
const sessions = new SessionController(redis, "myapp");
const limiter = new RateLimiterController(redis, "myapp");

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

// Namespace for API cache
const cache = new CacheController(redis, "api");

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

1. **Always Use Namespaces**
   ```typescript
   // ✅ Good: Organized with namespaces
   const sessions = new SessionController(redis, "myapp");
   const cache = new CacheController(redis, "myapp");
   // Keys: myapp:session:*, myapp:cache:*
   
   // ❌ Avoid: No namespace (potential key collisions)
   const sessions = new SessionController(redis);
   ```

2. **Connection Management**
   ```typescript
   // Create one connection, share across controllers
   const redis = await createRedis();
   const sessions = new SessionController(redis, "myapp");
   const cache = new CacheController(redis, "myapp");
   ```

3. **Environment-Specific Namespaces**
   ```typescript
   const env = process.env.NODE_ENV || "development";
   const sessions = new SessionController(redis, `myapp:${env}`);
   // dev: myapp:development:session:*
   // prod: myapp:production:session:*
   ```

4. **Error Handling**
   ```typescript
   try {
     await sessions.create("user-123", data);
   } catch (error) {
     console.error("Session creation failed:", error);
     // Fallback logic
   }
   ```

5. **Graceful Shutdown**
   ```typescript
   process.on("SIGTERM", async () => {
     await redis.close();
     process.exit(0);
   });
   ```

6. **Testing with Isolated Namespaces**
   ```typescript
   // Use unique namespace per test suite
   const testId = Math.random().toString(36);
   const storage = new StorageController(redis, `test:${testId}`);
   
   afterEach(async () => {
     // Clean up test data
     await redis.del(`test:${testId}:*`);
   });
   ```

---

## 📚 Additional Resources

- [Demos](../demos/) - 15 comprehensive examples
- [API Documentation](../docs/API.md) - Complete API reference
- [Quick Reference](../docs/QUICK_REFERENCE.md) - Common patterns
- [Redis Features](../docs/REDIS_FEATURES.md) - Redis data types guide

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
