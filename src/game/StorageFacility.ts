import { FacilityBase } from './FacilityBase.ts';
import { City } from './City.ts';

/**
 * Storage facility with inventory but no production
 * Example: Warehouse
 */
export class StorageFacility extends FacilityBase {
  constructor(type: string, ownerId: string, name: string, city: City) {
    super(type, ownerId, name, city);
    this.initInventory();
    // Now set workers after all properties are initialized
    this.initWorkers();
  }

  /**
   * Get net flow per tick (only contracts, no production)
   */
  getNetFlow(): Map<string, number> {
    const imports = this.getImportRate();
    const exports = this.negateFlow(this.getExportRate());
    return this.buildNetFlow([imports, exports]);
  }

  /**
   * Get ticks until resource depletes
   */
  getTicksUntilDepletion(resource: string): number | null {
    return this.getTicksUntilDepletionFromNetFlow(resource, this.getNetFlow());
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
