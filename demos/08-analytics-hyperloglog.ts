/**
 * Demo 8: Analytics with HyperLogLog
 * 
 * Demonstrates Redis HyperLogLog for memory-efficient unique counting:
 * - Unique visitor tracking
 * - Unique event counting
 * - Set operations (union, intersection)
 * - Memory-efficient analytics
 * 
 * Run with: bun run demos/08-analytics-hyperloglog.ts
 */

import { createRedis, createNamespacedRedis } from "../src/index.ts";

// ============================================================================
// Analytics Service Class
// ============================================================================

class AnalyticsService {
  private analytics;

  constructor(redis: any) {
    this.analytics = createNamespacedRedis(redis, "analytics");
  }

  /**
   * Track unique visitor
   */
  async trackVisitor(key: string, visitorId: string): Promise<void> {
    await this.analytics.pfadd(key, visitorId);
  }

  /**
   * Track multiple visitors at once
   */
  async trackVisitors(key: string, visitorIds: string[]): Promise<void> {
    await this.analytics.pfadd(key, ...visitorIds);
    console.log(`  📊 Tracked ${visitorIds.length} visitors to ${key}`);
  }

  /**
   * Get unique visitor count
   */
  async getUniqueCount(key: string): Promise<number> {
    return await this.analytics.pfcount(key);
  }

  /**
   * Merge multiple HyperLogLogs
   */
  async merge(destKey: string, sourceKeys: string[]): Promise<void> {
    await this.analytics.pfmerge(destKey, ...sourceKeys);
    console.log(`  🔀 Merged ${sourceKeys.length} sets into ${destKey}`);
  }

  /**
   * Get unique count across multiple keys
   */
  async getUniqueTotalCount(...keys: string[]): Promise<number> {
    return await this.analytics.pfcount(...keys);
  }

