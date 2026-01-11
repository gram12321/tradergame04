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
   * Get net flow per tick (only contracts, no production)
   */
  getNetFlow(): Map<string, number> {
    const netFlow = new Map<string, number>();
    const allResources = new Set<string>();

    this.inventory!.forEach((_, resource) => allResources.add(resource));
    const imports = this.getImportRate();
    const exports = this.getExportRate();

    imports.forEach((_, resource) => allResources.add(resource));
    exports.forEach((_, resource) => allResources.add(resource));

    allResources.forEach(resource => {
      let net = (imports.get(resource) || 0) - (exports.get(resource) || 0);
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
