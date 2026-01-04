import { Recipe } from './Recipe.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { City } from './City.js';
import type { Market } from './Market.js';

export interface ContractInfo {
  contractId: string;
  resource: string;
  amountPerTick: number;
  pricePerUnit: number;
  isSelling: boolean; // true if this facility is selling, false if buying
}

export class Facility {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  city: City; // City where this facility is located
  inventory: Map<string, number>;
  contracts: Map<string, ContractInfo>; // contractId -> contract info
  recipe: Recipe | null;
  productionProgress: number;
  isProducing: boolean;
  size: number; // Size of the facility (always starts at 1)
  workers: number; // Current worker count

  constructor(type: string, ownerId: string, name: string, city: City) {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.type = type;
    this.ownerId = ownerId;
    this.city = city;
    this.inventory = new Map();
    this.contracts = new Map();
    this.recipe = null;
    this.productionProgress = 0;
    this.isProducing = false;
    this.size = 1;
    this.workers = this.calculateRequiredWorkers();
  }

  /**
   * Calculate required workers based on size (exponential growth)
   * Formula: workerMultiplier * size^1.2
   */
  calculateRequiredWorkers(): number {
    const workerMultiplier = FacilityRegistry.get(this.type)?.workerMultiplier || 1.0;
    return Math.ceil(workerMultiplier * Math.pow(this.size, 1.2));
  }

  /**
   * Get production multiplier based on size (diminishing returns)
   * Formula: sqrt(size) - gives diminishing returns
   * size=1: 1.0x, size=4: 2.0x, size=9: 3.0x, size=16: 4.0x
   */
  getProductionMultiplier(): number {
    return Math.sqrt(this.size);
  }

  /**
   * Calculate wage cost per tick
   * Formula: workers * baseWage(1€) * city.wealth
   */
  getWagePerTick(): number {
    const baseWage = 1.0; // 1€ per worker
    return this.workers * baseWage * this.city.wealth;
  }

  /**
   * Set worker count to a specific value
   * @param count Desired worker count (0 to requiredWorkers * 10)
   * @returns true if successful, false if out of bounds
   */
  setWorkerCount(count: number): boolean {
    const requiredWorkers = this.calculateRequiredWorkers();
    const maxWorkers = requiredWorkers * 10;
    
    if (count < 0 || count > maxWorkers) {
      return false;
    }
    
    this.workers = count;
    return true;
  }

  /**
   * Calculate the cost to upgrade to the next size level
   * Formula: baseCost * size^2 (exponential growth)
   */
  getUpgradeCost(): number {
    const definition = FacilityRegistry.get(this.type);
    if (!definition) return 0;
    const baseCost = definition.cost;
    // Cost to upgrade from current size to next size
    return Math.ceil(baseCost * Math.pow(this.size + 1, 2));
  }

  /**
   * Upgrade the facility to the next size level
   * @returns The cost paid, or null if upgrade failed
   */
  upgradeSize(): number | null {
    const cost = this.getUpgradeCost();
    if (cost <= 0) return null;
    
    this.size++;
    const requiredWorkers = this.calculateRequiredWorkers();
    // Keep current workers if still within bounds, otherwise set to required
    if (this.workers > requiredWorkers * 10) {
      this.workers = requiredWorkers;
    }
    return cost;
  }

  /**
   * Set the recipe for this facility
   * @returns true if recipe was set successfully, false if not allowed
   */
  setRecipe(recipe: Recipe): boolean {
    // Check if this facility type can produce
    if (!FacilityRegistry.canProduce(this.type)) {
      return false;
    }

    // Check if recipe is allowed for this facility type
    if (!FacilityRegistry.isRecipeAllowed(this.type, recipe.name)) {
      return false;
    }

    this.recipe = recipe;
    this.isProducing = false;
    this.productionProgress = 0;
    return true;
  }

  /**
   * Add resources to facility inventory
   */
  addResource(resource: string, amount: number): void {
    const current = this.inventory.get(resource) || 0;
    this.inventory.set(resource, current + amount);
  }

  /**
   * Remove resources from facility inventory
   */
  removeResource(resource: string, amount: number): boolean {
    const current = this.inventory.get(resource) || 0;
    if (current < amount) {
      return false;
    }
    
    this.inventory.set(resource, current - amount);
    return true;
  }

  /**
   * Get resource amount in inventory
   */
  getResource(resource: string): number {
    return this.inventory.get(resource) || 0;
  }

