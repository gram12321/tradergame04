import { FacilityBase } from './FacilityBase.js';
import { City } from './City.js';

/**
 * Office facility that provides administrative oversight
 * Controls other facilities in the same country
 */
export class Office extends FacilityBase {
  administrativeLoad: number; // Total wages of controlled facilities
  controlledFacilityIds: Set<string>; // IDs of facilities this office controls

  constructor(type: string, ownerId: string, name: string, city: City) {
    super(type, ownerId, name, city);
    this.administrativeLoad = 0;
    this.controlledFacilityIds = new Set();
    // Offices don't have a controlling office (they control themselves)
    this.officeEffectivityMultiplier = 1;
    // Now set workers after administrativeLoad is initialized
    this.workers = this.calculateRequiredWorkers();
  }

  /**
   * Calculate required workers based on administrative load
   * Formula: ceil((administrativeLoad / 50)^1.2)
   * Diminishing returns: each additional worker handles less load
   * - $50 load = 1 worker
   * - $100 load = 2 workers
   * - $200 load = 3 workers
   * - $400 load = 5 workers
   * - $800 load = 9 workers
   */
  calculateRequiredWorkers(): number {
    if (this.administrativeLoad === 0) {
      return 1; // Minimum 1 worker even with no load
    }
    return Math.ceil(Math.pow(this.administrativeLoad / 50, 1.2));
  }

  /**
   * Calculate effectivity based only on worker ratio
   * No overflow penalty (offices have no inventory)
   * No office multiplier (offices don't control themselves)
   * Formula: workerEffectivity only
   */
  calculateEffectivity(): void {
    const requiredWorkers = this.calculateRequiredWorkers();
    const ratio = this.workers / requiredWorkers;
    
    if (ratio < 1) {
      this.effectivity = ratio * ratio; // Quadratic penalty
    } else {
      this.effectivity = 1 + Math.sqrt(ratio - 1); // Diminishing returns
    }
  }

  /**
   * Update the administrative load based on controlled facilities
   * Should be called by Company when facility wages change
   */
  updateAdministrativeLoad(totalControlledWages: number): void {
    this.administrativeLoad = totalControlledWages;
  }

  /**
   * Add a facility to this office's control
   */
  addControlledFacility(facilityId: string): void {
    this.controlledFacilityIds.add(facilityId);
  }

  /**
   * Remove a facility from this office's control
   */
  removeControlledFacility(facilityId: string): void {
    this.controlledFacilityIds.delete(facilityId);
  }

  /**
   * Process one tick - offices don't produce anything
   */
  processTick(): void {
    // Offices don't have production or inventory to update
    // Administrative load is updated by Company.updateAdministrativeLoads()
  }

  /**
   * Get office status string
   */
  getStatus(): string {
    const requiredWorkers = this.calculateRequiredWorkers();
    return `[${this.name}] Administrative | Load: $${this.administrativeLoad.toFixed(2)} | Required Workers: ${requiredWorkers} | Controlling: ${this.controlledFacilityIds.size} facilities`;
  }
}
