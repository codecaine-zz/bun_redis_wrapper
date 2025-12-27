/**
 * Demo: Environment Promotion with Namespaces
 * 
 * This demo shows how to use namespaces and copyNamespace to manage
 * data promotion across development, staging, and production environments.
 * 
 * Use cases:
 * - Configuration management across environments
 * - Feature flag promotion
 * - Cache warming in production
 * - Data migration and testing
 * 
 * Run: bun demos/15-environment-promotion.ts
 */

import { createRedis, createNamespacedRedis, copyNamespace, clearNamespace } from "../src/index";

interface AppConfig {
  apiUrl: string;
  maxConnections: number;
  enableAnalytics: boolean;
  cacheTimeout: number;
  debugMode: boolean;
}

interface FeatureFlags {
  newUI: boolean;
  betaFeatures: boolean;
  experimentalAPI: boolean;
  darkMode: boolean;
}

async function main() {
  console.log("🚀 Environment Promotion Demo\n");
  console.log("=" .repeat(60));

  const redis = await createRedis();

  // Create environment-specific namespaces
  const dev = createNamespacedRedis(redis, "env:dev");
  const staging = createNamespacedRedis(redis, "env:staging");
  const prod = createNamespacedRedis(redis, "env:prod");

  try {
    // ========================================================================
    // Step 1: Development Environment Setup
    // ========================================================================
    console.log("\n📝 Step 1: Setting up Development Environment");
    console.log("-".repeat(60));

    // Development configuration
    const devConfig: AppConfig = {
      apiUrl: "http://localhost:3000",
      maxConnections: 10,
      enableAnalytics: false,
      cacheTimeout: 60,
      debugMode: true
    };

    await dev.setJSON("config:app", devConfig);
    console.log("✓ Saved app configuration to dev");

    // Development feature flags
    const devFlags: FeatureFlags = {
      newUI: true,
      betaFeatures: true,
      experimentalAPI: true,
      darkMode: true
    };

    await dev.setJSON("config:features", devFlags);
    console.log("✓ Saved feature flags to dev");

    // Cache some test data
    await dev.setJSON("cache:users:123", {
      id: 123,
      name: "Alice Developer",
      role: "admin"
    }, { EX: 300 });

    await dev.setJSON("cache:products", [
      { id: 1, name: "Widget", price: 29.99 },
      { id: 2, name: "Gadget", price: 49.99 }
    ], { EX: 600 });

    console.log("✓ Cached test data in dev");

    // Track some metrics
    await dev.incr("metrics:api:calls");
    await dev.incr("metrics:api:calls");
    await dev.incr("metrics:api:calls");
    await dev.incr("metrics:errors");

    console.log("✓ Recorded test metrics in dev");

    // Show dev environment state
    const devKeys = await dev.scanAll("*");
    console.log(`\n📊 Development has ${devKeys.length} keys`);
    console.log("Keys:", devKeys.sort().join(", "));

    // ========================================================================
    // Step 2: Copy Development to Staging (for testing)
    // ========================================================================
    console.log("\n\n📦 Step 2: Promoting to Staging Environment");
    console.log("-".repeat(60));

    // First, update config for staging environment
    const stagingConfig: AppConfig = {
      apiUrl: "https://staging-api.example.com",
      maxConnections: 50,
      enableAnalytics: true,
      cacheTimeout: 300,
      debugMode: false
    };

    // Copy dev to staging (but don't overwrite staging-specific config)
    const copyToStaging = await copyNamespace(redis, "env:dev", "env:staging");
    console.log(`✓ Copied from dev to staging:`);
    console.log(`  - Scanned: ${copyToStaging.scanned} keys`);
    console.log(`  - Copied: ${copyToStaging.copied} keys`);
    console.log(`  - Skipped: ${copyToStaging.skipped} keys`);

    // Override with staging-specific configuration
    await staging.setJSON("config:app", stagingConfig);
    console.log("✓ Applied staging-specific configuration");

    // Staging feature flags (slightly more conservative than dev)
    const stagingFlags: FeatureFlags = {
      newUI: true,
      betaFeatures: true,
      experimentalAPI: false, // Turn off experimental features in staging
      darkMode: true
    };

    await staging.setJSON("config:features", stagingFlags);
    console.log("✓ Applied staging-specific feature flags");

    // Show staging environment state
    const stagingKeys = await staging.scanAll("*");
    console.log(`\n📊 Staging has ${stagingKeys.length} keys`);
    
    const stagingConfigResult = await staging.getJSON<AppConfig>("config:app");
    console.log("\nStaging Config:", JSON.stringify(stagingConfigResult, null, 2));

    // ========================================================================
    // Step 3: Validate in Staging
    // ========================================================================
    console.log("\n\n🧪 Step 3: Validating Staging Environment");
    console.log("-".repeat(60));

    // Check that data exists
    const cachedUser = await staging.getJSON("cache:users:123");
    console.log("✓ User cache found:", cachedUser?.name);

    const cachedProducts = await staging.getJSON<any[]>("cache:products");
    console.log(`✓ Products cache found: ${cachedProducts?.length} products`);

    const apiCalls = await staging.get("metrics:api:calls");
    console.log(`✓ Metrics copied: ${apiCalls} API calls`);

    // Run staging-specific tests
    console.log("\n🔍 Running staging validation tests...");
    await staging.incr("metrics:staging:tests");
    await staging.set("validation:timestamp", Date.now().toString());
    await staging.set("validation:status", "passed");
    console.log("✓ Staging validation complete");

    // ========================================================================
    // Step 4: Selective Copy to Production (config and features only)
    // ========================================================================
    console.log("\n\n🚀 Step 4: Promoting to Production");
    console.log("-".repeat(60));

    // Set up production config first
    const prodConfig: AppConfig = {
      apiUrl: "https://api.example.com",
      maxConnections: 200,
      enableAnalytics: true,
      cacheTimeout: 3600,
      debugMode: false
    };

    await prod.setJSON("config:app", prodConfig);
    console.log("✓ Set production configuration");

    // Copy only configuration and features from staging to prod
    console.log("\nCopying configuration from staging...");
    const copyConfigToProd = await copyNamespace(
      redis,
      "env:staging",
      "env:prod",
      {
        match: "config:features", // Only copy feature flags
        replace: true // Overwrite existing
      }
    );

    console.log(`✓ Copied feature config to production:`);
    console.log(`  - Scanned: ${copyConfigToProd.scanned} keys`);
    console.log(`  - Copied: ${copyConfigToProd.copied} keys`);

    // Production feature flags (most conservative)
    const prodFlags: FeatureFlags = {
      newUI: true,
      betaFeatures: false, // Disable beta in production
      experimentalAPI: false,
      darkMode: true
    };

    await prod.setJSON("config:features", prodFlags);
    console.log("✓ Applied production-specific feature flags");

    // Don't copy cache or metrics to production - it will build its own
    console.log("✓ Skipping cache and metrics (production will generate its own)");

    // ========================================================================
    // Step 5: Show All Environment States
    // ========================================================================
    console.log("\n\n📊 Step 5: Environment Summary");
    console.log("=".repeat(60));

    const environments = [
      { name: "Development", ns: dev, prefix: "env:dev" },
      { name: "Staging", ns: staging, prefix: "env:staging" },
      { name: "Production", ns: prod, prefix: "env:prod" }
    ];

    for (const env of environments) {
      const keys = await env.ns.scanAll("*");
      const config = await env.ns.getJSON<AppConfig>("config:app");
      const features = await env.ns.getJSON<FeatureFlags>("config:features");

      console.log(`\n${env.name}:`);
      console.log(`  Keys: ${keys.length}`);
      console.log(`  API URL: ${config?.apiUrl}`);
      console.log(`  Debug Mode: ${config?.debugMode}`);
      console.log(`  Features:`);
      console.log(`    - New UI: ${features?.newUI}`);
      console.log(`    - Beta Features: ${features?.betaFeatures}`);
      console.log(`    - Experimental API: ${features?.experimentalAPI}`);
    }

    // ========================================================================
    // Step 6: Demonstrate Rollback Capability
    // ========================================================================
    console.log("\n\n⏮️  Step 6: Rollback Demo");
    console.log("-".repeat(60));

    // Create a backup namespace before making changes
    console.log("Creating production backup...");
    await copyNamespace(redis, "env:prod", "env:prod:backup");
    console.log("✓ Production backed up to env:prod:backup");

    // Make a change
    await prod.setJSON("config:features", {
      ...prodFlags,
      newUI: false // Simulate disabling a feature
    });
    console.log("✓ Disabled new UI in production");

    // Show that we can restore from backup
    console.log("\nSimulating rollback...");
    await copyNamespace(redis, "env:prod:backup", "env:prod", { replace: true });
    console.log("✓ Rolled back production from backup");

    const restoredFeatures = await prod.getJSON<FeatureFlags>("config:features");
    console.log(`  - New UI restored: ${restoredFeatures?.newUI}`);

    // ========================================================================
    // Step 7: Dry Run Example
    // ========================================================================
    console.log("\n\n🔍 Step 7: Dry Run Preview");
    console.log("-".repeat(60));

    console.log("Preview: What would be copied from dev to staging?");
    const dryRun = await copyNamespace(
      redis,
      "env:dev",
      "env:staging",
      { dryRun: true }
    );

    console.log(`Dry run results (no actual changes):`);
    console.log(`  - Would scan: ${dryRun.scanned} keys`);
    console.log(`  - Would copy: ${dryRun.copied} keys`);
    console.log(`  - Would skip: ${dryRun.skipped} keys`);

    // ========================================================================
    // Best Practices Summary
    // ========================================================================
    console.log("\n\n💡 Best Practices");
    console.log("=".repeat(60));
    console.log(`
1. Environment Isolation:
   ✓ Use separate namespaces for each environment
   ✓ Never share namespaces across environments

2. Configuration Management:
   ✓ Use environment-specific configs (URLs, limits, etc.)
   ✓ Copy feature flags but override as needed per environment

3. Promotion Strategy:
   ✓ Use 'match' parameter for selective copying
   ✓ Don't copy cache/metrics - let each env generate its own
   ✓ Use 'dryRun' to preview changes before promotion

4. Rollback Safety:
   ✓ Create backups before major changes
   ✓ Use copyNamespace with replace=true for quick rollbacks
   ✓ Keep previous versions for disaster recovery

5. Testing:
   ✓ Always validate in staging before production
   ✓ Use different feature flag settings per environment
   ✓ Keep debug mode off in staging/production
`);

  } finally {
    // Cleanup
    console.log("\n\n🧹 Cleaning up...");
    await clearNamespace(redis, "env:dev");
    await clearNamespace(redis, "env:staging");
    await clearNamespace(redis, "env:prod");
    await clearNamespace(redis, "env:prod:backup");
    console.log("✓ All test environments cleaned up");

    await redis.close();
    console.log("✓ Connection closed");
  }

  console.log("\n✅ Demo complete!\n");
}

main().catch(console.error);
