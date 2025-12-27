/**
 * Complete Application Example
 * 
 * This example shows how to use all controllers together in a production application.
 * Run with: bun run controllers/example-app.ts
 */

import { createRedis } from "../src/index.ts";
import {
  SessionController,
  CacheController,
  RateLimiterController,
  QueueController,
  StorageController,
  AnalyticsController
} from "../src/controllers/index.ts";

// ============================================================================
// Setup
// ============================================================================

console.log("🚀 Starting Application Example\n");

// Create single Redis connection
await using redis = await createRedis();

// Initialize controllers
const sessions = new SessionController(redis);
const cache = new CacheController(redis, "app");
const limiter = new RateLimiterController(redis);
const queue = new QueueController(redis);
const storage = new StorageController(redis, "app-settings");
const analytics = new AnalyticsController(redis);

// ============================================================================
// Example 1: User Registration & Session
// ============================================================================

console.log("👤 Example 1: User Registration Flow");
console.log("─".repeat(50));

// Simulate user registration
const userId = "user-alice";
const userEmail = "alice@example.com";

// Store user settings
await storage.set(`user:${userId}`, {
  email: userEmail,
  name: "Alice Johnson",
  role: "user",
  preferences: {
    theme: "dark",
    notifications: true
  }
});

// Create session
const sessionId = await sessions.create(userId, {
  email: userEmail,
  name: "Alice Johnson"
}, {
  ttl: 3600, // 1 hour
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0"
});

console.log(`  ✅ User registered: ${userId}`);
console.log(`  ✅ Session created: ${sessionId}`);

// Track analytics
await analytics.trackDAU(userId);
await analytics.trackEvent("user-action", "registration", userId);

console.log(`  ✅ Analytics tracked\n`);

// ============================================================================
// Example 2: API Request with Rate Limiting
// ============================================================================

console.log("🚦 Example 2: API Request with Rate Limiting");
console.log("─".repeat(50));

// Simulate API requests
for (let i = 1; i <= 5; i++) {
  const rateLimit = await limiter.check(userId, 10, 60); // 10 req/min

  if (rateLimit.allowed) {
    console.log(`  ✅ Request ${i}: Allowed (${rateLimit.remaining} remaining)`);
    
    // Track API call
    await analytics.trackEvent("api-call", "/api/users", userId);
  } else {
    console.log(`  ❌ Request ${i}: Rate limited (retry after ${rateLimit.retryAfter}s)`);
  }
}

console.log();

// ============================================================================
// Example 3: Caching Database Queries
// ============================================================================

console.log("💾 Example 3: Intelligent Caching");
console.log("─".repeat(50));

// Simulate database query with cache
const getUserData = async (id: string) => {
  return await cache.getOrSet(
    `user:${id}`,
    async () => {
      // This would be a real database query
      console.log("  📥 Cache MISS - Loading from database...");
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate DB delay
      return {
        id,
        email: userEmail,
        name: "Alice Johnson",
        lastLogin: new Date().toISOString()
      };
    },
    300 // Cache for 5 minutes
  );
};

// First call - cache miss
let user = await getUserData(userId);
console.log(`  ✅ User data retrieved: ${user.name}`);

// Second call - cache hit
console.log("  📥 Fetching again...");
user = await getUserData(userId);
console.log(`  ✅ User data retrieved (from cache): ${user.name}`);

// Cache stats
const cacheStats = await cache.getStats();
console.log(`  📊 Cache hit rate: ${cacheStats.hitRate}%\n`);

// ============================================================================
// Example 4: Background Jobs
// ============================================================================

console.log("⚙️  Example 4: Background Job Processing");
console.log("─".repeat(50));

// Add jobs to queue
const emailJobId = await queue.add("send-email", {
  to: userEmail,
  subject: "Welcome to our platform!",
  template: "welcome"
}, { priority: 8 });

const reportJobId = await queue.add("generate-report", {
  userId,
  reportType: "monthly-activity"
}, { priority: 5, delay: 60 }); // Delay 60 seconds

console.log(`  ✅ Email job queued: ${emailJobId}`);
console.log(`  ✅ Report job queued: ${reportJobId} (delayed 60s)`);

// Process jobs
const job = await queue.next();
if (job) {
  console.log(`  ⚙️  Processing job: ${job.type}`);
  
  // Simulate job processing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  await queue.complete(job.id);
  console.log(`  ✅ Job completed: ${job.id}`);
}

// Queue stats
const queueStats = await queue.getStats();
console.log(`  📊 Queue: ${queueStats.pending} pending, ${queueStats.completed} completed\n`);

// ============================================================================
// Example 5: User Activity Analytics
// ============================================================================

console.log("📈 Example 5: Analytics & Metrics");
console.log("─".repeat(50));

