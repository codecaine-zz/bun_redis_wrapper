# Redis Wrapper Demo Applications

Comprehensive demo applications showcasing the entire Redis Wrapper API with real-world use cases and best practices.

## 📚 Demo Index

| Demo | Focus Area | Key Features | Difficulty |
|------|------------|--------------|------------|
| [00-basic-usage.ts](#00-basic-usage) | Basic Usage | Simple connection and operations | ⭐ Beginner |
| [01-getting-started.ts](#01-getting-started) | Core Concepts | GET, SET, JSON, TTL | ⭐ Beginner |
| [02-session-management.ts](#02-session-management) | Session System | User sessions, multi-device, expiration | ⭐⭐ Intermediate |
| [03-caching-strategies.ts](#03-caching-strategies) | Caching Patterns | Cache-aside, write-through, warming | ⭐⭐ Intermediate |
| [04-rate-limiting.ts](#04-rate-limiting) | Rate Limiting | Fixed window, sliding window, token bucket | ⭐⭐⭐ Advanced |
| [05-leaderboard.ts](#05-leaderboard) | Sorted Sets | Rankings, scores, leaderboards | ⭐⭐ Intermediate |
| [06-event-logging.ts](#06-event-logging) | Streams | Event sourcing, audit logs, tracking | ⭐⭐⭐ Advanced |
| [07-location-services.ts](#07-location-services) | Geospatial | Proximity search, distance calculation | ⭐⭐ Intermediate |
| [08-analytics-hyperloglog.ts](#08-analytics-hyperloglog) | HyperLogLog | Unique counting, DAU/MAU tracking | ⭐⭐ Intermediate |
| [09-multi-tenant.ts](#09-multi-tenant) | Multi-Tenancy | Tenant isolation, quotas, namespaces | ⭐⭐⭐ Advanced |
| [10-job-queue.ts](#10-job-queue) | Job Queue | Background jobs, priorities, retries | ⭐⭐⭐ Advanced |
| [11-environment-namespaces-cms.ts](#11-environment-namespaces-cms) | Environment Isolation | Dev/staging/prod, CRUD, CMS | ⭐⭐ Intermediate |
| [12-healthcare-formulary.ts](#12-healthcare-formulary) | Healthcare | Formulary, PA, Step Therapy | ⭐⭐⭐ Advanced |
| [13-rad-app-development.ts](#13-rad-app-development) | RAD | Rapid App Development, Namespaces | ⭐⭐ Intermediate |
| [14-controller-app.ts](#14-controller-app) | Full Application | All controllers integrated | ⭐⭐⭐ Advanced |

## 🚀 Quick Start

### Prerequisites

```bash
# Make sure Redis is running
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

### Running Demos

```bash
# Run any demo
bun run demos/01-getting-started.ts

# Or with custom Redis URL
REDIS_URL=redis://localhost:6379 bun run demos/02-session-management.ts
```

---

## 📖 Demo Descriptions

### 01-getting-started

**Basic Redis Operations**

Learn the fundamentals of the Redis wrapper with simple, practical examples.

**What you'll learn:**
- Connecting to Redis
- String operations (GET, SET, DEL)
- Working with numbers (INCR, DECR)
- JSON serialization helpers
- Multi-key operations (MGET, MSET)
- Pattern matching (SCAN)
- TTL management

**Use cases:**
- Simple key-value storage
- Configuration management
- Basic caching

```bash
bun run demos/01-getting-started.ts
```

---

### 02-session-management

**Complete Session Management System**

Build a production-ready session manager with user authentication, multi-device support, and automatic expiration.

**What you'll learn:**
- Session creation and validation
- Multi-device session tracking
- Session expiration with TTL
- Logout (single and all devices)
- Session statistics

**Use cases:**
- User authentication systems
- Multi-device login management
- Session analytics
- Security auditing

```bash
bun run demos/02-session-management.ts
```

**Key Classes:**
- `SessionManager` - Complete session lifecycle management

---

### 03-caching-strategies

**Caching Patterns and Best Practices**

Explore different caching strategies with real-world examples and performance comparisons.

**What you'll learn:**
- Cache-aside (lazy loading)
- Write-through cache
- Cache invalidation
- Cache warming
- Multi-level caching
- Cache statistics

**Use cases:**
- Database query caching
- API response caching
- Computed result caching
- Product catalogs

```bash
bun run demos/03-caching-strategies.ts
```

**Strategies covered:**
1. **Cache-Aside**: Load on demand, update cache on hit
2. **Write-Through**: Update cache and DB simultaneously
3. **Cache Invalidation**: Remove stale data
4. **Cache Warming**: Pre-populate frequently accessed data
5. **Multi-Level**: Cache aggregated/computed results

---

### 04-rate-limiting

**Advanced Rate Limiting Techniques**

Implement robust rate limiting with multiple algorithms and multi-tier support.

**What you'll learn:**
- Fixed window rate limiting
- Sliding window (more accurate)
- Token bucket algorithm
- Multi-tier limits (user + IP)
- API tier differentiation

**Use cases:**
- API rate limiting
- DDoS protection
- Resource quota management
- Tiered access control

```bash
bun run demos/04-rate-limiting.ts
```

**Algorithms:**
- **Fixed Window**: Simple, fast, can burst at boundaries
- **Sliding Window**: Accurate, prevents edge-case bursts
- **Token Bucket**: Smooth limiting with burst capacity
- **Multi-Tier**: Combine user and IP limits

---

### 05-leaderboard

**Leaderboard System with Sorted Sets**

Build gaming leaderboards, rankings, and scoring systems using Redis Sorted Sets.

**What you'll learn:**
- Adding and updating scores
- Getting top N players
- Rank lookups
- Score range queries
- Contextual rankings
- Multiple leaderboards

**Use cases:**
- Gaming leaderboards
- Contest rankings
- Performance metrics
- Popularity rankings
- Tournament brackets

```bash
bun run demos/05-leaderboard.ts
```

**Features:**
- Real-time score updates
- Efficient rank calculations
- Range queries by score
- Multiple concurrent leaderboards
- Time-based leaderboards (daily, weekly, all-time)

---

### 06-event-logging

**Event Sourcing with Redis Streams**

Implement event logging, audit trails, and activity tracking using Redis Streams.

**What you'll learn:**
- Event logging with streams
- Time-range queries
- User activity tracking
- Event statistics
- Stream trimming
- Audit trails

**Use cases:**
- User activity logs
- Admin audit trails
- Application event tracking
- Order lifecycle tracking
- Error logging
- Analytics pipelines

```bash
bun run demos/06-event-logging.ts
```

**Real-world examples:**
- User login/logout tracking
- Admin action auditing
- E-commerce order tracking
- Application error logging

---

### 07-location-services

**Geospatial Features for Location-Based Services**

Build location-aware applications with proximity search and distance calculations.

**What you'll learn:**
- Storing locations with coordinates
- Distance calculations
- Proximity search (radius)
- Finding nearby locations
- Location-based queries

**Use cases:**
- Store locators
- Delivery services
- Restaurant finders
- Real estate search
- Ride-sharing matching
- Location-based notifications

```bash
bun run demos/07-location-services.ts
```

**Features:**
- Store locations with lat/lng
- Calculate distances (km, mi, m, ft)
- Find locations within radius
- Get nearest locations
- Sort by proximity

---

### 08-analytics-hyperloglog

**Memory-Efficient Unique Counting**

Track unique visitors and events with minimal memory using HyperLogLog.

**What you'll learn:**
- Unique visitor tracking
- DAU/WAU/MAU calculations
- Cross-platform analytics
- Feature usage tracking
- Memory-efficient counting

**Use cases:**
- Daily Active Users (DAU)
- Unique page views
- Feature adoption metrics
- Campaign reach
- Platform analytics

```bash
bun run demos/08-analytics-hyperloglog.ts
```

**Why HyperLogLog:**
- ~12KB memory regardless of cardinality
- ~0.81% standard error
- Perfect for large-scale analytics
- 1M unique IDs = 12KB (vs 80MB with sets)

---

### 09-multi-tenant

**Multi-Tenant SaaS Application**

Build a complete multi-tenant system with isolation, quotas, and tenant management.

**What you'll learn:**
- Tenant isolation with namespaces
- Per-tenant data management
- Resource quotas and limits
- Feature flags per tenant
- Cross-tenant analytics
- Tenant administration

**Use cases:**
- SaaS applications
- Multi-tenant platforms
- Reseller systems
- White-label solutions
- Environment-based isolation

```bash
bun run demos/09-multi-tenant.ts
```

**Features:**
- Complete data isolation
- Quota enforcement
- Usage tracking
- Feature access control
- Tenant CRUD operations
- GDPR-compliant data export

---

### 10-job-queue

**Background Job Processing System**

Implement a robust job queue with priorities, retries, and worker management.

**What you'll learn:**
- Job submission and queuing
- Priority queue implementation
- Worker processing
- Retry logic with backoff
- Job status tracking
- Batch processing

**Use cases:**
- Email sending
- Report generation
- Data exports
- Image processing
- Scheduled tasks
- Webhook delivery

```bash
bun run demos/10-job-queue.ts
```

**Features:**
- Priority-based processing
- Automatic retries
- Concurrent workers
- Job status tracking
- Failure handling
- Analytics and monitoring

---

### 11-environment-namespaces-cms

**Environment Isolation with Content Management System**

Build a Medicare D formulary CMS with complete environment isolation and full CRUD operations.

**What you'll learn:**
- Environment-based namespaces (dev/staging/prod)
- Complete CRUD operations (Create, Read, Update, Delete)
- Building a content management system
- Medication formulary management
- Data isolation across environments
- Indexing for efficient search
- Safe testing and deployment

**Use cases:**
- Healthcare formulary systems
- Multi-environment applications
- Content management
- Testing and deployment workflows
- Data isolation patterns

```bash
bun run demos/11-environment-namespaces-cms.ts
```

**Key Classes:**
- `FormularyCMS` - Complete CRUD operations with environment isolation

**Features:**
- Full CRUD for medications
- Tier-based indexing
- Generic name search
- Statistics and reporting
- Environment switching
- Safe testing isolation

---

## 🎯 Learning Paths

### Beginner Path
1. **01-getting-started** - Learn basics
2. **11-environment-namespaces-cms** - CRUD with environments
3. **02-session-management** - Build a real feature
4. **05-leaderboard** - Work with sorted data

### Intermediate Path
1. **03-caching-strategies** - Optimize performance
2. **07-location-services** - Geospatial features
3. **08-analytics-hyperloglog** - Efficient analytics

### Advanced Path
1. **04-rate-limiting** - Complex algorithms
2. **06-event-logging** - Event sourcing patterns
3. **09-multi-tenant** - Architecture at scale
4. **10-job-queue** - Async processing

### Full-Stack Path
Study all demos in order to build a complete understanding of Redis capabilities.

---

## 💡 Common Patterns

### Pattern: Namespace Isolation

Used in: 02, 03, 04, 06, 09

```typescript
const app1 = createNamespacedRedis(redis, "app1");
const app2 = createNamespacedRedis(redis, "app2");

// Keys are isolated
await app1.set("key", "value1"); // Stored as "app1:key"
await app2.set("key", "value2"); // Stored as "app2:key"
```

### Pattern: Sorted Sets for Rankings

Used in: 04, 05, 10

```typescript
// Add with scores
await redis.zadd("leaderboard", [100, "player1"], [200, "player2"]);

// Get top 10
await redis.zrevrange("leaderboard", 0, 9, true);
```

### Pattern: Streams for Events

Used in: 06

```typescript
// Add event
const id = await redis.xadd("events", "*", {
  type: "user_login",
  userId: "123",
  timestamp: Date.now().toString()
});

// Read events
const events = await redis.xrange("events", "-", "+");
```

### Pattern: HyperLogLog for Counting

Used in: 08

```typescript
// Track unique visitors
await redis.pfadd("visitors:today", "user1", "user2", "user3");

// Get count
const count = await redis.pfcount("visitors:today");
```

---

## 🔧 Tips & Best Practices

### Performance
- Use pipelining for bulk operations
- Set appropriate TTLs to prevent memory bloat
- Use SCAN instead of KEYS in production
- Consider Redis persistence settings

### Security
- Use namespaces to isolate tenants
- Validate input before storing
- Sanitize user-provided keys
- Use Redis AUTH in production

### Scalability
- Use connection pooling
- Implement proper error handling
- Monitor memory usage
- Consider Redis Cluster for large datasets

### Reliability
- Implement retry logic
- Use Redis persistence (RDB/AOF)
- Set up Redis Sentinel for HA
- Monitor connection health

---

## 🧪 Testing

All demos are self-contained and cleanup after themselves. They're safe to run repeatedly.

```bash
# Run all demos
for demo in demos/*.ts; do
  echo "Running $demo..."
  bun run "$demo"
done
```

---

## 📚 Additional Resources

### Documentation
- [API Reference](../API.md) - Complete API documentation
- [Redis Features](../REDIS_FEATURES.md) - Redis coverage analysis
- [Quick Reference](../QUICK_REFERENCE.md) - Command cheat sheet

### Redis Resources
- [Redis Documentation](https://redis.io/docs/)
- [Redis Commands](https://redis.io/commands/)
- [Redis Data Types](https://redis.io/docs/data-types/)

---

## 🤝 Contributing

Have ideas for new demos? See something that could be improved?

1. Fork the repository
2. Create your demo following the existing pattern
3. Add documentation to this README
4. Submit a pull request

---

## 📝 Demo Template

Want to create your own demo? Use this template:

```typescript
/**
 * Demo N: Your Demo Name
 * 
 * Brief description of what this demo demonstrates.
 * 
 * Run with: bun run demos/NN-your-demo.ts
 */

import { createRedis, createNamespacedRedis } from "../index.ts";

async function main() {
  console.log("🚀 Demo N: Your Demo Name\n");

  await using redis = await createRedis("redis://localhost:6379");

  // Your demo code here

  // Cleanup
  console.log("\n🧹 Cleaning up...");
  // Clean up any keys you created

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
```

---

## 🐛 Troubleshooting

### Redis Connection Failed

```bash
# Make sure Redis is running
redis-cli ping
# Should return: PONG

# Or start Redis
redis-server
```

### Permission Denied

```bash
# Make sure files are executable
chmod +x demos/*.ts
```

### Module Not Found

```bash
# Install dependencies
bun install
```

---

## 📊 Demo Statistics

- **Total Demos**: 11
- **Lines of Code**: ~5,000+
- **Use Cases Covered**: 30+
- **Redis Features**: All major data types
- **Difficulty Levels**: Beginner to Advanced

---

## ✨ What's Next?

After completing these demos, you'll be ready to:

1. Build production-ready Redis applications
2. Implement complex caching strategies
3. Design scalable multi-tenant systems
4. Work with all Redis data types
5. Apply best practices and patterns

**Happy coding!** 🚀
