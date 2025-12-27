/**
 * Demo 1: Getting Started
 * 
 * This demo covers the basics of connecting to Redis and performing
 * common operations like setting, getting, and deleting keys.
 * 
 * Run with: bun run demos/01-getting-started.ts
 */

import { createRedis } from "../src/index.ts";

async function main() {
  console.log("🚀 Demo 1: Getting Started\n");

  // Connect to Redis
  console.log("📡 Connecting to Redis...");
  await using redis = await createRedis("redis://localhost:6379");
  console.log("✅ Connected!\n");

  // ============================================================================
  // Basic String Operations
  // ============================================================================
  console.log("📝 Basic String Operations");
  console.log("─────────────────────────────");

  // Set a value
  await redis.set("demo:greeting", "Hello, Redis!");
  console.log("SET demo:greeting = 'Hello, Redis!'");

  // Get a value
  const greeting = await redis.get("demo:greeting");
  console.log(`GET demo:greeting = '${greeting}'`);

  // Set with options (TTL)
  await redis.set("demo:temporary", "I will expire", { EX: 5 });
  console.log("SET demo:temporary = 'I will expire' (expires in 5s)");

  // Check TTL
  const ttl = await redis.ttl("demo:temporary");
  console.log(`TTL demo:temporary = ${ttl} seconds\n`);

  // ============================================================================
  // Working with Numbers
  // ============================================================================
  console.log("🔢 Working with Numbers");
  console.log("─────────────────────────────");

  // Initialize counter
  await redis.set("demo:counter", 0);
  console.log("SET demo:counter = 0");

  // Increment
  await redis.incr("demo:counter");
  await redis.incr("demo:counter");
  await redis.incr("demo:counter");
  const count = await redis.get("demo:counter");
  console.log(`INCR demo:counter (x3) = ${count}`);

  // Decrement
  await redis.decr("demo:counter");
  const newCount = await redis.get("demo:counter");
  console.log(`DECR demo:counter = ${newCount}\n`);

  // ============================================================================
  // Checking Existence
  // ============================================================================
  console.log("🔍 Checking Existence");
  console.log("─────────────────────────────");

  const exists = await redis.exists("demo:greeting");
  console.log(`EXISTS demo:greeting = ${exists}`);

  const notExists = await redis.exists("demo:nonexistent");
  console.log(`EXISTS demo:nonexistent = ${notExists}\n`);

  // ============================================================================
  // Deleting Keys
  // ============================================================================
  console.log("🗑️  Deleting Keys");
  console.log("─────────────────────────────");

  await redis.set("demo:delete1", "value1");
  await redis.set("demo:delete2", "value2");
  console.log("Created demo:delete1 and demo:delete2");

  const deleted = await redis.del("demo:delete1", "demo:delete2");
  console.log(`DEL demo:delete1, demo:delete2 = ${deleted} keys deleted\n`);

  // ============================================================================
  // JSON Operations
  // ============================================================================
  console.log("📦 JSON Operations");
  console.log("─────────────────────────────");

  // Store JSON object
  const user = {
    id: 123,
    name: "Alice",
    email: "alice@example.com",
    roles: ["admin", "user"]
  };

  await redis.setJSON("demo:user:123", user);
  console.log("SET demo:user:123 =", JSON.stringify(user, null, 2));

  // Retrieve JSON object
  const retrievedUser = await redis.getJSON<typeof user>("demo:user:123");
  console.log("\nGET demo:user:123 =", JSON.stringify(retrievedUser, null, 2));

  // Type-safe access
  if (retrievedUser) {
    console.log(`User name: ${retrievedUser.name}`);
    console.log(`User roles: ${retrievedUser.roles.join(", ")}\n`);
  }

  // ============================================================================
  // Multi Operations
  // ============================================================================
  console.log("🔄 Multi Operations");
  console.log("─────────────────────────────");

  // Set multiple keys at once
  await redis.mset({
    "demo:key1": "value1",
    "demo:key2": "value2",
    "demo:key3": "value3"
  });
  console.log("MSET demo:key1, demo:key2, demo:key3");

  // Get multiple keys at once
  const values = await redis.mget("demo:key1", "demo:key2", "demo:key3");
  console.log("MGET demo:key1, demo:key2, demo:key3 =", values, "\n");

  // ============================================================================
  // Pattern Matching
  // ============================================================================
  console.log("🔎 Pattern Matching");
  console.log("─────────────────────────────");

  // Scan for keys matching pattern
  const demoKeys = await redis.scanAll("demo:*");
  console.log(`Found ${demoKeys.length} keys matching 'demo:*':`);
  demoKeys.slice(0, 5).forEach(key => console.log(`  - ${key}`));
  if (demoKeys.length > 5) {
    console.log(`  ... and ${demoKeys.length - 5} more`);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up demo keys...");
  if (demoKeys.length > 0) {
    await redis.del(...demoKeys);
    console.log(`✅ Deleted ${demoKeys.length} demo keys`);
  }

  console.log("\n✨ Demo complete! Connection will auto-close.");
}

// Run the demo
main().catch(console.error);
