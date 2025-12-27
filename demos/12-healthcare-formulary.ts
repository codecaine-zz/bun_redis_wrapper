/**
 * Demo 12: Healthcare Formulary Management
 * 
 * Demonstrates Medicare Part D formulary management with:
 * - Drug CRUD operations
 * - Tier management
 * - Step therapy rules
 * - Prior authorization (PA) workflows
 * - Search and filtering
 * - Bulk imports
 * 
 * Perfect for: Healthcare applications, pharmacy systems, insurance platforms
 * 
 * Run: bun run demos/12-healthcare-formulary.ts
 */

import { createRedis } from "../src/index";
import { FormularyController } from "../src/controllers/FormularyController";
import type { Drug, StepTherapyRule, PriorAuthCriteria } from "../src/controllers/FormularyController";

console.log("🏥 Medicare Part D Formulary Management Demo\n");
console.log("=".repeat(70));

// Connect to Redis
await using redis = await createRedis();

// Create formulary for 2024 plan
const formulary = new FormularyController(redis, "medicare-2024");

// Clear any existing data for clean demo
await formulary.clearFormulary();

// ============================================================================
// Feature 1: Add Drugs to Formulary (CRUD - Create)
// ============================================================================
console.log("\n\n📋 Feature 1: Adding Drugs to Formulary");
console.log("─".repeat(70));

const drugs: Drug[] = [
  {
    ndc: "00003-0293-21",
    name: "Lipitor",
    genericName: "Atorvastatin",
    tier: 2,
    requiresPA: false,
    stepTherapy: false,
    therapeuticClass: "Statins",
    strength: "20mg",
    form: "Tablet",
    quantityLimit: { quantity: 30, days: 30 }
  },
  {
    ndc: "00186-0878-60",
    name: "Crestor",
    genericName: "Rosuvastatin",
    tier: 3,
    requiresPA: false,
    stepTherapy: true,
    therapeuticClass: "Statins",
    strength: "10mg",
    form: "Tablet",
    quantityLimit: { quantity: 30, days: 30 }
  },
  {
    ndc: "00078-0357-15",
    name: "Lyrica",
    genericName: "Pregabalin",
    tier: 4,
    requiresPA: true,
    stepTherapy: true,
    therapeuticClass: "Anticonvulsants",
    strength: "75mg",
    form: "Capsule",
    restrictions: ["Neuropathic pain only", "Max 450mg/day"]
  },
  {
    ndc: "00173-0830-00",
    name: "Humira",
    genericName: "Adalimumab",
    tier: 5,
    requiresPA: true,
    stepTherapy: true,
    therapeuticClass: "Biologics",
    strength: "40mg/0.8mL",
    form: "Injection",
    restrictions: ["Specialty medication", "Requires disease diagnosis"]
  },
  {
    ndc: "00002-7510-01",
    name: "Prozac",
    genericName: "Fluoxetine",
    tier: 1,
    requiresPA: false,
    stepTherapy: false,
    therapeuticClass: "Antidepressants",
    strength: "20mg",
    form: "Capsule"
  },
  {
    ndc: "00591-3606-01",
    name: "Metformin",
    genericName: "Metformin",
    tier: 1,
    requiresPA: false,
    stepTherapy: false,
    therapeuticClass: "Antidiabetics",
    strength: "500mg",
    form: "Tablet"
  }
];

console.log("Adding 6 drugs to formulary...");
const importResult = await formulary.bulkImportDrugs(drugs);
console.log(`✅ Successfully imported: ${importResult.success} drugs`);
console.log(`❌ Failed: ${importResult.failed} drugs\n`);

// Show some added drugs
const lipitor = await formulary.getDrug("00003-0293-21");
console.log("📊 Sample Drug Entry:");
console.log(`   Name: ${lipitor?.name} (${lipitor?.genericName})`);
console.log(`   Tier: ${lipitor?.tier}`);
console.log(`   Class: ${lipitor?.therapeuticClass}`);
console.log(`   PA Required: ${lipitor?.requiresPA ? "Yes" : "No"}`);
console.log(`   Step Therapy: ${lipitor?.stepTherapy ? "Yes" : "No"}`);

// ============================================================================
// Feature 2: Search Drugs by Name
// ============================================================================
console.log("\n\n🔍 Feature 2: Searching Drugs");
console.log("─".repeat(70));

