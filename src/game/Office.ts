import { FacilityBase } from './FacilityBase.ts';
import { City } from './City.ts';

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
    this.initWorkers();
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
  /**
   * Get office status string
   */
  getStatus(): string {
    const requiredWorkers = this.calculateRequiredWorkers();
    return `[${this.name}] Administrative | Load: $${this.administrativeLoad.toFixed(2)} | Required Workers: ${requiredWorkers} | Controlling: ${this.controlledFacilityIds.size} facilities`;
  }

  // ==========================================
  // STATIC HELPERS (moved from Company.ts)
  // ==========================================

  /**
   * Check if there is an office in the specified country
   */
  static hasOfficeInCountry(facilities: FacilityBase[], country: string): boolean {
    return facilities.some(f => f.type === 'office' && f.city.country === country);
  }

  /**
   * Get the office in a specific country
   */
  static getOfficeInCountry(facilities: FacilityBase[], country: string): Office | null {
    const office = facilities.find(f => f.type === 'office' && f.city.country === country);
    return office instanceof Office ? office : null;
  }

  /**
   * Update administrative load for all offices based on controlled facilities
   */
  static updateAdministrativeLoads(facilities: FacilityBase[]): void {
    const offices = facilities.filter(f => f instanceof Office) as Office[];

    offices.forEach(office => {
      let totalWages = 0;

      // Filter out invalid IDs from controlled list while summing wages
      const validControlledIds = new Set<string>();

      office.controlledFacilityIds.forEach(facId => {
        const facility = facilities.find(f => f.id === facId);
        if (facility) {
          totalWages += facility.getWagePerTick();
          validControlledIds.add(facId);
        }
      });

      // Update the set to remove deleted facilities
      office.controlledFacilityIds = validControlledIds;

      // Update the office's administrative load
      office.updateAdministrativeLoad(totalWages);
    });
  }

  /**
   * Update office effectivity multipliers for all facilities
   */
  static updateOfficeEffectivity(facilities: FacilityBase[]): void {
    const countries = new Set(facilities.map(f => f.city.country));

    countries.forEach(country => {
      const office = facilities.find(f => f instanceof Office && f.city.country === country) as Office | undefined;
      const officeEffectivityCap = office ? Math.min(1, Math.max(0, office.effectivity)) : 0;

      facilities
        .filter(f => !(f instanceof Office) && f.city.country === country)
        .forEach(f => {
          f.officeEffectivityMultiplier = officeEffectivityCap;
          f.calculateEffectivity();
        });
    });
  }

  /**
   * Handle cleanup when a facility is destroyed
   */
  static onFacilityDestroyed(facilities: FacilityBase[], destroyedFacility: FacilityBase): void {
    // If destroying an office, all facilities in that country lose effectivity
    // (We assume the rule "one office per country" is enforced, so if we destroy 'an' office, it's 'the' office)
    if (destroyedFacility instanceof Office) {
      const country = destroyedFacility.city.country;

      facilities
        .filter(f => f.city.country === country && f.id !== destroyedFacility.id)
        .forEach(f => f.effectivity = 0);

    } else {
      // If destroying a non-office, tell the controlling office
      if (destroyedFacility.controllingOfficeId) {
        const office = facilities.find(f => f.id === destroyedFacility.controllingOfficeId) as Office | undefined;
        if (office) {
          office.removeControlledFacility(destroyedFacility.id);
        }
      }
    }
  }
}
