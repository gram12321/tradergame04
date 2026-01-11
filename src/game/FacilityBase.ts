import { City } from './City.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { ResourceRegistry } from './ResourceRegistry.js';

export interface TradeRouteInfo {
  id: string;
  resource: string;
  amountPerTick: number;
  pricePerUnit: number; // 0 for internal
  isOutgoing: boolean;  // true if this facility is sending/selling
  isInternal: boolean;  // true if between facilities of the same company
}

/**
 * Abstract base class for all facility types
 * Contains shared properties and logic for facilities, warehouses, and offices
 */
export abstract class FacilityBase {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  city: City;
  size: number;
  workers: number;
  effectivity: number;
  controllingOfficeId: string | null; // Reference to the office that controls this facility
  officeEffectivityMultiplier: number; // Hard cap from controlling office (0-1)
  tradeRoutes: Map<string, TradeRouteInfo>;

  // Inventory properties (optional - only used by Production, Storage, Retail)
  inventory?: Map<string, number>;
  cachedMaxInventoryCapacity?: number;

  constructor(type: string, ownerId: string, name: string, city: City) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.type = type;
    this.ownerId = ownerId;
    this.city = city;
    this.size = 1;
    this.effectivity = 1;
    this.controllingOfficeId = null;
    this.officeEffectivityMultiplier = 1;
    this.tradeRoutes = new Map();
    // Workers will be set by subclass after initialization
    this.workers = 0;
  }

  /**
   * Calculate required workers - default implementation
   * Formula: workerMultiplier * size^1.2
   * Can be overridden by subclasses (e.g., Office)
   */
  calculateRequiredWorkers(): number {
    const workerMultiplier = FacilityRegistry.get(this.type)?.workerMultiplier || 1.0;
    return Math.ceil(workerMultiplier * Math.pow(this.size, 1.2));
  }

  /**
   * Calculate effectivity - default implementation
   * Formula: workerEffectivity * overflowPenalty * officeEffectivityMultiplier
   * Can be overridden by subclasses (e.g., Office)
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
   * Process one tick - each subclass must implement based on its behavior
   */
  abstract processTick(): void;

  /**
   * Get a status string describing the facility's current state
   */
  abstract getStatus(): string;

  /**
   * Get the wage cost per tick for current workers
   * Formula: workers * baseWage * city.wealth
   */
  getWagePerTick(): number {
    const baseWage = 1.0;
    return this.workers * baseWage * this.city.wealth;
  }

  /**
   * Calculate the cost to hire or fire workers
   * Formula: 4 * baseWage * city.wealth * |workerChange|
   */
  getHiringCost(newWorkerCount: number): number {
    const workerChange = Math.abs(newWorkerCount - this.workers);
    const baseWage = 1.0;
    return 4 * baseWage * this.city.wealth * workerChange;
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
    this.calculateEffectivity();
    return true;
  }

  /**
   * Calculate the cost to upgrade to the next size level
   * Formula: baseCost * (size+1)^2
   */
  getUpgradeCost(): number {
    const definition = FacilityRegistry.get(this.type);
    if (!definition) return 0;
    const baseCost = definition.cost;
    return Math.ceil(baseCost * Math.pow(this.size + 1, 2));
  }

  /**
   * Calculate the refund from degrading to the previous size level
   * Formula: 50% of upgrade cost to current size
   */
  getDegradeCost(): number {
    if (this.size <= 1) return 0;
    const definition = FacilityRegistry.get(this.type);
    if (!definition) return 0;
    const baseCost = definition.cost;
    const upgradeCost = Math.ceil(baseCost * Math.pow(this.size, 2));
    return Math.ceil(upgradeCost * 0.5);
  }

  /**
   * Upgrade the facility to the next size level
   */
  upgradeSize(): number | null {
    const cost = this.getUpgradeCost();
    if (cost <= 0) return null;

    this.size++;
    const requiredWorkers = this.calculateRequiredWorkers();
    if (this.workers > requiredWorkers * 10) {
      this.workers = requiredWorkers;
    }
    this.calculateEffectivity();
    return cost;
  }

  /**
   * Degrade the facility to the previous size level
   */
  degradeSize(): number | null {
    if (this.size <= 1) return null;

    const refund = this.getDegradeCost();
    this.size--;
    const requiredWorkers = this.calculateRequiredWorkers();
    if (this.workers > requiredWorkers * 10) {
      this.workers = requiredWorkers;
    }
    this.calculateEffectivity();
    return refund;
  }

  /**
   * Add a trade route (contract or internal transfer) to this facility
   */
  addTradeRoute(id: string, resource: string, amount: number, price: number, isOutgoing: boolean, isInternal: boolean): void {
    this.tradeRoutes.set(id, {
      id,
      resource,
      amountPerTick: amount,
      pricePerUnit: price,
      isOutgoing,
      isInternal
    });
  }

  /**
   * Remove a trade route from this facility
   */
  removeTradeRoute(id: string): boolean {
    return this.tradeRoutes.delete(id);
  }

  /**
   * Get all outgoing trade routes for this facility
   */
  getOutgoingRoutes(): TradeRouteInfo[] {
    return Array.from(this.tradeRoutes.values()).filter(r => r.isOutgoing);
  }

  /**
   * Get all incoming trade routes for this facility
   */
  getIncomingRoutes(): TradeRouteInfo[] {
    return Array.from(this.tradeRoutes.values()).filter(r => !r.isOutgoing);
  }

  /**
   * Get import rate (combined contracts and transfers)
   */
  getImportRate(): Map<string, number> {
    const imports = new Map<string, number>();
    this.getIncomingRoutes().forEach(route => {
      imports.set(route.resource, (imports.get(route.resource) || 0) + route.amountPerTick);
    });
    return imports;
  }

  /**
   * Get export rate (combined contracts and transfers)
   */
  getExportRate(): Map<string, number> {
    const exports = new Map<string, number>();
    this.getOutgoingRoutes().forEach(route => {
      exports.set(route.resource, (exports.get(route.resource) || 0) + route.amountPerTick);
    });
    return exports;
  }

  /**
   * Build a net flow map from multiple per-resource flow maps
   */
  protected buildNetFlow(flows: Array<Map<string, number>>): Map<string, number> {
    const netFlow = new Map<string, number>();
    const allResources = new Set<string>();

    if (this.inventory) {
      this.inventory.forEach((_, resource) => allResources.add(resource));
    }

    flows.forEach(flow => {
      flow.forEach((_, resource) => allResources.add(resource));
    });

    allResources.forEach(resource => {
      let total = 0;
      flows.forEach(flow => {
        total += flow.get(resource) || 0;
      });
      if (total !== 0) {
        netFlow.set(resource, total);
      }
    });

    return netFlow;
  }

  /**
   * Negate a flow map (useful for exports/consumption)
   */
  protected negateFlow(flow: Map<string, number>): Map<string, number> {
    const negated = new Map<string, number>();
    flow.forEach((amount, resource) => {
      negated.set(resource, -amount);
    });
    return negated;
  }

  /**
   * Shared helper for depletion calculation
   */
  protected getTicksUntilDepletionFromNetFlow(resource: string, netFlow: Map<string, number>): number | null {
    const net = netFlow.get(resource) || 0;
    if (net >= 0) return null;

    const currentAmount = this.getResource(resource);
    if (currentAmount <= 0) return 0;

    return Math.floor(currentAmount / Math.abs(net));
  }



  // ========================================
  // INVENTORY METHODS (for Production, Storage, Retail)
  // Office does not use these
  // ========================================

  /**
   * Initialize inventory storage for facilities that use it
   */
  protected initInventory(): void {
    this.inventory = new Map();
    this.cachedMaxInventoryCapacity = 0;
  }

  /**
   * Initialize workers after subclass state is ready
   */
  protected initWorkers(): void {
    this.workers = this.calculateRequiredWorkers();
  }

  /**
   * Get the cached maximum inventory capacity
   */
  getMaxInventoryCapacity(): number {
    return this.cachedMaxInventoryCapacity || 0;
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
    if (!this.inventory) return 0;

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
   * Calculate overflow penalty - uses quadratic formula
   * Formula: 1.0 - (overflow / maxCapacity)^2
   * Returns value between 0 and 1
   */
  getOverflowPenalty(): number {
    if (!this.inventory) return 1.0; // No inventory = no penalty

    const current = this.getTotalInventory();
    const max = this.getMaxInventoryCapacity();

    if (current <= max) return 1.0;

    const overflow = current - max;
    const overflowRatio = overflow / max;
    return Math.max(0, 1.0 - (overflowRatio * overflowRatio));
  }

  /**
   * Get amount of a resource in inventory
   */
  getResource(resourceId: string): number {
    if (!this.inventory) return 0;
    return this.inventory.get(resourceId) || 0;
  }

  /**
   * Add resource to inventory (allows overflow)
   */
  addResource(resourceId: string, quantity: number): void {
    if (!this.inventory) return;

    const current = this.inventory.get(resourceId) || 0;
    this.inventory.set(resourceId, current + quantity);
  }

  /**
   * Remove resource from inventory
   * @returns true if successful, false if not enough resources
   */
  removeResource(resourceId: string, quantity: number): boolean {
    if (!this.inventory) return false;

    const current = this.inventory.get(resourceId) || 0;
    if (current < quantity) {
      return false;
    }

    const newAmount = current - quantity;
    if (newAmount === 0) {
      this.inventory.delete(resourceId);
    } else {
      this.inventory.set(resourceId, newAmount);
    }
    return true;
  }
}
