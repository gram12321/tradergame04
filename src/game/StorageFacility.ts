import { FacilityBase } from './FacilityBase.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { ResourceRegistry } from './ResourceRegistry.js';
import { City } from './City.js';

/**
 * Storage facility with inventory but no production
 * Example: Warehouse
 */
export class StorageFacility extends FacilityBase {
  constructor(type: string, ownerId: string, name: string, city: City) {
    super(type, ownerId, name, city);
    this.inventory = new Map();
    this.cachedMaxInventoryCapacity = 0;
    // Now set workers after all properties are initialized
    this.workers = this.calculateRequiredWorkers();
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
    
    this.inventory!.forEach((_, resource) => allResources.add(resource));
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
    const inventoryStr = Array.from(this.inventory!.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([resource, amount]) => `${resource}: ${amount}`)
      .join(', ');

    return `[${this.name}] Storage | Inventory: {${inventoryStr || 'empty'}}`;
  }
}