// Track various events
await analytics.trackEvent("page-view", "/dashboard", userId);
await analytics.trackEvent("page-view", "/profile", userId);
await analytics.trackEvent("button-click", "save-settings", userId);

// Track funnel
await analytics.trackFunnelStep("onboarding", "step-1-welcome", userId);
await analytics.trackFunnelStep("onboarding", "step-2-profile", userId);
await analytics.trackFunnelStep("onboarding", "step-3-complete", userId);

// Get stats
const dashboardViews = await analytics.getEventStats("page-view", "/dashboard");
const dau = await analytics.getDAU();

console.log(`  📊 Dashboard views: ${dashboardViews.total} (${dashboardViews.unique} unique)`);
console.log(`  👥 Daily active users: ${dau}`);

// Increment custom counter
await analytics.increment("feature-usage:dark-mode");
const darkModeUsage = await analytics.getCounter("feature-usage:dark-mode");
console.log(`  🎨 Dark mode usage: ${darkModeUsage}\n`);

// ============================================================================
// Example 6: Application Settings
// ============================================================================

console.log("⚙️  Example 6: Application Settings");
console.log("─".repeat(50));

// Store app-wide settings
await storage.set("maintenance-mode", false);
await storage.set("feature-flags", {
  newDashboard: true,
  betaFeatures: false,
  darkMode: true
});

// Store configuration
await storage.set("email-config", {
  provider: "sendgrid",
  rateLimit: 100,
  templates: ["welcome", "reset-password", "newsletter"]
});

// Retrieve settings
const featureFlags = await storage.get("feature-flags");
console.log(`  ⚙️  Feature flags loaded:`, featureFlags);

// Update nested property
await storage.updateProperty("feature-flags", "betaFeatures", true);
console.log(`  ✅ Beta features enabled`);

// List all settings
const allSettings = await storage.keys();
console.log(`  📋 Total settings: ${allSettings.length}\n`);

// ============================================================================
// Example 7: Session Validation (Middleware Pattern)
// ============================================================================

console.log("🔒 Example 7: Session Validation");
console.log("─".repeat(50));

// Simulate middleware checking session
const validateRequest = async (sessionId: string) => {
  const session = await sessions.validate(sessionId);
  
  if (!session) {
    console.log(`  ❌ Invalid or expired session`);
    return null;
  }
  
  console.log(`  ✅ Valid session for: ${session.data.email}`);
  
  // Check rate limit
  const rateLimit = await limiter.check(session.userId, 100, 60);
  console.log(`  ✅ Rate limit OK (${rateLimit.remaining} remaining)`);
  
  return session;
};

const validSession = await validateRequest(sessionId);
console.log();

// ============================================================================
// Example 8: Cleanup & Maintenance
// ============================================================================

console.log("🧹 Example 8: Maintenance Tasks");
console.log("─".repeat(50));

// Get statistics before cleanup
console.log("  📊 Before cleanup:");
console.log(`     - Cache keys: ${await cache.size()}`);
console.log(`     - Queue stats: ${queueStats.pending} pending`);
console.log(`     - Active sessions: ${await sessions.getSessionCount(userId)}`);

// This would typically run on a schedule
await queue.cleanup(24); // Clean up jobs older than 24 hours
await sessions.cleanupExpired(); // Clean up expired sessions

console.log(`  ✅ Cleanup complete\n`);

// ============================================================================
// Example 9: Graceful Shutdown
// ============================================================================

console.log("👋 Example 9: Graceful Shutdown");
console.log("─".repeat(50));

// Log out user
await sessions.destroy(sessionId);
console.log(`  ✅ Session destroyed`);

// Final analytics
const finalStats = await analytics.getUniqueCount("dau:" + new Date().toISOString().split('T')[0]);
console.log(`  📊 Total DAU: ${finalStats}`);

// Get application metrics
const metrics = await analytics.listMetrics();
console.log(`  📊 Tracked metrics: ${metrics.slice(0, 5).join(", ")}...`);

console.log();
console.log("✨ Application example complete!");
console.log();

// ============================================================================
// Production Tips
// ============================================================================

console.log("💡 Production Tips:");
console.log("─".repeat(50));
console.log("1. Use environment variables for Redis URL");
console.log("2. Implement error handling and retries");
console.log("3. Monitor cache hit rates and adjust TTLs");
console.log("4. Set up queue workers in separate processes");
console.log("5. Schedule cleanup tasks (cron jobs)");
console.log("6. Use namespaces to organize data");
console.log("7. Implement circuit breakers for resilience");
console.log("8. Log important events for debugging");
console.log("9. Set up alerts for queue depth and errors");
console.log("10. Test thoroughly before deployment");
console.log();

// Connection automatically closes due to "await using"
