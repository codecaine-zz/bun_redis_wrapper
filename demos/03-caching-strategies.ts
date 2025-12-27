/**
 * Demo 3: Caching Strategies
 * 
 * Demonstrates various caching patterns and strategies:
 * - Cache-aside (lazy loading)
 * - Write-through cache
 * - Cache with TTL
 * - Multi-level caching
 * - Cache warming
 * 
 * Run with: bun run demos/03-caching-strategies.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// Simulated Database
// ============================================================================

class FakeDatabase {
  private products: Map<string, Product> = new Map([
    ["prod-1", { id: "prod-1", name: "Laptop", price: 999.99, category: "Electronics", stock: 50 }],
    ["prod-2", { id: "prod-2", name: "Mouse", price: 29.99, category: "Electronics", stock: 200 }],
    ["prod-3", { id: "prod-3", name: "Keyboard", price: 79.99, category: "Electronics", stock: 150 }],
    ["prod-4", { id: "prod-4", name: "Monitor", price: 299.99, category: "Electronics", stock: 75 }],
    ["prod-5", { id: "prod-5", name: "Desk Chair", price: 199.99, category: "Furniture", stock: 30 }],
  ]);

  async getProduct(id: string): Promise<Product | null> {
    // Simulate database latency
    await Bun.sleep(100);
    return this.products.get(id) || null;
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    await Bun.sleep(150);
    return Array.from(this.products.values()).filter(p => p.category === category);
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    await Bun.sleep(100);
    const product = this.products.get(id);
    if (product) {
      Object.assign(product, updates);
      this.products.set(id, product);
      return product;
    }
    return null;
  }
}

// ============================================================================
// Cache Manager with Different Strategies
// ============================================================================

class CacheManager {
  private cache;
  private db: FakeDatabase;
  private stats = { hits: 0, misses: 0 };

  constructor(redis: any, db: FakeDatabase) {
    this.cache = createNamespacedRedis(redis, "cache");
    this.db = db;
  }

  /**
   * Strategy 1: Cache-Aside (Lazy Loading)
   * - Check cache first
   * - On miss, load from DB and store in cache
   */
  async getProductCacheAside(productId: string): Promise<Product | null> {
    const cacheKey = `product:${productId}`;
    
    // Try to get from cache
    const cached = await this.cache.getJSON<Product>(cacheKey);
    
    if (cached) {
      this.stats.hits++;
      console.log(`  ✅ Cache HIT for ${productId}`);
      return cached;
    }

    // Cache miss - load from database
    this.stats.misses++;
    console.log(`  ❌ Cache MISS for ${productId} - loading from DB...`);
    
    const product = await this.db.getProduct(productId);
    
    if (product) {
      // Store in cache with 5 minute TTL
      await this.cache.setJSON(cacheKey, product, { EX: 300 });
      console.log(`  💾 Cached ${productId} with 5min TTL`);
    }

    return product;
  }

  /**
   * Strategy 2: Write-Through Cache
   * - Write to cache and database simultaneously
   * - Ensures cache is always in sync
   */
  async updateProductWriteThrough(
    productId: string,
    updates: Partial<Product>
  ): Promise<Product | null> {
    console.log(`  📝 Write-through update for ${productId}`);
    
    // Update database
    const product = await this.db.updateProduct(productId, updates);
    
    if (product) {
      // Immediately update cache
      const cacheKey = `product:${productId}`;
      await this.cache.setJSON(cacheKey, product, { EX: 300 });
      console.log(`  ✅ Updated both DB and cache`);
    }

    return product;
  }

  /**
   * Strategy 3: Cache Invalidation
   * - Remove from cache when data changes
   * - Next read will reload fresh data
   */
  async updateProductWithInvalidation(
    productId: string,
    updates: Partial<Product>
  ): Promise<Product | null> {
    console.log(`  📝 Update with cache invalidation for ${productId}`);
    
    // Update database
    const product = await this.db.updateProduct(productId, updates);
    
    if (product) {
      // Invalidate cache - will be reloaded on next read
      const cacheKey = `product:${productId}`;
      await this.cache.del(cacheKey);
      console.log(`  🗑️  Cache invalidated - will reload on next read`);
    }

    return product;
  }

  /**
   * Strategy 4: Cache Warming
   * - Pre-populate cache with frequently accessed data
   */
  async warmCache(productIds: string[]): Promise<void> {
    console.log(`  🔥 Warming cache with ${productIds.length} products...`);
    
    for (const id of productIds) {
      const product = await this.db.getProduct(id);
      if (product) {
        await this.cache.setJSON(`product:${id}`, product, { EX: 600 });
      }
    }

    console.log(`  ✅ Cache warmed`);
  }

  /**
   * Strategy 5: Multi-Level Caching
   * - Cache aggregated/computed results
   */
  async getCategoryProductsCached(category: string): Promise<Product[]> {
    const cacheKey = `category:${category}:products`;
    
    // Check cache
    const cached = await this.cache.getJSON<Product[]>(cacheKey);
    
    if (cached) {
      console.log(`  ✅ Category cache HIT for ${category}`);
      return cached;
    }

    console.log(`  ❌ Category cache MISS for ${category} - loading from DB...`);
    
    // Load from DB
    const products = await this.db.getProductsByCategory(category);
    
    // Cache the list with shorter TTL (data changes more frequently)
    await this.cache.setJSON(cacheKey, products, { EX: 60 });
    console.log(`  💾 Cached category list with 1min TTL`);

    return products;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    const keys = await this.cache.scanAll("*");
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function main() {
  console.log("💾 Demo 3: Caching Strategies\n");

  await using redis = await createRedis("redis://localhost:6379");
  const db = new FakeDatabase();
  const cacheManager = new CacheManager(redis, db);

  // ============================================================================
  // Strategy 1: Cache-Aside (Lazy Loading)
  // ============================================================================
  console.log("📖 Strategy 1: Cache-Aside (Lazy Loading)");
  console.log("─────────────────────────────────────────");

  // First request - cache miss
  let start = Date.now();
  await cacheManager.getProductCacheAside("prod-1");
  console.log(`  ⏱️  Request took ${Date.now() - start}ms\n`);

  // Second request - cache hit (much faster!)
  start = Date.now();
  await cacheManager.getProductCacheAside("prod-1");
  console.log(`  ⏱️  Request took ${Date.now() - start}ms\n`);

  // ============================================================================
  // Strategy 2: Write-Through Cache
  // ============================================================================
  console.log("✍️  Strategy 2: Write-Through Cache");
  console.log("─────────────────────────────────────────");

  await cacheManager.updateProductWriteThrough("prod-2", { price: 24.99 });
  
  // Read should hit cache immediately
  const updated = await cacheManager.getProductCacheAside("prod-2");
  console.log(`  Product price: $${updated?.price}\n`);

  // ============================================================================
  // Strategy 3: Cache Invalidation
  // ============================================================================
  console.log("🗑️  Strategy 3: Cache Invalidation");
  console.log("─────────────────────────────────────────");

  // Load into cache first
  await cacheManager.getProductCacheAside("prod-3");
  
  // Update with invalidation
  await cacheManager.updateProductWithInvalidation("prod-3", { price: 69.99 });
  
  // Next read will miss cache and reload
  const freshData = await cacheManager.getProductCacheAside("prod-3");
  console.log(`  Fresh price: $${freshData?.price}\n`);

  // ============================================================================
  // Strategy 4: Cache Warming
  // ============================================================================
  console.log("🔥 Strategy 4: Cache Warming");
  console.log("─────────────────────────────────────────");

  // Clear cache first
  await cacheManager.clearCache();
  
  // Warm cache with popular products
  await cacheManager.warmCache(["prod-1", "prod-2", "prod-4"]);
  
  // These requests will all hit cache
  start = Date.now();
  await cacheManager.getProductCacheAside("prod-1");
  await cacheManager.getProductCacheAside("prod-2");
  await cacheManager.getProductCacheAside("prod-4");
  console.log(`  ⏱️  3 requests took ${Date.now() - start}ms (all cache hits)\n`);

  // ============================================================================
  // Strategy 5: Multi-Level Caching
  // ============================================================================
  console.log("📊 Strategy 5: Multi-Level Caching");
  console.log("─────────────────────────────────────────");

  // First request - loads from DB
  start = Date.now();
  let electronics = await cacheManager.getCategoryProductsCached("Electronics");
  console.log(`  Loaded ${electronics.length} products in ${Date.now() - start}ms`);

  // Second request - cache hit
  start = Date.now();
  electronics = await cacheManager.getCategoryProductsCached("Electronics");
  console.log(`  Loaded ${electronics.length} products in ${Date.now() - start}ms (cached)\n`);

  // ============================================================================
  // Cache Statistics
  // ============================================================================
  console.log("📈 Cache Statistics");
  console.log("─────────────────────────────────────────");

  const stats = cacheManager.getStats();
  console.log(`  Total Hits: ${stats.hits}`);
  console.log(`  Total Misses: ${stats.misses}`);
  console.log(`  Hit Rate: ${stats.hitRate.toFixed(2)}%\n`);

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Use cache-aside for read-heavy workloads");
  console.log("  ✓ Use write-through when consistency is critical");
  console.log("  ✓ Set appropriate TTLs based on data freshness needs");
  console.log("  ✓ Warm cache for predictable access patterns");
  console.log("  ✓ Cache aggregated results to reduce computation");
  console.log("  ✓ Monitor hit rates to validate caching effectiveness");

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  await cacheManager.clearCache();

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