  /**
   * Add a contract to this facility
   */
  addContract(contractId: string, resource: string, amountPerTick: number, pricePerUnit: number, isSelling: boolean): void {
    this.contracts.set(contractId, {
      contractId,
      resource,
      amountPerTick,
      pricePerUnit,
      isSelling
    });
  }

  /**
   * Remove a contract from this facility
   */
  removeContract(contractId: string): boolean {
    return this.contracts.delete(contractId);
  }

  /**
   * Get all selling contracts for this facility
   */
  getSellingContracts(): ContractInfo[] {
    return Array.from(this.contracts.values()).filter(c => c.isSelling);
  }

  /**
   * Get all buying contracts for this facility
   */
  getBuyingContracts(): ContractInfo[] {
    return Array.from(this.contracts.values()).filter(c => !c.isSelling);
  }

  /**
   * Get import rate per tick (resources coming in from buying contracts)
   */
  getImportRate(): Map<string, number> {
    const imports = new Map<string, number>();
    this.getBuyingContracts().forEach(contract => {
      const current = imports.get(contract.resource) || 0;
      imports.set(contract.resource, current + contract.amountPerTick);
    });
    return imports;
  }

  /**
   * Get export rate per tick (resources going out from selling contracts)
   */
  getExportRate(): Map<string, number> {
    const exports = new Map<string, number>();
    this.getSellingContracts().forEach(contract => {
      const current = exports.get(contract.resource) || 0;
      exports.set(contract.resource, current + contract.amountPerTick);
    });
    return exports;
  }

  /**
   * Get production rate per tick (what this facility produces)
   */
  getProductionRate(): Map<string, number> {
    const production = new Map<string, number>();
    if (!this.recipe) return production;

    const multiplier = this.getProductionMultiplier();
    this.recipe.outputs.forEach(output => {
      const ratePerTick = (output.amount * multiplier) / this.recipe!.ticksRequired;
      production.set(output.resource, ratePerTick);
    });
    return production;
  }

  /**
   * Get consumption rate per tick (what this facility consumes for production)
   * Scales with size using the same multiplier as output
   */
  getConsumptionRate(): Map<string, number> {
    const consumption = new Map<string, number>();
    if (!this.recipe) return consumption;

    const multiplier = this.getProductionMultiplier();
    this.recipe.inputs.forEach(input => {
      const ratePerTick = (input.amount * multiplier) / this.recipe!.ticksRequired;
      consumption.set(input.resource, ratePerTick);
    });
    return consumption;
  }

  /**
   * Get net flow per tick for each resource (production + imports - consumption - exports)
   */
  getNetFlow(): Map<string, number> {
    const netFlow = new Map<string, number>();
    
    // Add all resources we're tracking
    const allResources = new Set<string>();
    this.inventory.forEach((_, resource) => allResources.add(resource));
    this.getImportRate().forEach((_, resource) => allResources.add(resource));
    this.getExportRate().forEach((_, resource) => allResources.add(resource));
    this.getProductionRate().forEach((_, resource) => allResources.add(resource));
    this.getConsumptionRate().forEach((_, resource) => allResources.add(resource));
    
    // Calculate net for each resource
    allResources.forEach(resource => {
      let net = 0;
      net += this.getImportRate().get(resource) || 0;
      net += this.getProductionRate().get(resource) || 0;
      net -= this.getExportRate().get(resource) || 0;
      net -= this.getConsumptionRate().get(resource) || 0;
      
      if (net !== 0) {
        netFlow.set(resource, net);
      }
    });
    
    return netFlow;
  }

  /**
   * Get ticks until resource runs out (only for resources with negative net flow)
   * Returns null if resource won't run out (positive or zero net flow)
   */
  getTicksUntilDepletion(resource: string): number | null {
    const netFlow = this.getNetFlow().get(resource) || 0;
    
    // If net flow is positive or zero, resource won't run out
    if (netFlow >= 0) {
      return null;
    }
    
    const currentAmount = this.getResource(resource);
    
    // If no inventory, it's already depleted
    if (currentAmount <= 0) {
      return 0;
    }
    
    // Calculate ticks until depletion
    return Math.floor(currentAmount / Math.abs(netFlow));
  }

  /**
   * Start production if recipe can be executed
   */
  startProduction(): boolean {
    if (!this.recipe || this.isProducing) {
      return false;
    }

    if (this.recipe.canExecute(this.inventory)) {
      this.isProducing = true;
      this.productionProgress = 0;
      return true;
    }

    return false;
  }

