/**
 * Example Usage of Redis Namespace Wrapper
 * 
 * Prerequisites:
 * - Redis server running (default: localhost:6379)
 * - Or set REDIS_URL environment variable
 * 
 * Run with: bun run example.ts
 */

import { createRedis, createNamespacedRedis, clearNamespace } from "../src/index.ts";

async function main() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  console.log(`🔌 Connecting to Redis at ${url}\n`);

  // Create base connection using async dispose pattern
  await using redis = await createRedis(url);

  console.log("=" .repeat(60));
  console.log("Example 1: Basic Namespace Usage");
  console.log("=" .repeat(60) + "\n");

  // Create namespaced clients
  const authApp = createNamespacedRedis(redis, "auth");
  const shopApp = createNamespacedRedis(redis, "shop");

  // Same key, different namespaces - no collision!
  await authApp.set("user:123", "auth-data");
  await shopApp.set("user:123", "shop-data");

  console.log("Auth user:123:", await authApp.get("user:123")); // "auth-data"
  console.log("Shop user:123:", await shopApp.get("user:123")); // "shop-data"

  console.log("\n" + "=".repeat(60));
  console.log("Example 2: JSON Storage");
  console.log("=" .repeat(60) + "\n");

  interface UserProfile {
    id: number;
    name: string;
    email: string;
    roles: string[];
  }

  const userApp = createNamespacedRedis(redis, "users");

  const profile: UserProfile = {
    id: 456,
    name: "Alice",
    email: "alice@example.com",
    roles: ["admin", "user"]
  };

  // Store JSON with 1 hour TTL
  await userApp.setJSON("profile:456", profile, { EX: 3600 });
  
  const retrieved = await userApp.getJSON<UserProfile>("profile:456");
  console.log("Stored profile:", JSON.stringify(retrieved, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("Example 3: Counter Operations");
  console.log("=" .repeat(60) + "\n");

  const analytics = createNamespacedRedis(redis, "analytics");

  // Track page views
  await analytics.set("views:home", 0);
  await analytics.incr("views:home");
  await analytics.incr("views:home");
  await analytics.incr("views:home");

  console.log("Home page views:", await analytics.get("views:home")); // "3"

  console.log("\n" + "=".repeat(60));
  console.log("Example 4: Hash Operations");
  console.log("=" .repeat(60) + "\n");

  const cache = createNamespacedRedis(redis, "cache");

  // Store user data in hash
  await cache.hmset("user:789", {
    name: "Bob",
    age: "30",
    city: "NYC"
  });

  const userData = await cache.hgetAll("user:789");
  console.log("User data:", userData);

  console.log("\n" + "=".repeat(60));
  console.log("Example 5: List Operations");
  console.log("=" .repeat(60) + "\n");

  const queue = createNamespacedRedis(redis, "queue");

  // Add tasks to queue
  await queue.rpush("tasks", "task1", "task2", "task3");
  
  // Get all tasks
  const tasks = await queue.lrange("tasks", 0, -1);
  console.log("Tasks in queue:", tasks);

  // Process first task
  const firstTask = await queue.lpop("tasks");
  console.log("Processing:", firstTask);

  console.log("\n" + "=".repeat(60));
  console.log("Example 6: Set Operations");
  console.log("=" .repeat(60) + "\n");

  const tags = createNamespacedRedis(redis, "tags");

  // Add tags
  await tags.sadd("article:1:tags", "redis", "database", "cache");
  await tags.sadd("article:2:tags", "javascript", "nodejs", "cache");

  // Get all tags
  const article1Tags = await tags.smembers("article:1:tags");
  console.log("Article 1 tags:", article1Tags);

  console.log("\n" + "=".repeat(60));
  console.log("Example 7: Pattern Matching");
  console.log("=" .repeat(60) + "\n");

  const sessions = createNamespacedRedis(redis, "sessions");

  // Create multiple sessions
  await sessions.set("session:user:1", "data1");
  await sessions.set("session:user:2", "data2");
  await sessions.set("session:user:3", "data3");
  await sessions.set("config:timeout", "30");

  // Find all sessions (scoped to namespace)
  const sessionKeys = await sessions.scanAll("session:*");
  console.log("Session keys:", sessionKeys);

  console.log("\n" + "=".repeat(60));
  console.log("Example 8: Multi-Tenant Application");
  console.log("=" .repeat(60) + "\n");

  const tenant1 = createNamespacedRedis(redis, "tenant:acme");
  const tenant2 = createNamespacedRedis(redis, "tenant:globex");

  // Each tenant has isolated config
  await tenant1.setJSON("config", { theme: "dark", lang: "en" });
  await tenant2.setJSON("config", { theme: "light", lang: "es" });

  console.log("Tenant ACME config:", await tenant1.getJSON("config"));
  console.log("Tenant Globex config:", await tenant2.getJSON("config"));

  console.log("\n" + "=".repeat(60));
  console.log("Example 9: Rate Limiting");
  console.log("=" .repeat(60) + "\n");

  const api = createNamespacedRedis(redis, "api:v1");

  async function checkRateLimit(userId: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    const key = `ratelimit:${userId}`;
    const count = await api.incr(key);
    
    if (count === 1) {
      await api.setTTL(key, windowSeconds);
    }
    
    return count <= maxRequests;
  }

  // Test rate limiting (10 requests per 60 seconds)
  for (let i = 1; i <= 12; i++) {
    const allowed = await checkRateLimit("user:999", 10, 60);
    console.log(`Request ${i}: ${allowed ? "✅ Allowed" : "❌ Rate limited"}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Example 10: Cleanup");
  console.log("=" .repeat(60) + "\n");

  // Clear specific namespaces
  const deletedAuth = await clearNamespace(redis, "auth");
  const deletedShop = await clearNamespace(redis, "shop");
  const deletedUsers = await clearNamespace(redis, "users");
  const deletedAnalytics = await clearNamespace(redis, "analytics");
  const deletedCache = await clearNamespace(redis, "cache");
  const deletedQueue = await clearNamespace(redis, "queue");
  const deletedTags = await clearNamespace(redis, "tags");
  const deletedSessions = await clearNamespace(redis, "sessions");
  const deletedTenant1 = await clearNamespace(redis, "tenant:acme");
  const deletedTenant2 = await clearNamespace(redis, "tenant:globex");
  const deletedApi = await clearNamespace(redis, "api:v1");

  console.log(`Cleaned up ${deletedAuth + deletedShop + deletedUsers + deletedAnalytics + 
    deletedCache + deletedQueue + deletedTags + deletedSessions + deletedTenant1 + 
    deletedTenant2 + deletedApi} keys total`);

  console.log("\n✅ Examples completed successfully!");
  console.log("🔌 Connection will auto-close (using await using syntax)");
}

// Run examples
if (import.meta.main) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
