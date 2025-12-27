/**
 * Demo 9: Multi-Tenant Application
 * 
 * Demonstrates building a multi-tenant SaaS application with Redis:
 * - Tenant isolation using namespaces
 * - Per-tenant data management
 * - Tenant configuration
 * - Resource quotas and limits
 * - Cross-tenant analytics
 * 
 * Run with: bun run demos/09-multi-tenant.ts
 */

import { createRedis, createNamespacedRedis, clearNamespace } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface TenantConfig {
  tenantId: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  maxUsers: number;
  maxStorage: number; // MB
  createdAt: number;
  features: string[];
}

interface TenantUsage {
  userCount: number;
  storageUsed: number; // MB
  apiCalls: number;
  lastActivity: number;
}

// ============================================================================
// Multi-Tenant Manager Class
// ============================================================================

class MultiTenantManager {
  private baseRedis;

  constructor(redis: any) {
    this.baseRedis = redis;
  }

  /**
   * Create tenant namespace
   */
  getTenantRedis(tenantId: string) {
    return createNamespacedRedis(this.baseRedis, `tenant:${tenantId}`);
  }

  /**
   * Register new tenant
   */
  async registerTenant(config: TenantConfig): Promise<void> {
    const tenants = createNamespacedRedis(this.baseRedis, "tenants");
    await tenants.setJSON(config.tenantId, config);
    console.log(`  ✅ Registered tenant: ${config.name} (${config.plan})`);
  }

  /**
   * Get tenant configuration
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    const tenants = createNamespacedRedis(this.baseRedis, "tenants");
    return await tenants.getJSON<TenantConfig>(tenantId);
  }

  /**
   * Get tenant usage stats
   */
  async getTenantUsage(tenantId: string): Promise<TenantUsage> {
    const tenant = this.getTenantRedis(tenantId);
    
    const userKeys = await tenant.scanAll("user:*");
    const userCount = userKeys.length;

    // Simulate storage calculation
    const storageUsed = userCount * 0.5; // 0.5 MB per user (simplified)

    const apiCalls = parseInt(await tenant.get("stats:api_calls") || "0");
    const lastActivity = parseInt(await tenant.get("stats:last_activity") || "0");

    return {
      userCount,
      storageUsed,
      apiCalls,
      lastActivity
    };
  }

  /**
   * Check tenant limits
   */
  async checkLimits(tenantId: string): Promise<{
    withinLimits: boolean;
    issues: string[];
  }> {
    const config = await this.getTenantConfig(tenantId);
    const usage = await this.getTenantUsage(tenantId);

    if (!config) {
      return { withinLimits: false, issues: ["Tenant not found"] };
    }

    const issues: string[] = [];

    if (usage.userCount >= config.maxUsers) {
      issues.push(`User limit reached (${usage.userCount}/${config.maxUsers})`);
    }

    if (usage.storageUsed >= config.maxStorage) {
      issues.push(`Storage limit reached (${usage.storageUsed}MB/${config.maxStorage}MB)`);
    }

    return {
      withinLimits: issues.length === 0,
      issues
    };
  }

  /**
   * Delete tenant and all data
   */
  async deleteTenant(tenantId: string): Promise<void> {
    // Clear tenant data
    await clearNamespace(this.baseRedis, `tenant:${tenantId}`);
    
    // Remove tenant config
    const tenants = createNamespacedRedis(this.baseRedis, "tenants");
    await tenants.del(tenantId);
    
    console.log(`  🗑️  Deleted tenant: ${tenantId}`);
  }

