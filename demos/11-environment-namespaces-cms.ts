/**
 * Demo 11: Environment Namespaces with CMS
 * 
 * Demonstrates environment-based namespace isolation with a practical
 * Content Management System example using Medicare D formulary data.
 * 
 * Shows how to:
 * - Isolate data across dev/staging/prod environments
 * - Implement full CRUD operations
 * - Manage medication formulary data
 * - Switch between environments safely
 * 
 * Run with: bun run demos/11-environment-namespaces-cms.ts
 */

import { createRedis, createNamespacedRedis, clearNamespace } from "../src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface Medication {
  id: string;
  name: string;
  genericName: string;
  tier: 1 | 2 | 3 | 4 | 5;
  copay: number;
  requiresPriorAuth: boolean;
  quantityLimit?: number;
  description: string;
  manufacturer: string;
  createdAt: number;
  updatedAt: number;
}

interface FormularyStats {
  totalMedications: number;
  byTier: Record<number, number>;
  requiresPriorAuth: number;
  averageCopay: number;
}

// ============================================================================
// Formulary CMS Class
// ============================================================================

class FormularyCMS {
  private cms;
  private environment: string;

  constructor(redis: any, environment: "development" | "staging" | "production") {
    this.environment = environment;
    this.cms = createNamespacedRedis(redis, `formulary:${environment}`);
  }

