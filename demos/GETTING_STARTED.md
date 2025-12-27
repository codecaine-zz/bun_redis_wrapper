# Demo Quick Start Guide

## 🎯 What are these demos?

These are **15 comprehensive, production-ready demo applications** that showcase every feature of the Redis Wrapper library. Each demo is a complete, runnable example that you can learn from and adapt for your own projects.

## 🚀 Run Your First Demo

```bash
# Make sure Redis is running
redis-server

# Run the getting started demo
bun run demos/01-getting-started.ts
```

That's it! The demo will show you basic Redis operations in action.

## 📊 Choose Your Path

### 🟢 New to Redis? Start here:
1. `01-getting-started.ts` - Learn the basics (5 min)
2. `02-session-management.ts` - Build something useful (10 min)
3. `05-leaderboard.ts` - Fun with rankings (10 min)

### 🟡 Want to optimize your app? Try these:
1. `03-caching-strategies.ts` - Speed up your database (15 min)
2. `04-rate-limiting.ts` - Protect your API (15 min)
3. `08-analytics-hyperloglog.ts` - Track millions of users (10 min)

### 🔴 Building something advanced? Check out:
1. `06-event-logging.ts` - Event sourcing patterns (15 min)
2. `09-multi-tenant.ts` - SaaS architecture (15 min)
3. `10-job-queue.ts` - Background processing (15 min)

## 🎮 Interactive Runner

Want to browse and run demos interactively?

```bash
bun run demos/run.ts
```

This gives you a menu to explore all demos!

Prefer a non-interactive run (CI-friendly)?

```bash
bun run demos
```

## 📚 What Each Demo Teaches

| Demo | Real-World Use Case | What You'll Build |
|------|---------------------|-------------------|
| **01** | Any app with data | Basic CRUD operations |
| **02** | User login system | Multi-device session manager |
| **03** | Slow database queries | Smart caching layer |
| **04** | Public API | Rate limiter with tiers |
| **05** | Gaming app | Real-time leaderboard |
| **06** | Compliance requirements | Audit log system |
| **07** | Food delivery app | Store locator |
| **08** | Analytics dashboard | DAU/MAU tracker |
| **09** | SaaS platform | Multi-tenant architecture |
| **10** | Email service | Job queue system |

## 💡 Quick Tips

### Running Multiple Demos
```bash
# Run the full demo suite (recommended)
bun run demos
```

### Using Different Redis Instances
```bash
# Use custom Redis URL
REDIS_URL=redis://localhost:6380 bun run demos/01-getting-started.ts
```

### Reading the Code
Each demo follows the same structure:
1. **Types** - Data structures used
2. **Classes** - Reusable business logic
3. **Demo** - Actual examples with output
4. **Best Practices** - What you should remember

## 🎓 Learning Strategy

### Day 1: Foundations (1 hour)
- Run demos 01, 11, 02
- Read the code comments
- Experiment with changing values
- Understand CRUD operations

### Day 2: Advanced Features (1 hour)
- Run demos 04, 05, 06, 07
- Understand different data types
- Try modifying examples

### Day 3: Production Patterns (1 hour)
- Run demos 08, 09, 10
- Study the architecture
- Plan your own implementation

## 🛠️ Customizing Demos

All demos are self-contained and easy to modify:

```typescript
// In any demo file, change these to experiment:

// Change the data
const users = ["alice", "bob", "charlie"]; // Add your names!

// Change the timing
await Bun.sleep(1000); // Make it slower to see what happens

// Change the limits
const maxUsers = 100; // Set your own quotas

// Add logging
console.log("Debug:", someVariable); // See what's happening
```

## 🐛 Troubleshooting

### "Connection refused"
```bash
# Redis isn't running. Start it:
redis-server

# Or with Docker:
docker run -d -p 6379:6379 redis:latest
```

### "Module not found"
```bash
# Install dependencies:
bun install
```

### "Permission denied"
```bash
# Make files executable:
chmod +x demos/*.ts
```

## 📖 Next Steps

After running the demos:

1. **Read the full [API Documentation](../docs/API.md)**
2. **Check out [REDIS_FEATURES.md](../docs/REDIS_FEATURES.md)** for Redis coverage
3. **Look at [tests/index.test.ts](../tests/index.test.ts)** for test examples
4. **Start building your own application!**

## 🤝 Get Help

- 📘 **Stuck on a demo?** Read the comments in the demo file
- 🔍 **Need more details?** Check the [README](README.md) in this folder
- 💬 **Have questions?** Open an issue on GitHub
- ⭐ **Find it useful?** Star the repo!

## ✨ Pro Tips

1. **Run demos twice** - First to see what happens, second to understand why
2. **Modify and break things** - Best way to learn is experimentation
3. **Read the cleanup code** - Shows you how to properly manage Redis data
4. **Check the "Best Practices"** - Every demo ends with key takeaways
5. **Compare similar demos** - See different approaches to similar problems

---

**Ready to start? Run your first demo:**

```bash
bun run demos/01-getting-started.ts
```

**Happy learning! 🚀**