console.log("\nSearching for 'statin'...");
const statinResults = await formulary.searchDrugs("statin");
console.log(`Found ${statinResults.length} results:`);
statinResults.forEach(drug => {
  console.log(`  • ${drug.name} (${drug.genericName}) - Tier ${drug.tier}`);
});

console.log("\nSearching for 'lipitor'...");
const lipitorResults = await formulary.searchDrugs("lipitor");
console.log(`Found ${lipitorResults.length} results:`);
lipitorResults.forEach(drug => {
  console.log(`  • ${drug.name} (${drug.genericName}) - Tier ${drug.tier}`);
});

// ============================================================================
// Feature 3: Filter by Tier
// ============================================================================
console.log("\n\n🎯 Feature 3: Filtering by Tier");
console.log("─".repeat(70));

for (let tier = 1; tier <= 5; tier++) {
  const tierDrugs = await formulary.getDrugsByTier(tier);
  if (tierDrugs.length > 0) {
    console.log(`\nTier ${tier} (${tierDrugs.length} drugs):`);
    tierDrugs.forEach(drug => {
      console.log(`  • ${drug.name} - $${getTierCopay(tier)}`);
    });
  }
}

function getTierCopay(tier: number): string {
  const copays = ["", "10", "35", "70", "150", "33% coinsurance"];
  return copays[tier] || "N/A";
}

// ============================================================================
// Feature 4: Prior Authorization (PA) Management
// ============================================================================
console.log("\n\n📝 Feature 4: Prior Authorization Workflow");
console.log("─".repeat(70));

console.log("\nDrugs requiring PA:");
const paDrugs = await formulary.getDrugsRequiringPA();
paDrugs.forEach(drug => {
  console.log(`  • ${drug.name} (${drug.genericName}) - Tier ${drug.tier}`);
});

// Add PA criteria for Lyrica
const lyricaPACriteria: PriorAuthCriteria = {
  drugNDC: "00078-0357-15",
  criteria: [
    "Documented diagnosis of neuropathic pain",
    "Failed trial of generic gabapentin for 30+ days",
    "No contraindications present",
    "Prescribed by neurologist or pain specialist"
  ],
  duration: 365, // 1 year approval
  expeditedAvailable: true
};

await formulary.addPACriteria(lyricaPACriteria);
console.log("\n✅ Added PA criteria for Lyrica");

const criteria = await formulary.getPACriteria("00078-0357-15");
console.log("\n📋 PA Requirements for Lyrica:");
criteria?.criteria.forEach((req, i) => {
  console.log(`   ${i + 1}. ${req}`);
});
console.log(`   Duration: ${criteria?.duration} days`);
console.log(`   Expedited: ${criteria?.expeditedAvailable ? "Available" : "Not available"}`);

// Submit a PA request
const requestId = `PA-${Date.now()}`;
await formulary.submitPARequest(
  requestId,
  "00078-0357-15",
  "patient-12345",
  "prescriber-789"
);
console.log(`\n✅ PA request submitted: ${requestId}`);

const paStatus = await formulary.getPAStatus(requestId);
console.log(`   Status: ${paStatus.status}`);
console.log(`   Submitted: ${new Date(paStatus.submittedAt).toLocaleString()}`);

// ============================================================================
// Feature 5: Step Therapy Rules
// ============================================================================
console.log("\n\n🪜 Feature 5: Step Therapy Management");
console.log("─".repeat(70));

console.log("\nDrugs with step therapy:");
const stepDrugs = await formulary.getDrugsWithStepTherapy();
stepDrugs.forEach(drug => {
  console.log(`  • ${drug.name} - Must try generic alternatives first`);
});

// Add step therapy rule for Crestor
const crestorStepRule: StepTherapyRule = {
  drugNDC: "00186-0878-60",
  requiredDrugs: ["00003-0293-21"], // Must try Lipitor first
  duration: 30, // 30 day trial
  exceptions: ["Documented adverse reaction to atorvastatin"]
};

await formulary.addStepTherapyRule(crestorStepRule);
console.log("\n✅ Added step therapy rule for Crestor");
console.log("   Requirement: Must try Lipitor (generic statin) first");
console.log("   Duration: 30 days minimum trial");