  /**
   * CREATE - Add a new medication to the formulary
   */
  async createMedication(medication: Omit<Medication, "id" | "createdAt" | "updatedAt">): Promise<Medication> {
    const id = `MED-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const fullMedication: Medication = {
      ...medication,
      id,
      createdAt: now,
      updatedAt: now
    };

    // Store medication
    await this.cms.setJSON(`medication:${id}`, fullMedication);

    // Index by tier for quick lookups
    await this.cms.sadd(`tier:${medication.tier}`, id);

    // Index by generic name for search
    const searchKey = medication.genericName.toLowerCase().replace(/\s+/g, "_");
    await this.cms.sadd(`search:${searchKey}`, id);

    // Track total count
    await this.cms.incr("stats:total");

    console.log(`  ✅ [${this.environment.toUpperCase()}] Created medication: ${medication.name} (${id})`);
    return fullMedication;
  }

  /**
   * READ - Get a medication by ID
   */
  async getMedication(id: string): Promise<Medication | null> {
    const medication = await this.cms.getJSON<Medication>(`medication:${id}`);
    
    if (medication) {
      console.log(`  📖 [${this.environment.toUpperCase()}] Retrieved: ${medication.name}`);
    }

    return medication;
  }

  /**
   * READ - Get all medications
   */
  async getAllMedications(): Promise<Medication[]> {
    const keys = await this.cms.scanAll("medication:*");
    const medications: Medication[] = [];

    for (const key of keys) {
      const med = await this.cms.getJSON<Medication>(key);
      if (med) medications.push(med);
    }

    return medications.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * READ - Get medications by tier
   */
  async getMedicationsByTier(tier: number): Promise<Medication[]> {
    const ids = await this.cms.smembers(`tier:${tier}`);
    const medications: Medication[] = [];

    for (const id of ids) {
      const med = await this.getMedication(id);
      if (med) medications.push(med);
    }

    return medications.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * READ - Search medications by generic name
   */
  async searchByGenericName(genericName: string): Promise<Medication[]> {
    const searchKey = genericName.toLowerCase().replace(/\s+/g, "_");
    const ids = await this.cms.smembers(`search:${searchKey}`);
    const medications: Medication[] = [];

    for (const id of ids) {
      const med = await this.getMedication(id);
      if (med) medications.push(med);
    }

    return medications;
  }

  /**
   * UPDATE - Update an existing medication
   */
  async updateMedication(
    id: string,
    updates: Partial<Omit<Medication, "id" | "createdAt" | "updatedAt">>
  ): Promise<Medication | null> {
    const existing = await this.getMedication(id);

    if (!existing) {
      console.log(`  ❌ [${this.environment.toUpperCase()}] Medication not found: ${id}`);
      return null;
    }

    // If tier is changing, update indexes
    if (updates.tier && updates.tier !== existing.tier) {
      await this.cms.srem(`tier:${existing.tier}`, id);
      await this.cms.sadd(`tier:${updates.tier}`, id);
    }

    // If generic name is changing, update search index
    if (updates.genericName && updates.genericName !== existing.genericName) {
      const oldSearchKey = existing.genericName.toLowerCase().replace(/\s+/g, "_");
      const newSearchKey = updates.genericName.toLowerCase().replace(/\s+/g, "_");
      await this.cms.srem(`search:${oldSearchKey}`, id);
      await this.cms.sadd(`search:${newSearchKey}`, id);
    }

    const updated: Medication = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };

    await this.cms.setJSON(`medication:${id}`, updated);

    console.log(`  ✏️  [${this.environment.toUpperCase()}] Updated medication: ${updated.name} (${id})`);
    return updated;
  }

  /**
   * DELETE - Remove a medication from the formulary
   */
  async deleteMedication(id: string): Promise<boolean> {
    const medication = await this.getMedication(id);

    if (!medication) {
      console.log(`  ❌ [${this.environment.toUpperCase()}] Medication not found: ${id}`);
      return false;
    }

    // Remove from tier index
    await this.cms.srem(`tier:${medication.tier}`, id);

    // Remove from search index
    const searchKey = medication.genericName.toLowerCase().replace(/\s+/g, "_");
    await this.cms.srem(`search:${searchKey}`, id);

    // Delete the medication
    await this.cms.del(`medication:${id}`);

    // Update count
    await this.cms.decr("stats:total");

    console.log(`  🗑️  [${this.environment.toUpperCase()}] Deleted medication: ${medication.name} (${id})`);
    return true;
  }

  /**
   * Get formulary statistics
   */
  async getStats(): Promise<FormularyStats> {
    const medications = await this.getAllMedications();

    const byTier: Record<number, number> = {};
    let requiresPriorAuth = 0;
    let totalCopay = 0;

    medications.forEach(med => {
      byTier[med.tier] = (byTier[med.tier] || 0) + 1;
      if (med.requiresPriorAuth) requiresPriorAuth++;
      totalCopay += med.copay;
    });

    return {
      totalMedications: medications.length,
      byTier,
      requiresPriorAuth,
      averageCopay: medications.length > 0 ? totalCopay / medications.length : 0
    };
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Clear all data in this environment
   */
  async clearAll(): Promise<number> {
    const keys = await this.cms.scanAll("*");
    if (keys.length > 0) {
      await this.cms.del(...keys);
    }
    return keys.length;
  }
}

// ============================================================================
// Demo Application
// ============================================================================

async function displayMedication(med: Medication): void {
  console.log(`\n    ID: ${med.id}`);
  console.log(`    Name: ${med.name}`);
  console.log(`    Generic: ${med.genericName}`);
  console.log(`    Tier: ${med.tier} | Copay: $${med.copay.toFixed(2)}`);
  console.log(`    Prior Auth: ${med.requiresPriorAuth ? "Required" : "Not Required"}`);
  if (med.quantityLimit) {
    console.log(`    Quantity Limit: ${med.quantityLimit} units/month`);
  }
  console.log(`    Manufacturer: ${med.manufacturer}`);
}

async function displayStats(stats: FormularyStats, environment: string): void {
  console.log(`\n  📊 ${environment.toUpperCase()} Statistics:`);
  console.log(`    Total Medications: ${stats.totalMedications}`);
  console.log(`    By Tier:`);
  Object.entries(stats.byTier).forEach(([tier, count]) => {
    console.log(`      Tier ${tier}: ${count}`);
  });
  console.log(`    Require Prior Auth: ${stats.requiresPriorAuth}`);
  console.log(`    Average Copay: $${stats.averageCopay.toFixed(2)}`);
}

async function main() {
  console.log("🏥 Demo 11: Environment Namespaces with CMS\n");
  console.log("Medicare D Formulary Management System\n");

  await using redis = await createRedis("redis://localhost:6379");

  // ============================================================================
  // Setup: Create Environment-Specific CMS Instances
  // ============================================================================
  console.log("🌍 Setting up environment namespaces...\n");

  const devCMS = new FormularyCMS(redis, "development");
  const stagingCMS = new FormularyCMS(redis, "staging");
  const prodCMS = new FormularyCMS(redis, "production");

  console.log("✅ Created isolated environments:");
  console.log("   - Development (formulary:development)");
  console.log("   - Staging (formulary:staging)");
  console.log("   - Production (formulary:production)");

  // ============================================================================
  // DEVELOPMENT: Create Sample Medications
  // ============================================================================
  console.log("\n\n📝 DEVELOPMENT: Creating Medications");
  console.log("─────────────────────────────────────────\n");

  const lipitor = await devCMS.createMedication({
    name: "Lipitor",
    genericName: "atorvastatin",
    tier: 2,
    copay: 10.00,
    requiresPriorAuth: false,
    quantityLimit: 30,
    description: "Statin medication for cholesterol management",
    manufacturer: "Pfizer"
  });

  const metformin = await devCMS.createMedication({
    name: "Glucophage",
    genericName: "metformin",
    tier: 1,
    copay: 5.00,
    requiresPriorAuth: false,
    quantityLimit: 60,
    description: "Diabetes medication",
    manufacturer: "Bristol-Myers Squibb"
  });

  const humira = await devCMS.createMedication({
    name: "Humira",
    genericName: "adalimumab",
    tier: 5,
    copay: 150.00,
    requiresPriorAuth: true,
    quantityLimit: 2,
    description: "Biologic for autoimmune conditions",
    manufacturer: "AbbVie"
  });

  // ============================================================================
  // READ: Get Medication by ID
  // ============================================================================
  console.log("\n\n📖 DEVELOPMENT: Reading Medication");
  console.log("─────────────────────────────────────────");

  const retrievedLipitor = await devCMS.getMedication(lipitor.id);
  if (retrievedLipitor) {
    displayMedication(retrievedLipitor);
  }

  // ============================================================================
  // READ: Get All Medications
  // ============================================================================
  console.log("\n\n📚 DEVELOPMENT: All Medications");
  console.log("─────────────────────────────────────────");

  const allMeds = await devCMS.getAllMedications();
  console.log(`\n  Found ${allMeds.length} medications:`);
  allMeds.forEach((med, i) => {
    console.log(`    ${i + 1}. ${med.name} (${med.genericName}) - Tier ${med.tier}`);
  });

  // ============================================================================
  // READ: Get by Tier
  // ============================================================================
  console.log("\n\n🏷️  DEVELOPMENT: Medications by Tier");
  console.log("─────────────────────────────────────────");

  const tier1Meds = await devCMS.getMedicationsByTier(1);
  console.log(`\n  Tier 1 Medications (Lowest Cost):`);
  tier1Meds.forEach(med => {
    console.log(`    - ${med.name}: $${med.copay.toFixed(2)}`);
  });

  // ============================================================================
  // READ: Search by Generic Name
  // ============================================================================
  console.log("\n\n🔍 DEVELOPMENT: Search by Generic Name");
  console.log("─────────────────────────────────────────");

  const statinResults = await devCMS.searchByGenericName("atorvastatin");
  console.log(`\n  Found ${statinResults.length} medication(s) for "atorvastatin":`);
  statinResults.forEach(med => {
    console.log(`    - ${med.name} (Tier ${med.tier})`);
  });

  // ============================================================================
  // UPDATE: Modify Medication
  // ============================================================================
  console.log("\n\n✏️  DEVELOPMENT: Updating Medication");
  console.log("─────────────────────────────────────────\n");

  const updatedLipitor = await devCMS.updateMedication(lipitor.id, {
    copay: 12.50,
    tier: 3,
    description: "Statin medication for cholesterol - Updated formulary"
  });

  if (updatedLipitor) {
    console.log("\n  Updated fields:");
    console.log(`    Copay: $10.00 → $${updatedLipitor.copay.toFixed(2)}`);
    console.log(`    Tier: 2 → ${updatedLipitor.tier}`);
  }

  // ============================================================================
  // ENVIRONMENT ISOLATION: Add to Staging
  // ============================================================================
  console.log("\n\n🚀 STAGING: Promoting to Staging Environment");
  console.log("─────────────────────────────────────────\n");

  await stagingCMS.createMedication({
    name: "Lipitor",
    genericName: "atorvastatin",
    tier: 3,
    copay: 12.50,
    requiresPriorAuth: false,
    quantityLimit: 30,
    description: "Statin medication for cholesterol - Updated formulary",
    manufacturer: "Pfizer"
  });

  await stagingCMS.createMedication({
    name: "Glucophage",
    genericName: "metformin",
    tier: 1,
    copay: 5.00,
    requiresPriorAuth: false,
    quantityLimit: 60,
    description: "Diabetes medication",
    manufacturer: "Bristol-Myers Squibb"
  });

  // ============================================================================
  // ENVIRONMENT ISOLATION: Verify Isolation
  // ============================================================================
  console.log("\n\n🔒 Verifying Environment Isolation");
  console.log("─────────────────────────────────────────");

  const devStats = await devCMS.getStats();
  const stagingStats = await stagingCMS.getStats();
  const prodStats = await prodCMS.getStats();

  console.log("\n  Environment Data:");
  console.log(`    DEV:     ${devStats.totalMedications} medications`);
  console.log(`    STAGING: ${stagingStats.totalMedications} medications`);
  console.log(`    PROD:    ${prodStats.totalMedications} medications`);

  console.log("\n  ✅ Environments are properly isolated!");

  // ============================================================================
  // PRODUCTION: Deploy to Production
  // ============================================================================
  console.log("\n\n✈️  PRODUCTION: Deploying to Production");
  console.log("─────────────────────────────────────────\n");

  // Simulate production deployment (in real app, you'd have a deployment script)
  await prodCMS.createMedication({
    name: "Lipitor",
    genericName: "atorvastatin",
    tier: 3,
    copay: 12.50,
    requiresPriorAuth: false,
    quantityLimit: 30,
    description: "Statin medication for cholesterol - Updated formulary",
    manufacturer: "Pfizer"
  });

  await prodCMS.createMedication({
    name: "Glucophage",
    genericName: "metformin",
    tier: 1,
    copay: 5.00,
    requiresPriorAuth: false,
    quantityLimit: 60,
    description: "Diabetes medication",
    manufacturer: "Bristol-Myers Squibb"
  });

  console.log("\n✅ Production deployment complete!");

  // ============================================================================
  // DELETE: Remove from Development
  // ============================================================================
  console.log("\n\n🗑️  DEVELOPMENT: Deleting Test Medication");
  console.log("─────────────────────────────────────────\n");

  await devCMS.deleteMedication(humira.id);

  const afterDelete = await devCMS.getStats();
  console.log(`\n  Medications remaining: ${afterDelete.totalMedications}`);

  // ============================================================================
  // Statistics Comparison
  // ============================================================================
  console.log("\n\n📊 Environment Statistics Comparison");
  console.log("═════════════════════════════════════════");

  await displayStats(await devCMS.getStats(), "development");
  await displayStats(await stagingCMS.getStats(), "staging");
  await displayStats(await prodCMS.getStats(), "production");

  // ============================================================================
  // Real-World Scenario: Testing in Dev
  // ============================================================================
  console.log("\n\n🧪 Real-World Scenario: Testing in Development");
  console.log("─────────────────────────────────────────\n");

  console.log("  Adding experimental medication to DEV only...\n");

  const experimental = await devCMS.createMedication({
    name: "ExperimentalDrug-X",
    genericName: "experimental compound",
    tier: 4,
    copay: 75.00,
    requiresPriorAuth: true,
    description: "Testing new formulary entry",
    manufacturer: "Test Pharma"
  });

  console.log("\n  ✅ Test medication added to DEV");
  console.log("  ❌ NOT in staging or production");
  console.log("\n  This allows safe testing without affecting other environments!");

  // ============================================================================
  // Use Case Examples
  // ============================================================================
  console.log("\n\n💡 Common Use Cases:");
  console.log("═════════════════════════════════════════");
  console.log("\n  1. Development Environment:");
  console.log("     - Test new medications");
  console.log("     - Experiment with pricing");
  console.log("     - Try different tier assignments");
  console.log("\n  2. Staging Environment:");
  console.log("     - QA testing before production");
  console.log("     - Client demos");
  console.log("     - Integration testing");
  console.log("\n  3. Production Environment:");
  console.log("     - Live formulary data");
  console.log("     - Real patient lookups");
  console.log("     - Actual copay calculations");

  // ============================================================================
  // Best Practices
  // ============================================================================
  console.log("\n\n🎯 Best Practices:");
  console.log("─────────────────────────────────────────");
  console.log("  ✓ Use environment-based namespaces");
  console.log("  ✓ Never mix production and test data");
  console.log("  ✓ Test thoroughly in dev before staging");
  console.log("  ✓ Use staging as pre-production validation");
  console.log("  ✓ Implement proper indexing for search");
  console.log("  ✓ Track created/updated timestamps");
  console.log("  ✓ Maintain referential integrity");
  console.log("  ✓ Use sets for categorical indexing");
  console.log("  ✓ Clear dev/staging regularly, never clear prod");

  // ============================================================================
  // Environment Configuration
  // ============================================================================
  console.log("\n\n⚙️  Environment Configuration Tips:");
  console.log("─────────────────────────────────────────");
  console.log("\n  // In your application code:");
  console.log(`  const env = process.env.NODE_ENV || "development";`);
  console.log(`  const cms = new FormularyCMS(redis, env);`);
  console.log("\n  // Set environment:");
  console.log(`  export NODE_ENV=production`);
  console.log(`  export NODE_ENV=staging`);
  console.log(`  export NODE_ENV=development`);

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n\n🧹 Cleaning up test environments...");
  
  const devCleared = await devCMS.clearAll();
  const stagingCleared = await stagingCMS.clearAll();
  const prodCleared = await prodCMS.clearAll();

  console.log(`\n  Cleared ${devCleared} keys from development`);
  console.log(`  Cleared ${stagingCleared} keys from staging`);
  console.log(`  Cleared ${prodCleared} keys from production`);

  console.log("\n✨ Demo complete!");
}

main().catch(console.error);
