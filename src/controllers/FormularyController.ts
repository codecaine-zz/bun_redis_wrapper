/**
 * FormularyController - Healthcare Formulary Management
 * 
 * Manages Medicare Part D formulary data including:
 * - Drug formularies with tiers and restrictions
 * - Step therapy rules
 * - Prior authorization (PA) requirements
 * - Quantity limits
 * - Drug searches and filtering
 * 
 * Perfect for: Healthcare apps, pharmacy systems, insurance platforms
 * 
 * @example
 * ```typescript
 * const formulary = new FormularyController(redis, "plan-2024");
 * 
 * // Add drug to formulary
 * await formulary.addDrug({
 *   ndc: "00003-0293-21",
 *   name: "Lipitor",
 *   genericName: "Atorvastatin",
 *   tier: 2,
 *   requiresPA: false,
 *   stepTherapy: true,
 *   quantityLimit: { quantity: 30, days: 30 }
 * });
 * 
 * // Search drugs
 * const results = await formulary.searchDrugs("lipitor");
 * 
 * // Get tier drugs
 * const tier2Drugs = await formulary.getDrugsByTier(2);
 * ```
 */

import type { RedisWrapper } from "../redis-wrapper";

// ============================================================================
// Types
// ============================================================================

export interface Drug {
  ndc: string;                    // National Drug Code (unique ID)
  name: string;                   // Brand name
  genericName: string;            // Generic name
  tier: number;                   // Formulary tier (1-5)
  requiresPA: boolean;            // Prior Authorization required
  stepTherapy: boolean;           // Step therapy required
  quantityLimit?: QuantityLimit;  // Quantity restrictions
  restrictions?: string[];        // Additional restrictions
  therapeuticClass?: string;      // Drug class (e.g., "Statins")
  strength?: string;              // Dosage strength
  form?: string;                  // Form (tablet, capsule, etc.)
}

export interface QuantityLimit {
  quantity: number;               // Max quantity
  days: number;                   // Per number of days
}

export interface StepTherapyRule {
  drugNDC: string;                // Drug requiring step therapy
  requiredDrugs: string[];        // Must try these first (NDCs)
  duration?: number;              // How long to try (days)
  exceptions?: string[];          // Conditions for exceptions
}

export interface PriorAuthCriteria {
  drugNDC: string;
  criteria: string[];             // Requirements for approval
  duration?: number;              // Approval duration (days)
  expeditedAvailable: boolean;    // Can request expedited review
}

export interface FormularySearchOptions {
  tier?: number;
  requiresPA?: boolean;
  stepTherapy?: boolean;
  therapeuticClass?: string;
  limit?: number;
}

// ============================================================================
// FormularyController
// ============================================================================

export class FormularyController {
  private prefix: string;

  constructor(
    private redis: RedisWrapper,
    private planId: string = "default"
  ) {
    this.prefix = `formulary:${planId}`;
  }

  // ==========================================================================
  // Drug CRUD Operations
  // ==========================================================================

  /**
   * Add or update a drug in the formulary
   */
  async addDrug(drug: Drug): Promise<void> {
    const key = `${this.prefix}:drug:${drug.ndc}`;
    
    // Store drug data as JSON
    await this.redis.setJSON(key, drug);

    // Add to tier index for filtering
    await this.redis.command("SADD", `${this.prefix}:tier:${drug.tier}`, drug.ndc);

    // Add to search indexes
    const searchTerms = [
      ...drug.name.toLowerCase().split(/\s+/),
      ...drug.genericName.toLowerCase().split(/\s+/)
    ];
    
    for (const term of searchTerms) {
      if (term.length >= 3) {
        await this.redis.command("SADD", `${this.prefix}:search:${term}`, drug.ndc);
      }
    }

    // Add to PA index if required
    if (drug.requiresPA) {
      await this.redis.command("SADD", `${this.prefix}:pa-required`, drug.ndc);
    }

    // Add to step therapy index
    if (drug.stepTherapy) {
      await this.redis.command("SADD", `${this.prefix}:step-therapy`, drug.ndc);
    }

    // Add to therapeutic class index
    if (drug.therapeuticClass) {
      await this.redis.command(
        "SADD",
        `${this.prefix}:class:${drug.therapeuticClass.toLowerCase()}`,
        drug.ndc
      );
    }
  }

  /**
   * Get drug details by NDC
   */
  async getDrug(ndc: string): Promise<Drug | null> {
    const key = `${this.prefix}:drug:${ndc}`;
    return await this.redis.getJSON<Drug>(key);
  }

  /**
   * Update drug information
   */
  async updateDrug(ndc: string, updates: Partial<Drug>): Promise<boolean> {
    const existing = await this.getDrug(ndc);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    await this.addDrug(updated);
    return true;
  }