  /**
   * List all tenants
   */
  async listTenants(): Promise<TenantConfig[]> {
    const tenants = createNamespacedRedis(this.baseRedis, "tenants");
    const keys = await tenants.scanAll("*");
    
    const configs: TenantConfig[] = [];
    for (const key of keys) {
      const config = await tenants.getJSON<TenantConfig>(key);
      if (config) configs.push(config);
    }

    return configs;
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function main() {
  console.log("🏢 Demo 9: Multi-Tenant Application\n");

  await using redis = await createRedis("redis://localhost:6379");
  const manager = new MultiTenantManager(redis);

  // ============================================================================
  // Setup: Register Tenants
  // ============================================================================
  console.log("📝 Setting up tenants...\n");

  await manager.registerTenant({
    tenantId: "acme",
    name: "Acme Corporation",
    plan: "enterprise",
    maxUsers: 1000,
    maxStorage: 10000,
    createdAt: Date.now(),
    features: ["api", "sso", "custom_domain", "priority_support"]
  });

  await manager.registerTenant({
    tenantId: "startup",
    name: "Startup Inc",
    plan: "pro",
    maxUsers: 100,
    maxStorage: 1000,
    createdAt: Date.now(),
    features: ["api", "advanced_analytics"]
  });

  await manager.registerTenant({
    tenantId: "hobby",
    name: "Hobby Project",
    plan: "free",
    maxUsers: 10,
    maxStorage: 100,
    createdAt: Date.now(),
    features: ["basic"]
  });

  // ============================================================================
  // Use Case 1: Isolated Tenant Data
  // ============================================================================
  console.log("\n🔒 Use Case 1: Data Isolation");
  console.log("─────────────────────────────────────────");

  // Each tenant gets isolated data
  const acme = manager.getTenantRedis("acme");
  const startup = manager.getTenantRedis("startup");
  const hobby = manager.getTenantRedis("hobby");

  console.log("\nStoring tenant-specific data...\n");

  // Acme Corporation data
  await acme.setJSON("user:alice", {
    id: "alice",
    email: "alice@acme.com",
    role: "admin"
  });
  await acme.set("config:theme", "dark");
  await acme.incr("stats:api_calls");
  await acme.set("stats:last_activity", Date.now().toString());

  // Startup Inc data
  await startup.setJSON("user:bob", {
    id: "bob",
    email: "bob@startup.com",
    role: "owner"
  });
  await startup.set("config:theme", "light");
  await startup.incr("stats:api_calls");
  await startup.incr("stats:api_calls");
  await startup.set("stats:last_activity", Date.now().toString());

  // Hobby Project data
  await hobby.setJSON("user:charlie", {
    id: "charlie",
    email: "charlie@hobby.com",
    role: "user"
  });
  await hobby.set("config:theme", "auto");

  console.log("✅ Data stored in isolated namespaces");

  // Verify isolation
  const acmeTheme = await acme.get("config:theme");
  const startupTheme = await startup.get("config:theme");
  const hobbyTheme = await hobby.get("config:theme");

  console.log("\nVerifying isolation:");
  console.log(`  Acme theme: ${acmeTheme}`);
  console.log(`  Startup theme: ${startupTheme}`);
  console.log(`  Hobby theme: ${hobbyTheme}`);

  // ============================================================================
  // Use Case 2: Tenant Usage Tracking
  // ============================================================================
  console.log("\n\n📊 Use Case 2: Usage Tracking");
  console.log("─────────────────────────────────────────");

  const acmeUsage = await manager.getTenantUsage("acme");
  const startupUsage = await manager.getTenantUsage("startup");
  const hobbyUsage = await manager.getTenantUsage("hobby");

  console.log("\nAcme Corporation:");
  console.log(`  Users: ${acmeUsage.userCount}`);
  console.log(`  Storage: ${acmeUsage.storageUsed.toFixed(2)} MB`);
  console.log(`  API Calls: ${acmeUsage.apiCalls}`);

  console.log("\nStartup Inc:");
  console.log(`  Users: ${startupUsage.userCount}`);
  console.log(`  Storage: ${startupUsage.storageUsed.toFixed(2)} MB`);
  console.log(`  API Calls: ${startupUsage.apiCalls}`);

  console.log("\nHobby Project:");
  console.log(`  Users: ${hobbyUsage.userCount}`);
  console.log(`  Storage: ${hobbyUsage.storageUsed.toFixed(2)} MB`);
  console.log(`  API Calls: ${hobbyUsage.apiCalls}`);

  // ============================================================================
  // Use Case 3: Quota Enforcement
  // ============================================================================
  console.log("\n\n⚖️  Use Case 3: Quota Enforcement");
  console.log("─────────────────────────────────────────");

  // Add more users to hobby project
  console.log("\nAdding users to hobby project...");
  for (let i = 2; i <= 11; i++) {
    await hobby.setJSON(`user:user${i}`, {
      id: `user${i}`,
      email: `user${i}@hobby.com`
    });
  }

  const hobbyLimits = await manager.checkLimits("hobby");
  console.log("\nHobby Project limits check:");
  console.log(`  Within limits: ${hobbyLimits.withinLimits ? '✅' : '❌'}`);
  if (hobbyLimits.issues.length > 0) {
    console.log("  Issues:");
    hobbyLimits.issues.forEach(issue => console.log(`    - ${issue}`));
  }

  // ============================================================================
  // Use Case 4: Feature Flags per Tenant
  // ============================================================================
  console.log("\n\n🎚️  Use Case 4: Feature Access");
  console.log("─────────────────────────────────────────");

  const checkFeature = async (tenantId: string, feature: string): Promise<boolean> => {
    const config = await manager.getTenantConfig(tenantId);
    return config?.features.includes(feature) || false;
  };

  console.log("\nFeature access:");
  
  console.log("\n  SSO Access:");
  console.log(`    Acme: ${await checkFeature("acme", "sso") ? "✅" : "❌"}`);
  console.log(`    Startup: ${await checkFeature("startup", "sso") ? "✅" : "❌"}`);
  console.log(`    Hobby: ${await checkFeature("hobby", "sso") ? "✅" : "❌"}`);

  console.log("\n  API Access:");
  console.log(`    Acme: ${await checkFeature("acme", "api") ? "✅" : "❌"}`);
  console.log(`    Startup: ${await checkFeature("startup", "api") ? "✅" : "❌"}`);
  console.log(`    Hobby: ${await checkFeature("hobby", "api") ? "✅" : "❌"}`);

  // ============================================================================
  // Use Case 5: Tenant Administration
  // ============================================================================
  console.log("\n\n👨‍💼 Use Case 5: Tenant Administration");
  console.log("─────────────────────────────────────────");

  const tenants = await manager.listTenants();
  
  console.log(`\nTotal tenants: ${tenants.length}\n`);
  console.log("Tenant breakdown:");
  
  const byPlan = tenants.reduce((acc, t) => {
    acc[t.plan] = (acc[t.plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(byPlan).forEach(([plan, count]) => {
    console.log(`  ${plan}: ${count}`);
  });

  // ============================================================================
  // Use Case 6: Cross-Tenant Analytics
  // ============================================================================
  console.log("\n\n📈 Use Case 6: Platform-Wide Analytics");
  console.log("─────────────────────────────────────────");

  let totalUsers = 0;
  let totalStorage = 0;
  let totalApiCalls = 0;

  for (const tenant of tenants) {
    const usage = await manager.getTenantUsage(tenant.tenantId);
    totalUsers += usage.userCount;
    totalStorage += usage.storageUsed;
    totalApiCalls += usage.apiCalls;
  }

  console.log("\nPlatform totals:");
  console.log(`  Total users: ${totalUsers}`);
  console.log(`  Total storage: ${totalStorage.toFixed(2)} MB`);
  console.log(`  Total API calls: ${totalApiCalls}`);
  console.log(`  Average users per tenant: ${(totalUsers / tenants.length).toFixed(1)}`);

  // ============================================================================
  // Use Case 7: Tenant Data Export
  // ============================================================================
  console.log("\n\n📤 Use Case 7: Data Export (GDPR Compliance)");
  console.log("─────────────────────────────────────────");

  console.log("\nExporting Startup Inc data...");
  
  const startupKeys = await startup.scanAll("*");
  const exportData: Record<string, any> = {};

  for (const key of startupKeys) {
    // Try JSON first, fallback to string
    const jsonValue = await startup.getJSON(key);
    if (jsonValue !== null) {
      exportData[key] = jsonValue;
    } else {
      exportData[key] = await startup.get(key);
    }
  }

  console.log(`\nExported ${Object.keys(exportData).length} keys:`);
  Object.keys(exportData).forEach(key => {
    console.log(`  - ${key}`);
  });

  // ============================================================================
  // Best Practices Summary
  // ============================================================================
  console.log("\n\n💡 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Use namespaces for complete tenant isolation");
  console.log("  ✓ Store tenant configs in central location");
  console.log("  ✓ Track usage metrics per tenant");
  console.log("  ✓ Enforce quotas at application level");
  console.log("  ✓ Use feature flags for plan differentiation");
  console.log("  ✓ Implement tenant cleanup/deletion");
  console.log("  ✓ Provide data export for compliance");
  console.log("  ✓ Monitor resource usage per tenant");
  console.log("  ✓ Consider separate Redis instances for large tenants");
  console.log("  ✓ Implement tenant-aware rate limiting");

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");
  
  await manager.deleteTenant("acme");
  await manager.deleteTenant("startup");
  await manager.deleteTenant("hobby");
  
  await clearNamespace(redis, "tenants");

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