  /**
   * Process one tick of production
   */
  processTick(): void {
    // Try to auto-start production if not producing
    if (!this.isProducing && this.recipe) {
      this.startProduction();
    }

    // If not producing (no recipe or can't start), exit early
    if (!this.isProducing || !this.recipe) {
      return;
    }

    this.productionProgress++;

    // Check if production is complete
    if (this.productionProgress >= this.recipe.ticksRequired) {
      this.completeProduction();
    }
  }

  /**
   * Complete the current production cycle
   */
  private completeProduction(): void {
    if (!this.recipe) return;

    // Consume inputs (with size multiplier)
    const multiplier = this.getProductionMultiplier();
    this.recipe.inputs.forEach(input => {
      this.removeResource(input.resource, input.amount * multiplier);
    });

    // Produce outputs (with size multiplier)
    this.recipe.outputs.forEach(output => {
      this.addResource(output.resource, output.amount * multiplier);
    });

    // Reset production state
    this.isProducing = false;
    this.productionProgress = 0;

    // Auto-start next cycle if possible
    this.startProduction();
  }

  /**
   * Get facility status
   */
  getStatus(): string {
    const inventoryStr = Array.from(this.inventory.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([resource, amount]) => `${resource}: ${amount}`)
      .join(', ');

    const statusStr = this.isProducing 
      ? `Producing (${this.productionProgress}/${this.recipe?.ticksRequired})` 
      : 'Idle';

    const contractsStr: string[] = [];
    const sellingCount = this.getSellingContracts().length;
    const buyingCount = this.getBuyingContracts().length;
    if (sellingCount > 0) contractsStr.push(`${sellingCount} selling`);
    if (buyingCount > 0) contractsStr.push(`${buyingCount} buying`);
    const contractInfo = contractsStr.length > 0 ? ` | Contracts: ${contractsStr.join(', ')}` : '';

    // Build flow information (imports, exports, production, consumption)
    const flowParts: string[] = [];
    
    // Imports (buying contracts)
    const imports = this.getImportRate();
    if (imports.size > 0) {
      const importStr = Array.from(imports.entries())
        .map(([resource, rate]) => `${resource}: +${rate.toFixed(2)}/t`)
        .join(', ');
      flowParts.push(`Import: {${importStr}}`);
    }
    
    // Exports (selling contracts)
    const exports = this.getExportRate();
    if (exports.size > 0) {
      const exportStr = Array.from(exports.entries())
        .map(([resource, rate]) => `${resource}: -${rate.toFixed(2)}/t`)
        .join(', ');
      flowParts.push(`Export: {${exportStr}}`);
    }
    
    // Production
    const production = this.getProductionRate();
    if (production.size > 0) {
      const prodStr = Array.from(production.entries())
        .map(([resource, rate]) => `${resource}: +${rate.toFixed(2)}/t`)
        .join(', ');
      flowParts.push(`Production: {${prodStr}}`);
    }
    
    // Consumption
    const consumption = this.getConsumptionRate();
    if (consumption.size > 0) {
      const consStr = Array.from(consumption.entries())
        .map(([resource, rate]) => `${resource}: -${rate.toFixed(2)}/t`)
        .join(', ');
      flowParts.push(`Consumption: {${consStr}}`);
    }
    
    // Net flow
    const netFlow = this.getNetFlow();
    if (netFlow.size > 0) {
      const netStr = Array.from(netFlow.entries())
        .map(([resource, rate]) => {
          const sign = rate >= 0 ? '+' : '';
          return `${resource}: ${sign}${rate.toFixed(2)}/t`;
        })
        .join(', ');
      flowParts.push(`Net: {${netStr}}`);
    }
    
    const flowInfo = flowParts.length > 0 ? ` | ${flowParts.join(' | ')}` : '';

    // Depletion warnings (only for resources with negative net flow)
    const depletionWarnings: string[] = [];
    netFlow.forEach((rate, resource) => {
      if (rate < 0) {
        const ticks = this.getTicksUntilDepletion(resource);
        if (ticks !== null && ticks <= 10) {
          depletionWarnings.push(`${resource}: ${ticks}t`);
        }
      }
    });
    const depletionInfo = depletionWarnings.length > 0 ? ` | ⚠️ Depleting: {${depletionWarnings.join(', ')}}` : '';

    return `[${this.name}] ${statusStr} | Inventory: {${inventoryStr || 'empty'}}${contractInfo}${flowInfo}${depletionInfo}`;
  }
}