// Check patient compliance
const patientHistory = ["00003-0293-21"]; // Patient tried Lipitor
const compliance = await formulary.checkStepTherapyCompliance(
  "00186-0878-60",
  patientHistory
);

console.log(`\n📊 Step Therapy Compliance Check:`);
console.log(`   Compliant: ${compliance.compliant ? "✅ Yes" : "❌ No"}`);
if (!compliance.compliant) {
  console.log(`   Missing drugs: ${compliance.missingDrugs.join(", ")}`);
}

// Check non-compliant patient
const newPatientHistory: string[] = []; // New patient, no history
const newCompliance = await formulary.checkStepTherapyCompliance(
  "00186-0878-60",
  newPatientHistory
);

console.log(`\n📊 New Patient Compliance Check:`);
console.log(`   Compliant: ${newCompliance.compliant ? "✅ Yes" : "❌ No"}`);
if (!newCompliance.compliant) {
  console.log(`   Must try: ${newCompliance.missingDrugs.length} drug(s) first`);
}

// ============================================================================
// Feature 6: Therapeutic Class Filtering
// ============================================================================
console.log("\n\n💊 Feature 6: Therapeutic Class Filtering");
console.log("─".repeat(70));

const classes = await formulary.getTherapeuticClasses();
console.log(`\nAvailable therapeutic classes: ${classes.length}`);

for (const className of classes) {
  const classDrugs = await formulary.getDrugsByClass(className);
  console.log(`\n${className} (${classDrugs.length} drugs):`);
  classDrugs.forEach(drug => {
    console.log(`  • ${drug.name} (${drug.genericName}) - Tier ${drug.tier}`);
  });
}

// ============================================================================
// Feature 7: Advanced Search with Multiple Filters
// ============================================================================
console.log("\n\n🔬 Feature 7: Advanced Multi-Filter Search");
console.log("─".repeat(70));

console.log("\nSearch: Tier 1 drugs (Generic/Preferred)");
const tier1Drugs = await formulary.advancedSearch({ tier: 1 });
console.log(`Found ${tier1Drugs.length} results:`);
tier1Drugs.forEach(drug => {
  console.log(`  • ${drug.name} - $10 copay`);
});

console.log("\nSearch: Drugs requiring both PA and Step Therapy");
const restrictedDrugs = await formulary.advancedSearch({
  requiresPA: true,
  stepTherapy: true
});
console.log(`Found ${restrictedDrugs.length} results:`);
restrictedDrugs.forEach(drug => {
  console.log(`  • ${drug.name} (Tier ${drug.tier}) - Requires authorization`);
});

console.log("\nSearch: Statin drugs only");
const statins = await formulary.advancedSearch({
  therapeuticClass: "Statins"
});
console.log(`Found ${statins.length} results:`);
statins.forEach(drug => {
  console.log(`  • ${drug.name} - Tier ${drug.tier}, ${drug.stepTherapy ? "Step therapy" : "No restrictions"}`);
});

// ============================================================================
// Feature 8: Update Drug Information (CRUD - Update)
// ============================================================================
console.log("\n\n✏️  Feature 8: Updating Drug Information");
console.log("─".repeat(70));

console.log("\nUpdating Metformin tier from 1 to 2...");
const updated = await formulary.updateDrug("00591-3606-01", {
  tier: 2,
  restrictions: ["Renal function monitoring required"]
});

if (updated) {
  const metformin = await formulary.getDrug("00591-3606-01");
  console.log("✅ Drug updated successfully");
  console.log(`   New Tier: ${metformin?.tier}`);
  console.log(`   Restrictions: ${metformin?.restrictions?.join(", ")}`);
}

// ============================================================================
// Feature 9: Formulary Statistics
// ============================================================================
console.log("\n\n📊 Feature 9: Formulary Statistics & Analytics");
console.log("─".repeat(70));

const stats = await formulary.getFormularyStats();
console.log(`\nFormulary Overview:`);
console.log(`  Total Drugs: ${stats.totalDrugs}`);
console.log(`  Requiring PA: ${stats.paRequired} (${((stats.paRequired / stats.totalDrugs) * 100).toFixed(1)}%)`);
console.log(`  With Step Therapy: ${stats.stepTherapy} (${((stats.stepTherapy / stats.totalDrugs) * 100).toFixed(1)}%)`);