  /**
   * Clear analytics data
   */
  async clear(key: string): Promise<void> {
    await this.analytics.del(key);
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function simulateTraffic(
  analytics: AnalyticsService,
  pageKey: string,
  visitors: number,
  uniqueRatio: number = 0.7
): Promise<void> {
  const uniqueVisitors = Math.floor(visitors * uniqueRatio);
  const repeatVisitors = visitors - uniqueVisitors;

  // Track unique visitors
  for (let i = 0; i < uniqueVisitors; i++) {
    await analytics.trackVisitor(pageKey, `user:${i}`);
  }

  // Simulate repeat visitors
  for (let i = 0; i < repeatVisitors; i++) {
    const repeatId = `user:${Math.floor(Math.random() * uniqueVisitors)}`;
    await analytics.trackVisitor(pageKey, repeatId);
  }
}

async function main() {
  console.log("📈 Demo 8: Analytics with HyperLogLog\n");

  await using redis = await createRedis("redis://localhost:6379");
  const analytics = new AnalyticsService(redis);

  // ============================================================================
  // Use Case 1: Website Analytics
  // ============================================================================
  console.log("🌐 Use Case 1: Website Page Views");
  console.log("─────────────────────────────────────────");

  console.log("\nSimulating traffic...\n");

  // Track visitors to different pages
  await simulateTraffic(analytics, "page:/home", 10000, 0.7);
  await simulateTraffic(analytics, "page:/about", 5000, 0.8);
  await simulateTraffic(analytics, "page:/products", 8000, 0.75);
  await simulateTraffic(analytics, "page:/contact", 3000, 0.9);

  console.log("✅ Traffic simulation complete\n");

  // Get unique visitors per page
  console.log("Unique visitors per page:");
  const homeVisitors = await analytics.getUniqueCount("page:/home");
  const aboutVisitors = await analytics.getUniqueCount("page:/about");
  const productsVisitors = await analytics.getUniqueCount("page:/products");
  const contactVisitors = await analytics.getUniqueCount("page:/contact");

  console.log(`  /home:     ${homeVisitors.toLocaleString()} unique visitors`);
  console.log(`  /about:    ${aboutVisitors.toLocaleString()} unique visitors`);
  console.log(`  /products: ${productsVisitors.toLocaleString()} unique visitors`);
  console.log(`  /contact:  ${contactVisitors.toLocaleString()} unique visitors`);

  // ============================================================================
  // Use Case 2: Daily Active Users (DAU)
  // ============================================================================
  console.log("\n\n👥 Use Case 2: Daily Active Users (DAU)");
  console.log("─────────────────────────────────────────");

  console.log("\nTracking daily active users...\n");

  // Simulate 7 days of user activity
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  for (const day of days) {
    const userCount = 1000 + Math.floor(Math.random() * 500);
    const users = Array.from({ length: userCount }, (_, i) => `user:${i}`);
    await analytics.trackVisitors(`dau:${day}`, users);
  }

  console.log("Daily Active Users:");
  for (const day of days) {
    const dau = await analytics.getUniqueCount(`dau:${day}`);
    console.log(`  ${day}: ${dau.toLocaleString()} users`);
  }

  // ============================================================================
  // Use Case 3: Weekly Active Users (WAU)
  // ============================================================================
  console.log("\n\n📅 Use Case 3: Weekly Active Users (WAU)");
  console.log("─────────────────────────────────────────");

  // Merge all daily counts to get WAU
  await analytics.merge(
    "wau:week1",
    days.map(d => `dau:${d}`)
  );

  const wau = await analytics.getUniqueCount("wau:week1");
  console.log(`\nWeekly Active Users: ${wau.toLocaleString()}`);

  // ============================================================================
  // Use Case 4: Cross-Platform Analytics
  // ============================================================================
  console.log("\n\n📱 Use Case 4: Cross-Platform Analytics");
  console.log("─────────────────────────────────────────");

  console.log("\nTracking users across platforms...\n");

  // Track users on different platforms
  await analytics.trackVisitors("platform:web", [
    "user:1", "user:2", "user:3", "user:4", "user:5"
  ]);

  await analytics.trackVisitors("platform:mobile", [
    "user:3", "user:4", "user:6", "user:7", "user:8"
  ]);

  await analytics.trackVisitors("platform:desktop", [
    "user:2", "user:5", "user:9", "user:10"
  ]);

  const webUsers = await analytics.getUniqueCount("platform:web");
  const mobileUsers = await analytics.getUniqueCount("platform:mobile");
  const desktopUsers = await analytics.getUniqueCount("platform:desktop");

  console.log("Users per platform:");
  console.log(`  Web:     ${webUsers}`);
  console.log(`  Mobile:  ${mobileUsers}`);
  console.log(`  Desktop: ${desktopUsers}`);

  // Total unique users across all platforms
  const totalUsers = await analytics.getUniqueTotalCount(
    "platform:web",
    "platform:mobile",
    "platform:desktop"
  );

  console.log(`\nTotal unique users (across all platforms): ${totalUsers}`);

  // ============================================================================
  // Use Case 5: Feature Usage Tracking
  // ============================================================================
  console.log("\n\n⚡ Use Case 5: Feature Usage Tracking");
  console.log("─────────────────────────────────────────");

  console.log("\nTracking feature usage...\n");

  await analytics.trackVisitors("feature:search", [
    "user:1", "user:2", "user:3", "user:4", "user:5", "user:6"
  ]);

  await analytics.trackVisitors("feature:export", [
    "user:2", "user:4", "user:7"
  ]);

  await analytics.trackVisitors("feature:share", [
    "user:1", "user:3", "user:5", "user:8", "user:9"
  ]);

  console.log("Feature usage (unique users):");
  const searchUsers = await analytics.getUniqueCount("feature:search");
  const exportUsers = await analytics.getUniqueCount("feature:export");
  const shareUsers = await analytics.getUniqueCount("feature:share");

  console.log(`  Search: ${searchUsers} users`);
  console.log(`  Export: ${exportUsers} users`);
  console.log(`  Share:  ${shareUsers} users`);

  // Calculate adoption rates (assuming 100 total users)
  const totalAppUsers = 100;
  console.log("\nAdoption rates:");
  console.log(`  Search: ${(searchUsers / totalAppUsers * 100).toFixed(1)}%`);
  console.log(`  Export: ${(exportUsers / totalAppUsers * 100).toFixed(1)}%`);
  console.log(`  Share:  ${(shareUsers / totalAppUsers * 100).toFixed(1)}%`);

  // ============================================================================
  // Use Case 6: Campaign Attribution
  // ============================================================================
  console.log("\n\n🎯 Use Case 6: Marketing Campaign Attribution");
  console.log("─────────────────────────────────────────");

  console.log("\nTracking campaign conversions...\n");

  await analytics.trackVisitors("campaign:email", [
    "user:10", "user:11", "user:12", "user:13"
  ]);

  await analytics.trackVisitors("campaign:social", [
    "user:12", "user:14", "user:15", "user:16", "user:17"
  ]);

  await analytics.trackVisitors("campaign:search", [
    "user:11", "user:15", "user:18", "user:19", "user:20"
  ]);

  console.log("Unique conversions per campaign:");
  const emailConversions = await analytics.getUniqueCount("campaign:email");
  const socialConversions = await analytics.getUniqueCount("campaign:social");
  const searchConversions = await analytics.getUniqueCount("campaign:search");

  console.log(`  Email:  ${emailConversions}`);
  console.log(`  Social: ${socialConversions}`);
  console.log(`  Search: ${searchConversions}`);

  const totalCampaignReach = await analytics.getUniqueTotalCount(
    "campaign:email",
    "campaign:social",
    "campaign:search"
  );

  console.log(`\nTotal unique reach: ${totalCampaignReach}`);

  // ============================================================================
  // Memory Efficiency Demo
  // ============================================================================
  console.log("\n\n💾 Memory Efficiency Demonstration");
  console.log("─────────────────────────────────────────");

  console.log("\nAdding 1 million unique IDs...");
  const startTime = Date.now();

  // Add in batches
  const batchSize = 10000;
  for (let i = 0; i < 1000000; i += batchSize) {
    const batch = Array.from({ length: batchSize }, (_, j) => `user:${i + j}`);
    await analytics.trackVisitors("test:million", batch);
  }

  const elapsed = Date.now() - startTime;
  const count = await analytics.getUniqueCount("test:million");

  console.log(`\nAdded 1,000,000 IDs in ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`Counted: ${count.toLocaleString()} unique IDs`);
  console.log(`Accuracy: ${(count / 1000000 * 100).toFixed(2)}%`);
  console.log(`\nNote: HyperLogLog uses ~12KB regardless of cardinality!`);
  console.log(`      Traditional set would use ~60-80MB for 1M IDs`);

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("\n\n💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Use HyperLogLog for unique counting at scale");
  console.log("  ✓ Memory usage is constant (~12KB) per HLL");
  console.log("  ✓ Accuracy is ~0.81% standard error");
  console.log("  ✓ Perfect for DAU/MAU tracking");
  console.log("  ✓ Use PFMERGE to combine multiple periods");
  console.log("  ✓ Track events with consistent identifiers");
  console.log("  ✓ Consider time-based key naming (e.g., dau:2024-01-01)");
  console.log("  ✓ Set TTL on time-series data to auto-expire");
  console.log("  ✓ Use separate HLLs for different metrics");

  console.log("\n\n📊 HyperLogLog vs Traditional Sets:");
  console.log("─────────────────────────────────────────");
  console.log("  1M items:");
  console.log("    HyperLogLog: ~12 KB, 0.81% error");
  console.log("    Set:         ~80 MB, 0% error");
  console.log("\n  100M items:");
  console.log("    HyperLogLog: ~12 KB, 0.81% error");
  console.log("    Set:         ~8 GB, 0% error");
  console.log("\n  → Use HyperLogLog when approximate counts are acceptable!");

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  const keys = await analytics["analytics"].scanAll("*");
  if (keys.length > 0) {
    await analytics["analytics"].del(...keys);
  }

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
