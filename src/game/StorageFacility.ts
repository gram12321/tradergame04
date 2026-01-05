import { FacilityBase } from './FacilityBase.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { ResourceRegistry } from './ResourceRegistry.js';
import { City } from './City.js';

/**
 * Storage facility with inventory but no production
 * Example: Warehouse
 */
export class StorageFacility extends FacilityBase {
  inventory: Map<string, number>;
  cachedMaxInventoryCapacity: number;

  constructor(type: string, ownerId: string, name: string, city: City) {
    super(type, ownerId, name, city);
    this.inventory = new Map();
    this.cachedMaxInventoryCapacity = 0;
    // Now set workers after all properties are initialized
    this.workers = this.calculateRequiredWorkers();
  }

  /**
   * Calculate required workers based on size
   * Formula: workerMultiplier * size^1.2
   */
  calculateRequiredWorkers(): number {
    const workerMultiplier = FacilityRegistry.get(this.type)?.workerMultiplier || 1.0;
    return Math.ceil(workerMultiplier * Math.pow(this.size, 1.2));
  }

  /**
   * Calculate effectivity based on worker ratio, inventory overflow, and office cap
   * Formula: workerEffectivity * overflowPenalty * officeEffectivityMultiplier
   */
  calculateEffectivity(): void {
    const requiredWorkers = this.calculateRequiredWorkers();
    const ratio = this.workers / requiredWorkers;
    
    let workerEffectivity: number;
    if (ratio < 1) {
      workerEffectivity = ratio * ratio; // Quadratic penalty
    } else {
      workerEffectivity = 1 + Math.sqrt(ratio - 1); // Diminishing returns
    }
    
    const overflowPenalty = this.getOverflowPenalty();
    this.effectivity = workerEffectivity * overflowPenalty * this.officeEffectivityMultiplier;
  }

  /**
   * Get maximum inventory capacity
   */
  getMaxInventoryCapacity(): number {
    return this.cachedMaxInventoryCapacity;
  }

  /**
   * Update cached inventory capacity once per tick
   */
  updateInventoryCapacityForTick(): void {
    const baseCapacity = 100;
    const definition = FacilityRegistry.get(this.type);
    const capacityMultiplier = definition?.capacityMultiplier || 1.0;
    const baseMaxCapacity = Math.ceil(baseCapacity * this.size * capacityMultiplier);
    this.cachedMaxInventoryCapacity = Math.ceil(baseMaxCapacity * this.effectivity);
  }

  /**
   * Calculate total inventory weight
   */
  getTotalInventory(): number {
    let totalWeight = 0;
    this.inventory.forEach((quantity, resourceId) => {
      const resourceDef = ResourceRegistry.get(resourceId);
      const weight = resourceDef?.weight || 1.0;
      totalWeight += quantity * weight;
    });
    return totalWeight;
  }

  /**
   * Get inventory as percentage of max capacity (0-1)
   */
  getInventoryPercentage(): number {
    const max = this.getMaxInventoryCapacity();
    if (max === 0) return 0;
    return Math.min(1, this.getTotalInventory() / max);
  }

  /**
   * Check if inventory exceeds capacity
   */
  isInventoryOverCapacity(): boolean {
    return this.getTotalInventory() > this.getMaxInventoryCapacity();
  }

  /**
   * Calculate overflow penalty
   * Formula: 1.0 - (overflow / maxCapacity)^2
   */
  getOverflowPenalty(): number {
    const current = this.getTotalInventory();
    const max = this.getMaxInventoryCapacity();
    
    if (current <= max) return 1.0;
    
    const overflow = current - max;
    const overflowRatio = overflow / max;
    return Math.max(0, 1.0 - (overflowRatio * overflowRatio));
  }

  /**
   * Add resources to inventory
   */
  addResource(resource: string, amount: number): void {
    const current = this.inventory.get(resource) || 0;
    this.inventory.set(resource, current + amount);
  }

  /**
   * Remove resources from inventory
   */
  removeResource(resource: string, amount: number): boolean {
    const current = this.inventory.get(resource) || 0;
    if (current < amount) return false;
    this.inventory.set(resource, current - amount);
    return true;
  }

  /**
   * Get resource amount
   */
  getResource(resource: string): number {
    return this.inventory.get(resource) || 0;
  }

  /**
   * Get import rate from buying contracts
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
   * Get export rate from selling contracts
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
   * Get net flow per tick (only contracts, no production)
   */
  getNetFlow(): Map<string, number> {
    const netFlow = new Map<string, number>();
    const allResources = new Set<string>();
    
    this.inventory.forEach((_, resource) => allResources.add(resource));
    this.getImportRate().forEach((_, resource) => allResources.add(resource));
    this.getExportRate().forEach((_, resource) => allResources.add(resource));
    
    allResources.forEach(resource => {
      let net = 0;
      net += this.getImportRate().get(resource) || 0;
      net -= this.getExportRate().get(resource) || 0;
      
      if (net !== 0) {
        netFlow.set(resource, net);
      }
    });
    
    return netFlow;
  }

  /**
   * Get ticks until resource depletes
   */
  getTicksUntilDepletion(resource: string): number | null {
    const netFlow = this.getNetFlow().get(resource) || 0;
    if (netFlow >= 0) return null;
    
    const currentAmount = this.getResource(resource);
    if (currentAmount <= 0) return 0;
    
    return Math.floor(currentAmount / Math.abs(netFlow));
  }

  /**
   * Process one tick - update capacity only
   */
  processTick(): void {
    this.updateInventoryCapacityForTick();
  }

  /**
   * Get facility status string
   */
  getStatus(): string {
    const inventoryStr = Array.from(this.inventory.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([resource, amount]) => `${resource}: ${amount}`)
      .join(', ');

    return `[${this.name}] Storage | Inventory: {${inventoryStr || 'empty'}}`;
  }
}