console.log(`\nDrugs by Tier:`);
for (const [tier, count] of Object.entries(stats.drugsByTier)) {
  if (count > 0) {
    const percentage = ((count / stats.totalDrugs) * 100).toFixed(1);
    console.log(`  Tier ${tier}: ${count} drugs (${percentage}%)`);
  }
}

// ============================================================================
// Feature 10: Export Formulary (CRUD - Read All)
// ============================================================================
console.log("\n\n💾 Feature 10: Export Formulary Data");
console.log("─".repeat(70));

const exportedDrugs = await formulary.exportFormulary();
console.log(`\n✅ Exported ${exportedDrugs.length} drugs from formulary`);
console.log("   Data can be saved to JSON, CSV, or sent to another system");

// Show sample export format
console.log("\nSample Export (first 2 drugs):");
exportedDrugs.slice(0, 2).forEach(drug => {
  console.log(`\n  {`);
  console.log(`    ndc: "${drug.ndc}",`);
  console.log(`    name: "${drug.name}",`);
  console.log(`    genericName: "${drug.genericName}",`);
  console.log(`    tier: ${drug.tier},`);
  console.log(`    requiresPA: ${drug.requiresPA},`);
  console.log(`    stepTherapy: ${drug.stepTherapy}`);
  console.log(`  }`);
});

// ============================================================================
// Feature 11: Delete Drug (CRUD - Delete)
// ============================================================================
console.log("\n\n🗑️  Feature 11: Removing Drugs from Formulary");
console.log("─".repeat(70));

console.log("\nRemoving Prozac from formulary...");
const removed = await formulary.removeDrug("00002-7510-01");
console.log(`${removed ? "✅" : "❌"} Drug ${removed ? "removed" : "not found"}`);

const prozac = await formulary.getDrug("00002-7510-01");
console.log(`Verification: ${prozac === null ? "✅ Drug no longer exists" : "❌ Drug still exists"}`);

// ============================================================================
// Summary
// ============================================================================
console.log("\n\n" + "=".repeat(70));
console.log("🎉 Healthcare Formulary Demo Complete!");
console.log("=".repeat(70));

console.log("\n📚 What We Demonstrated:\n");
console.log("1. ✅ CRUD Operations");
console.log("   - Create: Add drugs with all metadata");
console.log("   - Read: Get drug details by NDC");
console.log("   - Update: Modify drug information");
console.log("   - Delete: Remove drugs from formulary");

console.log("\n2. ✅ Search & Discovery");
console.log("   - Search by name (brand or generic)");
console.log("   - Filter by tier, PA requirements, step therapy");
console.log("   - Filter by therapeutic class");
console.log("   - Multi-criteria advanced search");

console.log("\n3. ✅ Prior Authorization (PA)");
console.log("   - Define PA criteria");
console.log("   - Submit PA requests");
console.log("   - Track PA status");
console.log("   - Expedited review tracking");

console.log("\n4. ✅ Step Therapy");
console.log("   - Define step therapy rules");
console.log("   - Check patient compliance");
console.log("   - Track required drug trials");
console.log("   - Exception handling");

console.log("\n5. ✅ Bulk Operations");
console.log("   - Import multiple drugs");
console.log("   - Export entire formulary");
console.log("   - Batch processing");

console.log("\n6. ✅ Analytics");
console.log("   - Formulary statistics");
console.log("   - Tier distribution");
console.log("   - PA/Step therapy metrics");

console.log("\n\n💡 Real-World Applications:\n");
console.log("• Medicare Part D plan management");
console.log("• Commercial insurance formularies");
console.log("• Pharmacy benefit managers (PBM)");
console.log("• Healthcare provider EHR systems");
console.log("• Patient medication lookup portals");
console.log("• Drug utilization review systems");
console.log("• Formulary comparison tools");

console.log("\n\n🚀 Production Tips:\n");
console.log("1. Add Redis indexes for faster searches");
console.log("2. Implement caching for frequently accessed drugs");
console.log("3. Use TTLs for PA requests (they expire)");
console.log("4. Add audit logging for all changes");
console.log("5. Implement role-based access control");
console.log("6. Set up alerts for low-tier drug availability");
console.log("7. Create automated reports for CMS compliance");
console.log("8. Add version control for formulary changes");
console.log("9. Implement bulk import validation");
console.log("10. Create backup/restore procedures");

console.log("\n✅ Redis connection closed");
