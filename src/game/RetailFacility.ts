import { FacilityBase } from './FacilityBase.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { ResourceRegistry } from './ResourceRegistry.js';
import { City } from './City.js';

/**
 * Retail facility that sells products to the population
 * Removes inventory and generates revenue for the company
 */
export class RetailFacility extends FacilityBase {
  revenue: number; // Track revenue generated this tick
  prices: Map<string, number>; // Price per resource set by owner
  salesThisTick: Map<string, number>; // Track units sold per resource this tick

  constructor(type: string, ownerId: string, name: string, city: City) {
    super(type, ownerId, name, city);
    this.inventory = new Map();
    this.cachedMaxInventoryCapacity = 0;
    this.revenue = 0;
    this.prices = new Map();
    this.salesThisTick = new Map();
    // Set workers after all properties are initialized
    this.workers = this.calculateRequiredWorkers();
  }

  /**
   * Set the price for a resource
   * @param resourceId The resource to price
   * @param price The price per unit
   */
  setPrice(resourceId: string, price: number): void {
    if (price < 0) {
      throw new Error('Price cannot be negative');
    }
    this.prices.set(resourceId, price);
  }

  /**
   * Get the price for a resource, or 0 if not set
   */
  getPrice(resourceId: string): number {
    return this.prices.get(resourceId) || 0;
  }

  /**
   * Execute a sale (called by city demand processing)
   * @param resourceId The resource to sell
   * @param quantity The quantity to sell
   * @returns The revenue generated
   */
  executeSale(resourceId: string, quantity: number): number {
    const price = this.getPrice(resourceId);
    if (price === 0) return 0; // No price set, no sale

    const available = this.getResource(resourceId);
    const actualSold = Math.min(quantity, available);
    
    if (actualSold > 0) {
      this.removeResource(resourceId, actualSold);
      const revenue = actualSold * price;
      this.revenue += revenue;
      
      // Track sales for this tick
      const currentSales = this.salesThisTick.get(resourceId) || 0;
      this.salesThisTick.set(resourceId, currentSales + actualSold);
      
      return revenue;
    }
    
    return 0;
  }

  /**
   * Process one tick - resets revenue and sales counters
   * Actual sales are handled by city demand processing
   */
  processTick(): void {
    this.revenue = 0;
    this.salesThisTick.clear();
    this.updateInventoryCapacityForTick();
  }

  /**
   * @deprecated Use setPrice() and automatic demand-based sales instead
   * Manual sell - kept for backwards compatibility with tests
   */
  sellProducts(resourceId: string, quantity: number, pricePerUnit: number): number {
    const currentInventory = this.inventory!.get(resourceId) || 0;
    if (currentInventory < quantity) return 0;

    const revenue = quantity * pricePerUnit;
    this.inventory!.set(resourceId, currentInventory - quantity);
    if (this.inventory!.get(resourceId) === 0) {
      this.inventory!.delete(resourceId);
    }
    return revenue;
  }

  /**
   * Get a status string describing the facility's current state
   */
  getStatus(): string {
    const maxCapacity = this.getMaxInventoryCapacity();
    const currentInventory = this.getTotalInventory();
    const percentage = (maxCapacity > 0 ? (currentInventory / maxCapacity) * 100 : 0).toFixed(1);
    
    return `${this.name} - Inventory: ${currentInventory}/${maxCapacity} (${percentage}%), Effectivity: ${(this.effectivity * 100).toFixed(1)}%, Revenue: $${this.revenue.toFixed(2)}`;
  }

  /**
   * Get a list of all resources currently in inventory
   */
  getInventoryList(): { resource: string, quantity: number, value: number }[] {
    const list: { resource: string, quantity: number, value: number }[] = [];
    
    if (!this.inventory) return list;
    
    this.inventory.forEach((quantity, resourceId) => {
      const price = this.getPrice(resourceId);
      
      list.push({
        resource: resourceId,
        quantity: quantity,
        value: quantity * price
      });
    });
    
    return list;
  }

  /**
   * Get sales report for the last tick
   * @returns Map of resource ID to units sold
   */
  getSalesThisTick(): Map<string, number> {
    return new Map(this.salesThisTick);
  }

  /**
   * Get total units sold for a specific resource this tick
   */
  getSoldAmount(resourceId: string): number {
    return this.salesThisTick.get(resourceId) || 0;
  }
}