  /**
   * Remove drug from formulary
   */
  async removeDrug(ndc: string): Promise<boolean> {
    const drug = await this.getDrug(ndc);
    if (!drug) return false;

    // Remove main record
    const key = `${this.prefix}:drug:${ndc}`;
    await this.redis.del(key);

    // Remove from all indexes
    await this.redis.command("SREM", `${this.prefix}:tier:${drug.tier}`, ndc);
    await this.redis.command("SREM", `${this.prefix}:pa-required`, ndc);
    await this.redis.command("SREM", `${this.prefix}:step-therapy`, ndc);
    
    if (drug.therapeuticClass) {
      await this.redis.command(
        "SREM",
        `${this.prefix}:class:${drug.therapeuticClass.toLowerCase()}`,
        ndc
      );
    }

    // Note: Search terms cleanup is expensive, consider periodic cleanup

    return true;
  }

  /**
   * Bulk import drugs
   */
  async bulkImportDrugs(drugs: Drug[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const drug of drugs) {
      try {
        await this.addDrug(drug);
        success++;
      } catch (error) {
        failed++;
        console.error(`Failed to import drug ${drug.ndc}:`, error);
      }
    }

    return { success, failed };
  }

  // ==========================================================================
  // Search & Query Operations
  // ==========================================================================

  /**
   * Search drugs by name (brand or generic)
   */
  async searchDrugs(query: string, limit: number = 50): Promise<Drug[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
    if (terms.length === 0) return [];

    // Get NDCs from first search term
    const firstKey = `${this.prefix}:search:${terms[0]}`;
    let ndcs = await this.redis.command("SMEMBERS", firstKey) as string[];

    // Intersect with other terms if multiple
    if (terms.length > 1) {
      const keys = terms.map(t => `${this.prefix}:search:${t}`);
      ndcs = await this.redis.command("SINTER", ...keys) as string[];
    }

    // Fetch drug details
    const drugs: Drug[] = [];
    for (const ndc of ndcs.slice(0, limit)) {
      const drug = await this.getDrug(ndc);
      if (drug) drugs.push(drug);
    }

    return drugs;
  }

  /**
   * Get all drugs in a specific tier
   */
  async getDrugsByTier(tier: number): Promise<Drug[]> {
    const ndcs = await this.redis.command(
      "SMEMBERS",
      `${this.prefix}:tier:${tier}`
    ) as string[];

    const drugs: Drug[] = [];
    for (const ndc of ndcs) {
      const drug = await this.getDrug(ndc);
      if (drug) drugs.push(drug);
    }

    return drugs;
  }

  /**
   * Get drugs requiring prior authorization
   */
  async getDrugsRequiringPA(): Promise<Drug[]> {
    const ndcs = await this.redis.command(
      "SMEMBERS",
      `${this.prefix}:pa-required`
    ) as string[];

    const drugs: Drug[] = [];
    for (const ndc of ndcs) {
      const drug = await this.getDrug(ndc);
      if (drug) drugs.push(drug);
    }

    return drugs;
  }

  /**
   * Get drugs with step therapy
   */
  async getDrugsWithStepTherapy(): Promise<Drug[]> {
    const ndcs = await this.redis.command(
      "SMEMBERS",
      `${this.prefix}:step-therapy`
    ) as string[];

    const drugs: Drug[] = [];
    for (const ndc of ndcs) {
      const drug = await this.getDrug(ndc);
      if (drug) drugs.push(drug);
    }

    return drugs;
  }

  /**
   * Get drugs by therapeutic class
   */
  async getDrugsByClass(therapeuticClass: string): Promise<Drug[]> {
    const ndcs = await this.redis.command(
      "SMEMBERS",
      `${this.prefix}:class:${therapeuticClass.toLowerCase()}`
    ) as string[];

    const drugs: Drug[] = [];
    for (const ndc of ndcs) {
      const drug = await this.getDrug(ndc);
      if (drug) drugs.push(drug);
    }

    return drugs;
  }

  /**
   * Advanced search with multiple filters
   */
  async advancedSearch(options: FormularySearchOptions): Promise<Drug[]> {
    const sets: string[] = [];

    if (options.tier !== undefined) {
      sets.push(`${this.prefix}:tier:${options.tier}`);
    }

    if (options.requiresPA !== undefined && options.requiresPA) {
      sets.push(`${this.prefix}:pa-required`);
    }

    if (options.stepTherapy !== undefined && options.stepTherapy) {
      sets.push(`${this.prefix}:step-therapy`);
    }

    if (options.therapeuticClass) {
      sets.push(`${this.prefix}:class:${options.therapeuticClass.toLowerCase()}`);
    }

    if (sets.length === 0) return [];

    // Intersect all filter sets
    const ndcs = await this.redis.command("SINTER", ...sets) as string[];

    // Fetch drugs
    const drugs: Drug[] = [];
    const limit = options.limit || 100;
    
    for (const ndc of ndcs.slice(0, limit)) {
      const drug = await this.getDrug(ndc);
      if (drug) drugs.push(drug);
    }

    return drugs;
  }

