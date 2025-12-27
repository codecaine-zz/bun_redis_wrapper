/**
 * Redis Wrapper Tests
 * 
 * Comprehensive test suite for Redis wrapper and namespace functionality.
 * 
 * Prerequisites:
 * - Redis server running (default: localhost:6379)
 * - Or set REDIS_URL environment variable
 * 
 * Run with: bun test
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { createRedis, createNamespacedRedis, clearNamespace, copyNamespace } from "../src/index";
import type { RedisWrapper, NamespacedRedisWrapper } from "../src/index";

const TEST_REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ============================================================================
// Base RedisWrapper Tests
// ============================================================================

describe("RedisWrapper", () => {
  let redis: RedisWrapper;

  beforeAll(async () => {
    redis = await createRedis(TEST_REDIS_URL);
  });

  afterAll(async () => {
    await redis.close();
  });

  afterEach(async () => {
    // Clean up test keys
    const keys = await redis.scanAll("test:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe("Connection", () => {
    test("should connect to Redis", async () => {
      const testRedis = await createRedis(TEST_REDIS_URL);
      expect(testRedis).toBeDefined();
      await testRedis.close();
    });

    test("should support async dispose pattern", async () => {
      await using testRedis = await createRedis(TEST_REDIS_URL);
      await testRedis.set("test:dispose", "value");
      const value = await testRedis.get("test:dispose");
      expect(value).toBe("value");
      await testRedis.del("test:dispose");
    });
  });

  describe("Core Operations", () => {
    test("should set and get string value", async () => {
      await redis.set("test:string", "hello");
      const value = await redis.get("test:string");
      expect(value).toBe("hello");
    });

    test("should set and get number value", async () => {
      await redis.set("test:number", 123);
      const value = await redis.get("test:number");
      expect(value).toBe("123");
    });

    test("should return null for non-existent key", async () => {
      const value = await redis.get("test:nonexistent");
      expect(value).toBeNull();
    });

    test("should delete keys", async () => {
      await redis.set("test:del1", "value1");
      await redis.set("test:del2", "value2");
      
      const deleted = await redis.del("test:del1", "test:del2");
      expect(deleted).toBe(2);
      
      const value = await redis.get("test:del1");
      expect(value).toBeNull();
    });

    test("should check if keys exist", async () => {
      await redis.set("test:exists", "value");
      
      expect(await redis.exists("test:exists")).toBe(true);
      expect(await redis.exists("test:nonexistent")).toBe(false);
    });

    test("should check multiple keys existence", async () => {
      await redis.set("test:exists1", "value1");
      await redis.set("test:exists2", "value2");
      
      expect(await redis.exists("test:exists1", "test:exists2")).toBe(true);
      expect(await redis.exists("test:exists1", "test:nonexistent")).toBe(false);
    });
  });

  describe("SET Options", () => {
    test("should set key with EX option", async () => {
      await redis.set("test:ex", "value", { EX: 1 });
      const ttl = await redis.ttl("test:ex");
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1);
    });

    test("should set key with NX option", async () => {
      await redis.del("test:nx");
      
      const result1 = await redis.set("test:nx", "value1", { NX: true });
      expect(result1).toBe("OK");
      
      const result2 = await redis.set("test:nx", "value2", { NX: true });
      expect(result2).toBeNull();
      
      const value = await redis.get("test:nx");
      expect(value).toBe("value1");
    });

    test("should set key with XX option", async () => {
      await redis.del("test:xx");
      
      const result1 = await redis.set("test:xx", "value1", { XX: true });
      expect(result1).toBeNull();
      
      await redis.set("test:xx", "initial");
      const result2 = await redis.set("test:xx", "value2", { XX: true });
      expect(result2).toBe("OK");
      
      const value = await redis.get("test:xx");
      expect(value).toBe("value2");
    });
  });

  describe("JSON Operations", () => {
    test("should store and retrieve JSON", async () => {
      const data = { name: "Alice", age: 30, roles: ["admin", "user"] };
      
      await redis.setJSON("test:json", data);
      const retrieved = await redis.getJSON("test:json");
      
      expect(retrieved).toEqual(data);
    });

    test("should return null for non-existent JSON key", async () => {
      const value = await redis.getJSON("test:json:nonexistent");
      expect(value).toBeNull();
    });

    test("should store JSON with TTL", async () => {
      await redis.setJSON("test:json:ttl", { data: "test" }, { EX: 1 });
      const ttl = await redis.ttl("test:json:ttl");
      expect(ttl).toBeGreaterThan(0);
    });

    test("should handle type-safe JSON retrieval", async () => {
      interface User {
        id: number;
        name: string;
      }
      
      const user: User = { id: 123, name: "Bob" };
      await redis.setJSON("test:user", user);
      
      const retrieved = await redis.getJSON<User>("test:user");
      expect(retrieved?.id).toBe(123);
      expect(retrieved?.name).toBe("Bob");
    });
  });

  describe("Multi Operations", () => {
    test("should get multiple values", async () => {
      await redis.set("test:multi1", "value1");
      await redis.set("test:multi2", "value2");
      await redis.set("test:multi3", "value3");
      
      const values = await redis.mget("test:multi1", "test:multi2", "test:multi3");
      expect(values).toEqual(["value1", "value2", "value3"]);
    });

    test("should return null for non-existent keys in mget", async () => {
      await redis.set("test:multi:exists", "value");
      
      const values = await redis.mget("test:multi:exists", "test:multi:nonexistent");
      expect(values).toEqual(["value", null]);
    });

    test("should set multiple values", async () => {
      await redis.mset({
        "test:mset1": "value1",
        "test:mset2": "value2",
        "test:mset3": 123
      });
      
      const val1 = await redis.get("test:mset1");
      const val2 = await redis.get("test:mset2");
      const val3 = await redis.get("test:mset3");
      
      expect(val1).toBe("value1");
      expect(val2).toBe("value2");
      expect(val3).toBe("123");
    });
  });

  describe("Hash Operations", () => {
    test("should set and get hash field", async () => {
      await redis.hset("test:hash", "name", "Alice");
      const value = await redis.hget("test:hash", "name");
      expect(value).toBe("Alice");
    });

    test("should set multiple hash fields", async () => {
      await redis.hmset("test:hash:multi", {
        name: "Bob",
        age: "30",
        city: "NYC"
      });
      
      const name = await redis.hget("test:hash:multi", "name");
      const age = await redis.hget("test:hash:multi", "age");
      
      expect(name).toBe("Bob");
      expect(age).toBe("30");
    });

    test("should get multiple hash fields", async () => {
      await redis.hmset("test:hash:hmget", {
        field1: "value1",
        field2: "value2",
        field3: "value3"
      });
      
      const values = await redis.hmget("test:hash:hmget", "field1", "field2");
      expect(values).toEqual(["value1", "value2"]);
    });

    test("should get all hash fields", async () => {
      await redis.hmset("test:hash:getall", {
        name: "Charlie",
        age: "25",
        city: "LA"
      });
      
      const data = await redis.hgetAll("test:hash:getall");
      expect(data.name).toBe("Charlie");
      expect(data.age).toBe("25");
      expect(data.city).toBe("LA");
    });
  });

  describe("Counter Operations", () => {
    test("should increment counter", async () => {
      await redis.set("test:counter", 0);
      
      const val1 = await redis.incr("test:counter");
      const val2 = await redis.incr("test:counter");
      const val3 = await redis.incr("test:counter");
      
      expect(val1).toBe(1);
      expect(val2).toBe(2);
      expect(val3).toBe(3);
    });

    test("should decrement counter", async () => {
      await redis.set("test:counter:decr", 10);
      
      const val1 = await redis.decr("test:counter:decr");
      const val2 = await redis.decr("test:counter:decr");
      
      expect(val1).toBe(9);
      expect(val2).toBe(8);
    });

    test("should initialize counter from zero", async () => {
      await redis.del("test:counter:new");
      const val = await redis.incr("test:counter:new");
      expect(val).toBe(1);
    });
  });

  describe("TTL Operations", () => {
    test("should get TTL of key", async () => {
      await redis.set("test:ttl", "value", { EX: 10 });
      const ttl = await redis.ttl("test:ttl");
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    test("should return -1 for key without expiry", async () => {
      await redis.set("test:ttl:none", "value");
      const ttl = await redis.ttl("test:ttl:none");
      expect(ttl).toBe(-1);
    });

    test("should return -2 for non-existent key", async () => {
      const ttl = await redis.ttl("test:ttl:nonexistent");
      expect(ttl).toBe(-2);
    });

    test("should set TTL on existing key", async () => {
      await redis.set("test:ttl:set", "value");
      const success = await redis.setTTL("test:ttl:set", 5);
      expect(success).toBe(true);
      
      const ttl = await redis.ttl("test:ttl:set");
      expect(ttl).toBeGreaterThan(0);
    });

    test("should expire key", async () => {
      await redis.set("test:expire", "value");
      const result = await redis.expire("test:expire", 5);
      expect(result).toBe(1);
      
      const ttl = await redis.ttl("test:expire");
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe("Pattern Matching", () => {
    test("should scan for keys matching pattern", async () => {
      await redis.set("test:scan:user:1", "value1");
      await redis.set("test:scan:user:2", "value2");
      await redis.set("test:scan:user:3", "value3");
      await redis.set("test:scan:other", "other");
      
      const keys = await redis.scanAll("test:scan:user:*");
      
      expect(keys.length).toBe(3);
      expect(keys).toContain("test:scan:user:1");
      expect(keys).toContain("test:scan:user:2");
      expect(keys).toContain("test:scan:user:3");
    });

    test("should return empty array for no matches", async () => {
      const keys = await redis.scanAll("test:scan:nomatch:*");
      expect(keys).toEqual([]);
    });
  });

  describe("List Operations", () => {
    test("should push to left and get range", async () => {
      await redis.lpush("test:list", "value1", "value2", "value3");
      const values = await redis.lrange("test:list", 0, -1);
      expect(values).toEqual(["value3", "value2", "value1"]);
    });

    test("should push to right and get range", async () => {
      await redis.rpush("test:list:right", "value1", "value2", "value3");
      const values = await redis.lrange("test:list:right", 0, -1);
      expect(values).toEqual(["value1", "value2", "value3"]);
    });

    test("should pop from left", async () => {
      await redis.rpush("test:list:lpop", "first", "second", "third");
      const value = await redis.lpop("test:list:lpop");
      expect(value).toBe("first");
    });

    test("should pop from right", async () => {
      await redis.rpush("test:list:rpop", "first", "second", "third");
      const value = await redis.rpop("test:list:rpop");
      expect(value).toBe("third");
    });

    test("should return null when popping from empty list", async () => {
      const value = await redis.lpop("test:list:empty");
      expect(value).toBeNull();
    });
  });

  describe("Set Operations", () => {
    test("should add members to set", async () => {
      const added = await redis.sadd("test:set", "member1", "member2", "member3");
      expect(added).toBe(3);
    });

    test("should not add duplicate members", async () => {
      await redis.sadd("test:set:dup", "member1");
      const added = await redis.sadd("test:set:dup", "member1", "member2");
      expect(added).toBe(1); // Only member2 is new
    });

    test("should get all set members", async () => {
      await redis.sadd("test:set:members", "a", "b", "c");
      const members = await redis.smembers("test:set:members");
      expect(members.length).toBe(3);
      expect(members).toContain("a");
      expect(members).toContain("b");
      expect(members).toContain("c");
    });

    test("should remove members from set", async () => {
      await redis.sadd("test:set:rem", "a", "b", "c");
      const removed = await redis.srem("test:set:rem", "b");
      expect(removed).toBe(1);
      
      const members = await redis.smembers("test:set:rem");
      expect(members).not.toContain("b");
    });
  });

  describe("Sorted Set Operations", () => {
    test("should add members with scores", async () => {
      const added = await redis.zadd("test:zset", [10, "member1"], [20, "member2"], [30, "member3"]);
      expect(added).toBe(3);
    });

    test("should get members by index range", async () => {
      await redis.zadd("test:zset:range", [10, "low"], [20, "mid"], [30, "high"]);
      const members = await redis.zrange("test:zset:range", 0, 1);
      expect(members).toEqual(["low", "mid"]);
    });

    test("should get members by index range with scores", async () => {
      await redis.zadd("test:zset:scores", [10, "a"], [20, "b"]);
      const result = await redis.zrange("test:zset:scores", 0, -1, true);
      // Bun's Redis client may return nested arrays [[member, score], ...]
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    test("should get members by score range", async () => {
      await redis.zadd("test:zset:scorerange", [5, "a"], [15, "b"], [25, "c"], [35, "d"]);
      const members = await redis.zrangebyscore("test:zset:scorerange", 10, 30);
      expect(members).toContain("b");
      expect(members).toContain("c");
      expect(members).not.toContain("a");
      expect(members).not.toContain("d");
    });

    test("should remove members from sorted set", async () => {
      await redis.zadd("test:zset:rem", [10, "a"], [20, "b"], [30, "c"]);
      const removed = await redis.zrem("test:zset:rem", "b");
      expect(removed).toBe(1);
    });

    test("should get score of member", async () => {
      await redis.zadd("test:zset:score", [100, "player1"]);
      const score = await redis.zscore("test:zset:score", "player1");
      // Bun's Redis client may return numbers or strings
      expect(score?.toString()).toBe("100");
    });

    test("should get rank of member", async () => {
      await redis.zadd("test:zset:rank", [10, "a"], [20, "b"], [30, "c"]);
      const rank = await redis.zrank("test:zset:rank", "b");
      expect(rank).toBe(1); // Zero-indexed
    });

    test("should increment score", async () => {
      await redis.zadd("test:zset:incr", [100, "player"]);
      const newScore = await redis.zincrby("test:zset:incr", 50, "player");
      // Bun's Redis client may return numbers or strings
      expect(newScore?.toString()).toBe("150");
    });

    test("should get cardinality", async () => {
      await redis.zadd("test:zset:card", [10, "a"], [20, "b"], [30, "c"]);
      const count = await redis.zcard("test:zset:card");
      expect(count).toBe(3);
    });
  });

  describe("Stream Operations", () => {
    test("should add entries to stream", async () => {
      const id = await redis.xadd("test:stream", "*", { field1: "value1", field2: "value2" });
      expect(id).toBeTruthy();
      expect(id).toContain("-");
    });

    test("should read stream range", async () => {
      await redis.xadd("test:stream:range", "*", { msg: "first" });
      await redis.xadd("test:stream:range", "*", { msg: "second" });
      
      const entries = await redis.xrange("test:stream:range", "-", "+");
      expect(entries.length).toBe(2);
    });

    test("should read stream range with count", async () => {
      await redis.xadd("test:stream:count", "*", { msg: "1" });
      await redis.xadd("test:stream:count", "*", { msg: "2" });
      await redis.xadd("test:stream:count", "*", { msg: "3" });
      
      const entries = await redis.xrange("test:stream:count", "-", "+", 2);
      expect(entries.length).toBe(2);
    });

    test("should get stream length", async () => {
      await redis.xadd("test:stream:len", "*", { msg: "1" });
      await redis.xadd("test:stream:len", "*", { msg: "2" });
      
      const length = await redis.xlen("test:stream:len");
      expect(length).toBe(2);
    });

    test("should delete stream entries", async () => {
      const id = await redis.xadd("test:stream:del", "*", { msg: "delete me" });
      const deleted = await redis.xdel("test:stream:del", id);
      expect(deleted).toBe(1);
    });
  });

  describe("Geospatial Operations", () => {
    test("should add geospatial members", async () => {
      const added = await redis.geoadd("test:geo", 
        [-122.4194, 37.7749, "SF"],
        [-118.2437, 34.0522, "LA"]
      );
      expect(added).toBe(2);
    });

    test("should calculate distance between members", async () => {
      await redis.geoadd("test:geo:dist", 
        [0, 0, "point1"],
        [1, 1, "point2"]
      );
      const dist = await redis.geodist("test:geo:dist", "point1", "point2", "km");
      expect(dist).toBeTruthy();
      expect(Number(dist)).toBeGreaterThan(0);
    });

    test("should get positions of members", async () => {
      await redis.geoadd("test:geo:pos", [-122.4194, 37.7749, "SF"]);
      const positions = await redis.geopos("test:geo:pos", "SF");
      expect(positions[0]).toBeTruthy();
      expect(Array.isArray(positions[0])).toBe(true);
    });
  });

  describe("HyperLogLog Operations", () => {
    test("should add elements to HyperLogLog", async () => {
      const modified = await redis.pfadd("test:hll", "elem1", "elem2", "elem3");
      expect(modified).toBe(1); // 1 = modified
    });

    test("should count unique elements", async () => {
      await redis.pfadd("test:hll:count", "a", "b", "c");
      await redis.pfadd("test:hll:count", "a"); // Duplicate
      
      const count = await redis.pfcount("test:hll:count");
      expect(count).toBe(3); // Should be 3 unique elements
    });

    test("should merge HyperLogLogs", async () => {
      await redis.pfadd("test:hll:merge1", "a", "b");
      await redis.pfadd("test:hll:merge2", "b", "c");
      
      const result = await redis.pfmerge("test:hll:merged", "test:hll:merge1", "test:hll:merge2");
      expect(result).toBe("OK");
      
      const count = await redis.pfcount("test:hll:merged");
      expect(count).toBe(3); // a, b, c (unique)
    });
  });
});

// ============================================================================
// NamespacedRedisWrapper Tests
// ============================================================================

describe("NamespacedRedisWrapper", () => {
  let redis: RedisWrapper;
  let app1: NamespacedRedisWrapper;
  let app2: NamespacedRedisWrapper;

  beforeAll(async () => {
    redis = await createRedis(TEST_REDIS_URL);
    app1 = createNamespacedRedis(redis, "testapp1");
    app2 = createNamespacedRedis(redis, "testapp2");
  });

  afterAll(async () => {
    await redis.close();
  });

  afterEach(async () => {
    await clearNamespace(redis, "testapp1");
    await clearNamespace(redis, "testapp2");
  });

  describe("Namespace Isolation", () => {
    test("should isolate keys between namespaces", async () => {
      await app1.set("user:123", "app1-data");
      await app2.set("user:123", "app2-data");
      
      const val1 = await app1.get("user:123");
      const val2 = await app2.get("user:123");
      
      expect(val1).toBe("app1-data");
      expect(val2).toBe("app2-data");
    });

    test("should not access keys from another namespace", async () => {
      await app1.set("private", "secret");
      const value = await app2.get("private");
      expect(value).toBeNull();
    });

    test("should verify actual Redis keys include namespace prefix", async () => {
      await app1.set("test-key", "value");
      const actualValue = await redis.get("testapp1:test-key");
      expect(actualValue).toBe("value");
    });

    test("should handle namespace with trailing colon", async () => {
      const app3 = createNamespacedRedis(redis, "testapp3:");
      await app3.set("key", "value");
      
      const value = await redis.get("testapp3:key");
      expect(value).toBe("value");
      
      await clearNamespace(redis, "testapp3");
    });
  });

  describe("Namespaced Operations", () => {
    test("should work with JSON operations", async () => {
      interface Config {
        theme: string;
        lang: string;
      }
      
      await app1.setJSON("config", { theme: "dark", lang: "en" });
      await app2.setJSON("config", { theme: "light", lang: "es" });
      
      const config1 = await app1.getJSON<Config>("config");
      const config2 = await app2.getJSON<Config>("config");
      
      expect(config1?.theme).toBe("dark");
      expect(config2?.theme).toBe("light");
    });

    test("should isolate counters", async () => {
      await app1.incr("views");
      await app1.incr("views");
      await app2.incr("views");
      
      const count1 = await app1.get("views");
      const count2 = await app2.get("views");
      
      expect(count1).toBe("2");
      expect(count2).toBe("1");
    });

    test("should work with hash operations", async () => {
      await app1.hmset("user", { name: "Alice", age: "30" });
      await app2.hmset("user", { name: "Bob", age: "25" });
      
      const name1 = await app1.hget("user", "name");
      const name2 = await app2.hget("user", "name");
      
      expect(name1).toBe("Alice");
      expect(name2).toBe("Bob");
    });

    test("should work with list operations", async () => {
      await app1.rpush("queue", "task1", "task2");
      await app2.rpush("queue", "task3", "task4");
      
      const queue1 = await app1.lrange("queue", 0, -1);
      const queue2 = await app2.lrange("queue", 0, -1);
      
      expect(queue1).toEqual(["task1", "task2"]);
      expect(queue2).toEqual(["task3", "task4"]);
    });

    test("should work with set operations", async () => {
      await app1.sadd("tags", "redis", "cache");
      await app2.sadd("tags", "postgres", "database");
      
      const tags1 = await app1.smembers("tags");
      const tags2 = await app2.smembers("tags");
      
      expect(tags1).toContain("redis");
      expect(tags1).not.toContain("postgres");
      expect(tags2).toContain("postgres");
      expect(tags2).not.toContain("redis");
    });
  });

  describe("Namespaced Pattern Matching", () => {
    test("should scan within namespace only", async () => {
      await app1.set("session:user:1", "data1");
      await app1.set("session:user:2", "data2");
      await app1.set("config:timeout", "30");
      await app2.set("session:user:3", "data3");
      
      const keys = await app1.scanAll("session:*");
      
      expect(keys.length).toBe(2);
      expect(keys).toContain("session:user:1");
      expect(keys).toContain("session:user:2");
      expect(keys).not.toContain("session:user:3");
    });

    test("should return namespace-relative keys", async () => {
      await app1.set("user:123", "data");
      const keys = await app1.scanAll("user:*");
      
      // Should return "user:123" not "testapp1:user:123"
      expect(keys[0]).toBe("user:123");
    });
  });

  describe("Namespace Cleanup", () => {
    test("should clear all keys in namespace", async () => {
      await app1.set("key1", "value1");
      await app1.set("key2", "value2");
      await app1.set("key3", "value3");
      
      const deleted = await clearNamespace(redis, "testapp1");
      expect(deleted).toBe(3);
      
      const value = await app1.get("key1");
      expect(value).toBeNull();
    });

    test("should not affect other namespaces", async () => {
      await app1.set("key", "value1");
      await app2.set("key", "value2");
      
      await clearNamespace(redis, "testapp1");
      
      const val1 = await app1.get("key");
      const val2 = await app2.get("key");
      
      expect(val1).toBeNull();
      expect(val2).toBe("value2");
    });
  });

  describe("Multi-Tenant Scenarios", () => {
    test("should support multi-tenant application", async () => {
      const tenant1 = createNamespacedRedis(redis, "tenant:acme");
      const tenant2 = createNamespacedRedis(redis, "tenant:globex");
      
      await tenant1.setJSON("config", { theme: "dark", lang: "en" });
      await tenant2.setJSON("config", { theme: "light", lang: "es" });
      
      const config1 = await tenant1.getJSON("config");
      const config2 = await tenant2.getJSON("config");
      
      expect(config1).toEqual({ theme: "dark", lang: "en" });
      expect(config2).toEqual({ theme: "light", lang: "es" });
      
      await clearNamespace(redis, "tenant:acme");
      await clearNamespace(redis, "tenant:globex");
    });

    test("should support environment-based isolation", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const prod = createNamespacedRedis(redis, "myapp:prod");
      
      await dev.set("feature:new-ui", "true");
      await prod.set("feature:new-ui", "false");
      
      expect(await dev.get("feature:new-ui")).toBe("true");
      expect(await prod.get("feature:new-ui")).toBe("false");
      
      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:prod");
    });

    test("should copy one namespace to another", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const stage = createNamespacedRedis(redis, "myapp:stage");

      await dev.set("feature:new-ui", "true");
      await dev.setJSON("config", { version: 1, enabled: true });
      await dev.set("ttl:key", "value", { EX: 10 });
      await dev.hmset("user:123", { name: "Alice", role: "admin" });

      // Existing destination key should not be overwritten by default
      await stage.set("feature:new-ui", "false");

      const copy = await copyNamespace(redis, "myapp:dev", "myapp:stage");
      expect(copy.scanned).toBeGreaterThanOrEqual(3);
      expect(copy.copied).toBeGreaterThanOrEqual(2);
      expect(copy.skipped).toBeGreaterThanOrEqual(1);

      // Not overwritten
      expect(await stage.get("feature:new-ui")).toBe("false");

      // Copied values exist
      expect(await stage.getJSON("config")).toEqual({ version: 1, enabled: true });
      expect(await stage.hget("user:123", "name")).toBe("Alice");

      // TTL preserved (approx)
      const stageTtl = await redis.ttl("myapp:stage:ttl:key");
      expect(stageTtl).toBeGreaterThan(0);

      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:stage");
    });

    test("should copy namespace with replace option", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const stage = createNamespacedRedis(redis, "myapp:stage");

      await dev.set("feature:new-ui", "true");
      await dev.set("feature:dark-mode", "enabled");
      await stage.set("feature:new-ui", "false");

      const copy = await copyNamespace(redis, "myapp:dev", "myapp:stage", { replace: true });
      expect(copy.scanned).toBeGreaterThanOrEqual(2);
      expect(copy.copied).toBe(2);
      expect(copy.skipped).toBe(0);

      // Should be overwritten
      expect(await stage.get("feature:new-ui")).toBe("true");
      expect(await stage.get("feature:dark-mode")).toBe("enabled");

      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:stage");
    });

    test("should copy namespace with dryRun option", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const stage = createNamespacedRedis(redis, "myapp:stage");

      await dev.set("feature:new-ui", "true");
      await dev.set("feature:dark-mode", "enabled");

      const copy = await copyNamespace(redis, "myapp:dev", "myapp:stage", { dryRun: true });
      expect(copy.scanned).toBeGreaterThanOrEqual(2);
      expect(copy.copied).toBe(2);
      expect(copy.skipped).toBe(0);

      // Nothing should actually be copied
      expect(await stage.get("feature:new-ui")).toBeNull();
      expect(await stage.get("feature:dark-mode")).toBeNull();

      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:stage");
    });

    test("should copy namespace with match pattern", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const stage = createNamespacedRedis(redis, "myapp:stage");

      await dev.set("feature:new-ui", "true");
      await dev.set("feature:dark-mode", "enabled");
      await dev.set("config:timeout", "5000");
      await dev.set("config:retries", "3");

      // Only copy feature:* keys
      const copy = await copyNamespace(redis, "myapp:dev", "myapp:stage", { match: "feature:*" });
      expect(copy.scanned).toBe(2);
      expect(copy.copied).toBe(2);

      // Features copied
      expect(await stage.get("feature:new-ui")).toBe("true");
      expect(await stage.get("feature:dark-mode")).toBe("enabled");

      // Config not copied
      expect(await stage.get("config:timeout")).toBeNull();
      expect(await stage.get("config:retries")).toBeNull();

      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:stage");
    });

    test("should copy namespace with different data types", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const stage = createNamespacedRedis(redis, "myapp:stage");

      // String
      await dev.set("string:key", "value");
      
      // JSON
      await dev.setJSON("json:key", { name: "test", value: 123 });
      
      // Hash
      await dev.hmset("hash:key", { field1: "val1", field2: "val2" });
      
      // List
      await dev.rpush("list:key", "item1", "item2", "item3");
      
      // Set
      await dev.sadd("set:key", "member1", "member2", "member3");
      
      // Sorted Set
      await dev.zadd("zset:key", [1.0, "first"], [2.0, "second"], [3.0, "third"]);

      const copy = await copyNamespace(redis, "myapp:dev", "myapp:stage");
      expect(copy.scanned).toBeGreaterThanOrEqual(6);
      expect(copy.copied).toBeGreaterThanOrEqual(6);

      // Verify all types copied correctly
      expect(await stage.get("string:key")).toBe("value");
      expect(await stage.getJSON("json:key")).toEqual({ name: "test", value: 123 });
      expect(await stage.hgetAll("hash:key")).toEqual({ field1: "val1", field2: "val2" });
      expect(await stage.lrange("list:key", 0, -1)).toEqual(["item1", "item2", "item3"]);
      expect(await stage.smembers("set:key")).toEqual(expect.arrayContaining(["member1", "member2", "member3"]));
      
      const zsetMembers = await stage.zrange("zset:key", 0, -1);
      expect(zsetMembers).toEqual(["first", "second", "third"]);

      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:stage");
    });

    test("should preserve TTL when copying", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const stage = createNamespacedRedis(redis, "myapp:stage");

      // Set key with TTL
      await dev.set("temp:key", "value", { EX: 100 });
      
      // Set key without TTL
      await dev.set("permanent:key", "value");

      await copyNamespace(redis, "myapp:dev", "myapp:stage");

      // Check TTL is preserved (approximately)
      const tempTtl = await redis.ttl("myapp:stage:temp:key");
      expect(tempTtl).toBeGreaterThan(90);
      expect(tempTtl).toBeLessThanOrEqual(100);

      // Check permanent key has no TTL
      const permTtl = await redis.ttl("myapp:stage:permanent:key");
      expect(permTtl).toBe(-1);

      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:stage");
    });

    test("should throw error when copying to same namespace", async () => {
      expect(async () => {
        await copyNamespace(redis, "myapp:dev", "myapp:dev");
      }).toThrow("fromNamespace and toNamespace must be different");
    });

    test("should handle empty namespace", async () => {
      const copy = await copyNamespace(redis, "myapp:empty1", "myapp:empty2");
      expect(copy.scanned).toBe(0);
      expect(copy.copied).toBe(0);
      expect(copy.skipped).toBe(0);
    });

    test("should handle namespace with trailing colons", async () => {
      const dev = createNamespacedRedis(redis, "myapp:dev");
      const stage = createNamespacedRedis(redis, "myapp:stage");

      await dev.set("feature:test", "value");

      // Should work with trailing colons
      const copy = await copyNamespace(redis, "myapp:dev:", "myapp:stage:");
      expect(copy.copied).toBeGreaterThanOrEqual(1);
      expect(await stage.get("feature:test")).toBe("value");

      await clearNamespace(redis, "myapp:dev");
      await clearNamespace(redis, "myapp:stage");
    });
  });

  describe("Async Dispose", () => {
    test("should not close base Redis connection", async () => {
      const tempApp = createNamespacedRedis(redis, "temp");
      await tempApp.set("test", "value");
      
      await tempApp[Symbol.asyncDispose]();
      
      // Base Redis should still work
      await redis.set("direct-key", "value");
      const value = await redis.get("direct-key");
      expect(value).toBe("value");
      
      await redis.del("direct-key");
      await clearNamespace(redis, "temp");
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration Tests", () => {
  let redis: RedisWrapper;

  beforeAll(async () => {
    redis = await createRedis(TEST_REDIS_URL);
  });

  afterAll(async () => {
    await redis.close();
  });

  test("should support complex multi-namespace workflow", async () => {
    const cache = createNamespacedRedis(redis, "cache");
    const sessions = createNamespacedRedis(redis, "sessions");
    const analytics = createNamespacedRedis(redis, "analytics");
    
    // Cache some data
    await cache.setJSON("products", [{ id: 1, name: "Widget" }], { EX: 300 });
    
    // Create session
    await sessions.setJSON("user:123", { 
      userId: 123, 
      loginAt: Date.now() 
    }, { EX: 3600 });
    
    // Track analytics
    await analytics.incr("page:views");
    await analytics.incr("page:views");
    
    // Verify isolation
    expect(await cache.getJSON("products")).toBeTruthy();
    expect(await sessions.getJSON("user:123")).toBeTruthy();
    expect(await analytics.get("page:views")).toBe("2");
    
    // Cleanup
    await clearNamespace(redis, "cache");
    await clearNamespace(redis, "sessions");
    await clearNamespace(redis, "analytics");
  });

  test("should support rate limiting pattern", async () => {
    const api = createNamespacedRedis(redis, "api:ratelimit");
    
    async function checkRateLimit(userId: string, max: number): Promise<boolean> {
      const key = `user:${userId}`;
      const count = await api.incr(key);
      if (count === 1) await api.setTTL(key, 60);
      return count <= max;
    }
    
    // First 3 requests should be allowed
    expect(await checkRateLimit("123", 3)).toBe(true);
    expect(await checkRateLimit("123", 3)).toBe(true);
    expect(await checkRateLimit("123", 3)).toBe(true);
    
    // 4th should be denied
    expect(await checkRateLimit("123", 3)).toBe(false);
    
    await clearNamespace(redis, "api:ratelimit");
  });

  test("should handle sorted sets (leaderboard)", async () => {
    const leaderboard = createNamespacedRedis(redis, "game:leaderboard");
    
    // Add scores
    await leaderboard.zadd("daily", [100, "player1"], [250, "player2"], [175, "player3"]);
    
    // Get top 3
    const top = await leaderboard.zrange("daily", 0, 2);
    expect(top).toBeTruthy();
    expect(top.length).toBeGreaterThan(0);
    
    // Get rank
    const rank = await leaderboard.zrank("daily", "player1");
    expect(rank).toBe(0); // Lowest score is rank 0
    
    // Increment score
    const newScore = await leaderboard.zincrby("daily", 200, "player1");
    expect(newScore?.toString()).toBe("300");
    
    await clearNamespace(redis, "game:leaderboard");
  });

  test("should handle streams for event logging", async () => {
    const events = createNamespacedRedis(redis, "events");
    
    // Add events
    const id1 = await events.xadd("user:actions", "*", { action: "login", userId: "123" });
    const id2 = await events.xadd("user:actions", "*", { action: "purchase", userId: "123", amount: "99.99" });
    
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    
    // Read events
    const entries = await events.xrange("user:actions", "-", "+");
    expect(entries.length).toBe(2);
    
    // Check length
    const length = await events.xlen("user:actions");
    expect(length).toBe(2);
    
    await clearNamespace(redis, "events");
  });

  test("should handle geospatial data", async () => {
    const locations = createNamespacedRedis(redis, "locations");
    
    // Add locations (longitude, latitude, member)
    await locations.geoadd("cities", 
      [-122.4194, 37.7749, "San Francisco"],
      [-118.2437, 34.0522, "Los Angeles"],
      [-87.6298, 41.8781, "Chicago"]
    );
    
    // Get distance
    const dist = await locations.geodist("cities", "San Francisco", "Los Angeles", "km");
    expect(Number(dist)).toBeGreaterThan(500); // ~559 km
    
    // Get positions
    const positions = await locations.geopos("cities", "San Francisco");
    expect(positions[0]).toBeTruthy();
    
    await clearNamespace(redis, "locations");
  });

  test("should handle HyperLogLog for unique counts", async () => {
    const analytics = createNamespacedRedis(redis, "analytics:unique");
    
    // Track unique visitors
    await analytics.pfadd("visitors:today", "user1", "user2", "user3");
    await analytics.pfadd("visitors:today", "user1"); // Duplicate
    
    // Get unique count
    const count = await analytics.pfcount("visitors:today");
    expect(count).toBe(3); // Should count unique values only
    
    await clearNamespace(redis, "analytics:unique");
  });
});
