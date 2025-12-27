# Project Structure

This guide explains how the Bun Redis Wrapper is organized for easy navigation and use.

## 📁 Directory Structure

```
bun_redis_wrapper/
├── src/                      # 📦 Source Code
│   ├── index.ts             # Main exports
│   ├── redis-wrapper.ts     # Core Redis wrapper
│   └── controllers/         # 🎯 Production-ready controllers
│       ├── README.md        # Controllers documentation
│       ├── index.ts         # Export all controllers
│       ├── SessionController.ts
│       ├── CacheController.ts
│       ├── RateLimiterController.ts
│       ├── QueueController.ts
│       ├── StorageController.ts
│       ├── AnalyticsController.ts
│       ├── FormularyController.ts
│       ├── RadAppController.ts
│       └── ...
│
├── demos/                    # 🎓 Learning Examples (14 demos)
│   ├── README.md            # Demos index
│   ├── 00-basic-usage.ts    # Basic usage example
│   ├── 01-getting-started.ts
│   ├── ...
│   ├── 14-controller-app.ts # Full application example
│   └── run.ts               # Interactive demo runner
│
├── tests/                    # 🧪 Tests
│   └── index.test.ts        # Test suite
│
├── docs/                     # 📚 Documentation
│   ├── API.md               # Complete API reference
│   ├── QUICK_REFERENCE.md   # Common patterns
│   ├── REDIS_FEATURES.md    # Redis features coverage
│   └── ...
│
├── dist/                     # 🏗️ Build Output
├── package.json
├── tsconfig.json
└── README.md
│   └── SUMMARY.md           # Project summary
│
└── Configuration
    ├── package.json
    ├── tsconfig.json
    └── example.ts           # Basic usage examples
```

## 🎯 Where to Start

### For Beginners Building Apps

1. **Start with Controllers** → [controllers/README.md](controllers/README.md)
   - Production-ready drop-in solutions
   - Clear examples for common use cases
   - Type-safe and well-documented

2. **Run Example App** → `bun run demos/14-controller-app.ts`
   - See all controllers in action
   - Real-world usage patterns
   - Production tips

3. **Pick What You Need**
   - **Authentication?** → Use `SessionController`
   - **API Protection?** → Use `RateLimiterController`
   - **Speed up app?** → Use `CacheController`
   - **Background tasks?** → Use `QueueController`
   - **Store settings?** → Use `StorageController`
   - **Track metrics?** → Use `AnalyticsController`
   - **Healthcare/Pharmacy?** → Use `FormularyController`
   - **Build app fast?** → Use `RadAppController`

### For Learning Redis Concepts

1. **Explore Demos** → [demos/README.md](demos/README.md)
   - 15 comprehensive examples
   - All Redis data types covered
   - Best practices included

2. **Interactive Learning** → `bun run demos/run.ts`
   - Menu-driven demo runner
   - Run demos interactively
   - See output immediately

3. **Run Everything (non-interactive)** → `bun run demos`
   - Runs the full demo suite end-to-end
   - CI-friendly

4. **Follow Learning Paths**
   - **Beginner Path**: demos 01 → 11 → 02 → 05
   - **Advanced Path**: demos 04 → 06 → 07 → 08 → 09 → 10
   - **Full Path**: Complete all 15 demos in order

### For Advanced Users

1. **API Reference** → [API.md](API.md)
   - Complete method documentation
   - All parameters explained
   - Return types specified