  // ==========================================================================
  // Step Therapy Operations
  // ==========================================================================

  /**
   * Add step therapy rule
   */
  async addStepTherapyRule(rule: StepTherapyRule): Promise<void> {
    const key = `${this.prefix}:step-rule:${rule.drugNDC}`;
    await this.redis.setJSON(key, rule);
  }

  /**
   * Get step therapy rule for a drug
   */
  async getStepTherapyRule(drugNDC: string): Promise<StepTherapyRule | null> {
    const key = `${this.prefix}:step-rule:${drugNDC}`;
    return await this.redis.getJSON<StepTherapyRule>(key);
  }

  /**
   * Check if patient meets step therapy requirements
   */
  async checkStepTherapyCompliance(
    drugNDC: string,
    patientHistory: string[]
  ): Promise<{ compliant: boolean; missingDrugs: string[] }> {
    const rule = await this.getStepTherapyRule(drugNDC);
    
    if (!rule) {
      return { compliant: true, missingDrugs: [] };
    }

    const missingDrugs = rule.requiredDrugs.filter(
      reqNDC => !patientHistory.includes(reqNDC)
    );

    return {
      compliant: missingDrugs.length === 0,
      missingDrugs
    };
  }

  // ==========================================================================
  // Prior Authorization Operations
  // ==========================================================================

  /**
   * Add PA criteria for a drug
   */
  async addPACriteria(criteria: PriorAuthCriteria): Promise<void> {
    const key = `${this.prefix}:pa-criteria:${criteria.drugNDC}`;
    await this.redis.setJSON(key, criteria);
  }

  /**
   * Get PA criteria for a drug
   */
  async getPACriteria(drugNDC: string): Promise<PriorAuthCriteria | null> {
    const key = `${this.prefix}:pa-criteria:${drugNDC}`;
    return await this.redis.getJSON<PriorAuthCriteria>(key);
  }

  /**
   * Submit PA request (tracking)
   */
  async submitPARequest(
    requestId: string,
    drugNDC: string,
    patientId: string,
    prescriberId: string
  ): Promise<void> {
    const key = `${this.prefix}:pa-request:${requestId}`;
    const data = {
      requestId,
      drugNDC,
      patientId,
      prescriberId,
      status: "pending",
      submittedAt: Date.now()
    };

    await this.redis.setJSON(key, data, { EX: 30 * 24 * 60 * 60 }); // 30 day TTL
    
    // Add to patient's PA list
    await this.redis.command(
      "SADD",
      `${this.prefix}:pa-requests:patient:${patientId}`,
      requestId
    );
  }

  /**
   * Get PA status
   */
  async getPAStatus(requestId: string): Promise<any> {
    const key = `${this.prefix}:pa-request:${requestId}`;
    return await this.redis.getJSON(key);
  }

  // ==========================================================================
  // Statistics & Analytics
  // ==========================================================================

  /**
   * Get formulary statistics
   */
  async getFormularyStats(): Promise<{
    totalDrugs: number;
    drugsByTier: Record<number, number>;
    paRequired: number;
    stepTherapy: number;
  }> {
    const tierCounts: Record<number, number> = {};
    
    for (let tier = 1; tier <= 5; tier++) {
      const count = await this.redis.command(
        "SCARD",
        `${this.prefix}:tier:${tier}`
      ) as number;
      tierCounts[tier] = count;
    }

    const totalDrugs = Object.values(tierCounts).reduce((sum, count) => sum + count, 0);
    
    const paRequired = await this.redis.command(
      "SCARD",
      `${this.prefix}:pa-required`
    ) as number;

    const stepTherapy = await this.redis.command(
      "SCARD",
      `${this.prefix}:step-therapy`
    ) as number;

    return {
      totalDrugs,
      drugsByTier: tierCounts,
      paRequired,
      stepTherapy
    };
  }

  /**
   * Get therapeutic classes
   */
  async getTherapeuticClasses(): Promise<string[]> {
    const pattern = `${this.prefix}:class:*`;
    const keys = await this.redis.scanAll(pattern);
    
    return keys.map(key => {
      const parts = key.split(":");
      return parts[parts.length - 1] || "";
    }).filter(c => c.length > 0);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clear all formulary data (use with caution!)
   */
  async clearFormulary(): Promise<void> {
    const pattern = `${this.prefix}:*`;
    const keys = await this.redis.scanAll(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Export formulary data
   */
  async exportFormulary(): Promise<Drug[]> {
    const drugs: Drug[] = [];
    
    for (let tier = 1; tier <= 5; tier++) {
      const tierDrugs = await this.getDrugsByTier(tier);
      drugs.push(...tierDrugs);
    }

    return drugs;
  }
}