2. **Quick Reference** → [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
   - Common patterns
   - Quick code snippets
   - Troubleshooting tips

3. **Core Wrapper** → [redis-wrapper.ts](redis-wrapper.ts)
   - Direct Redis access
   - All Redis commands
   - Low-level control

## 🏗️ Usage Patterns

### Pattern 1: Production Application (Recommended)

```typescript
import { createRedis } from "./index.ts";
import {
  SessionController,
  CacheController,
  RateLimiterController
} from "./controllers/index.ts";

// One connection, multiple controllers
const redis = await createRedis();
const sessions = new SessionController(redis);
const cache = new CacheController(redis);
const limiter = new RateLimiterController(redis);

// Use in your app
const sessionId = await sessions.create("user-123", { name: "Alice" });
const data = await cache.getOrSet("key", () => loadData(), 300);
const allowed = await limiter.check("user-123", 100, 60);
```

### Pattern 2: Direct Wrapper Usage

```typescript
import { createRedis, createNamespacedRedis } from "./index.ts";

// Base connection
await using redis = await createRedis();

// Direct usage
await redis.set("key", "value");
await redis.get("key");

// With namespaces
const app1 = createNamespacedRedis(redis, "app1");
const app2 = createNamespacedRedis(redis, "app2");
```

### Pattern 3: Learning & Experimentation

```typescript
// Run individual demos
import "./demos/01-getting-started.ts";

// Or use the interactive runner
import "./demos/run.ts";
```

## 📦 What Each File Does

### Controllers (Production Code)

| File | Purpose | When to Use |
|------|---------|-------------|
| `SessionController.ts` | User session management | Authentication, login/logout |
| `CacheController.ts` | Application caching | Speed up DB queries, API calls |
| `RateLimiterController.ts` | Rate limiting | Protect APIs, prevent abuse |
| `QueueController.ts` | Background jobs | Email, image processing, async tasks |
| `StorageController.ts` | Key-value storage | User settings, configurations |
| `AnalyticsController.ts` | Metrics tracking | Page views, user activity |
| `FormularyController.ts` | Healthcare formulary CRUD | Medicare Part D, drug management, PA/step therapy |

### Demos (Learning Material)

| Demo | Teaches | Difficulty |
|------|---------|------------|
| 01 | Redis basics | ⭐ Beginner |
| 02 | Session management | ⭐⭐ Intermediate |
| 03 | Caching strategies | ⭐⭐ Intermediate |
| 04 | Rate limiting | ⭐⭐ Intermediate |
| 05 | Leaderboards | ⭐⭐ Intermediate |
| 06 | Event logging | ⭐⭐⭐ Advanced |
| 07 | Geospatial | ⭐⭐⭐ Advanced |
| 08 | HyperLogLog | ⭐⭐⭐ Advanced |
| 09 | Multi-tenancy | ⭐⭐⭐ Advanced |
| 10 | Job queues | ⭐⭐⭐ Advanced |
| 11 | Environment isolation | ⭐⭐ Intermediate |
| 12 | Healthcare formulary CRUD | ⭐⭐ Intermediate |

### Documentation Files

| File | Contains | Best For |
|------|----------|----------|
| `README.md` | Overview, quick start | First-time users |
| `controllers/README.md` | Controller guide | Building apps |
| `demos/README.md` | Demo index | Learning Redis |
| `API.md` | Complete API docs | Reference |
| `QUICK_REFERENCE.md` | Code snippets | Quick lookup |
| `REDIS_FEATURES.md` | Feature coverage | Understanding capabilities |

## 🚀 Quick Commands

```bash
# Run example application
bun run demos/14-controller-app.ts

# Run interactive demo menu
bun run demos/run.ts

# Run specific demo
bun run demos/01-getting-started.ts

# Run tests
bun test

# Start your own project
import { createRedis } from "./index.ts";
import { SessionController } from "./controllers/index.ts";
```

## 📚 Learning Progression

1. **Day 1**: Controllers
   - Read [controllers/README.md](controllers/README.md)
   - Run `bun run demos/14-controller-app.ts`
   - Pick 1-2 controllers for your app

2. **Day 2-3**: Core Concepts
   - Run demos 01, 11, 02, 03
   - Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
   - Understand namespaces

3. **Week 1**: Advanced Features
   - Run demos 04-10
   - Read [API.md](API.md)
   - Implement in your app

4. **Ongoing**: Reference
   - Use [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for patterns
   - Check [API.md](API.md) for methods
   - Review demos for best practices

## 🤔 Decision Tree

**"I want to..."**

- ✅ Build an app → Use **controllers/**
- ✅ Learn Redis → Read **demos/**
- ✅ Understand API → Read **API.md**
- ✅ Quick lookup → Read **QUICK_REFERENCE.md**
- ✅ See examples → Run **demos/14-controller-app.ts**
- ✅ Deep dive → Read source code in **redis-wrapper.ts**

## 💡 Pro Tips

1. **Start Simple**: Begin with controllers, they handle complexity for you
2. **Learn by Doing**: Run the example app and demos
3. **Read Code**: Controllers have excellent inline documentation
4. **Use TypeScript**: Full type safety helps catch errors early
5. **Test Locally**: All examples work with local Redis (default port 6379)
6. **Explore Gradually**: Don't try to learn everything at once
7. **Ask Questions**: Code comments explain the "why" not just the "what"

## 🎯 Next Steps

1. Choose your path:
   - **Building?** → Start with [controllers/README.md](controllers/README.md)
   - **Learning?** → Start with [demos/README.md](demos/README.md)

2. Run the examples:
   ```bash
   bun run demos/14-controller-app.ts
   ```

3. Pick what you need and integrate into your project!

---

**Questions?** Check the documentation files or run the examples to see everything in action!
