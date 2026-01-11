import { FacilityBase } from './FacilityBase.js';
import { ProductionFacility } from './ProductionFacility.js';
import { StorageFacility } from './StorageFacility.js';
import { Office } from './Office.js';
import { RetailFacility } from './RetailFacility.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { RecipeRegistry } from './RecipeRegistry.js';
import { City } from './City.js';

export class Company {
  id: string;
  name: string;
  balance: number;
  facilities: FacilityBase[];

  constructor(id: string, name: string, initialBalance: number = 10000) {
    this.id = id;
    this.name = name;
    this.balance = initialBalance;
    this.facilities = [];
  }

  /**
   * Save company data to database
   */
  async save(): Promise<{ success: boolean; error?: string }> {
    // Dynamically import to avoid circular dependencies
    const { CompanyRepository } = await import('../database/CompanyRepository.js');
    const { FacilityRepository } = await import('../database/FacilityRepository.js');

    // Save company
    const companyResult = await CompanyRepository.save(this);
    if (!companyResult.success) {
      return companyResult;
    }

    // Save all facilities
    for (const facility of this.facilities) {
      const facilityResult = await FacilityRepository.save(facility);
      if (!facilityResult.success) {
        return facilityResult;
      }
    }

    return { success: true };
  }

  /**
   * Load company and its facilities from database
   */
  static async load(nameOrId: string): Promise<Company | null> {
    // Dynamically import to avoid circular dependencies
    const { CompanyRepository } = await import('../database/CompanyRepository.js');
    const { FacilityRepository } = await import('../database/FacilityRepository.js');

    // Try to load by name first, then by ID
    let company = await CompanyRepository.loadByName(nameOrId);
    if (!company) {
      company = await CompanyRepository.loadById(nameOrId);
    }

    if (!company) {
      return null;
    }

    // Load facilities
    company.facilities = await FacilityRepository.loadByCompanyId(company.id);

    return company;
  }

  /**
   * Create a new facility
   * @param type The facility type (e.g., 'farm', 'mill', 'bakery', 'warehouse', 'office')
   * @param city The city where the facility is located
   * @returns The created facility, or null if failed
   */
  createFacility(type: string, city: City): FacilityBase | null {
    const definition = FacilityRegistry.get(type);

    // Check if facility type exists
    if (!definition) {
      return null;
    }

    // Check if company has enough balance
    if (this.balance < definition.cost) {
      return null;
    }

    // Office requirement: Can't build non-office facilities without an office in the country
    if (type !== 'office' && !this.hasOfficeInCountry(city.country)) {
      return null;
    }

    // Office restriction: Only one office allowed per country per company
    if (type === 'office' && this.hasOfficeInCountry(city.country)) {
      return null;
    }

    // Count existing facilities of this type
    const typeCount = this.facilities.filter(f => f.type === type).length;
    const facilityNumber = typeCount + 1;

    // Generate facility name: [CompanyName] [FacilityType] #X
    const facilityName = `${this.name} ${definition.name} #${facilityNumber}`;

    // Deduct cost and create the appropriate facility subclass
    this.balance -= definition.cost;
    let facility: FacilityBase;

    switch (definition.category) {
      case 'production':
        facility = new ProductionFacility(type, this.id, facilityName, city);
        break;
      case 'storage':
        facility = new StorageFacility(type, this.id, facilityName, city);
        break;
      case 'office':
        facility = new Office(type, this.id, facilityName, city);
        break;
      case 'retail':
        facility = new RetailFacility(type, this.id, facilityName, city);
        break;
      default:
        // Fallback to production if category unknown
        facility = new ProductionFacility(type, this.id, facilityName, city);
    }

    // Set controlling office for non-office facilities
    if (definition.category !== 'office') {
      const office = this.getOfficeInCountry(city.country);
      if (office) {
        facility.controllingOfficeId = office.id;
        office.addControlledFacility(facility.id);
      }
    }

    // Initialize capacity for facilities with inventory
    if (facility instanceof ProductionFacility || facility instanceof StorageFacility || facility instanceof RetailFacility) {
      facility.updateInventoryCapacityForTick();
    }

    this.facilities.push(facility);

    // Set default recipe for production facilities
    if (facility instanceof ProductionFacility && definition.defaultRecipe) {
      const recipe = RecipeRegistry.get(definition.defaultRecipe);
      if (recipe) {
        facility.setRecipe(recipe);
      }
    }

    return facility;
  }

  /**
   * Check if company has an office in the specified country
   * @param country The country name to check
   * @returns true if company has at least one office in the country
   */
  hasOfficeInCountry(country: string): boolean {
    return this.facilities.some(f => f.type === 'office' && f.city.country === country);
  }

  /**
   * Get the office in a specific country
   * @param country The country name
   * @returns The Office facility, or null if none exists
   */
  getOfficeInCountry(country: string): Office | null {
    const office = this.facilities.find(f => f.type === 'office' && f.city.country === country);
    return office instanceof Office ? office : null;
  }

  /**
   * Destroy/remove a facility from the company
   * @param facility The facility to destroy
   * @returns true if destroyed successfully, false if facility not found
   */
  destroyFacility(facility: FacilityBase): boolean {
    const index = this.facilities.findIndex(f => f.id === facility.id);
    if (index === -1) {
      return false;
    }

    // If destroying an office, mark all facilities in that country as having no office
    if (facility.type === 'office') {
      const country = facility.city.country;
      // Check if this is the last office in the country
      const remainingOffices = this.facilities.filter(
        f => f.type === 'office' && f.city.country === country && f.id !== facility.id
      );

      // If no offices remain, all facilities in that country lose effectivity
      if (remainingOffices.length === 0) {
        this.facilities
          .filter(f => f.city.country === country && f.id !== facility.id)
          .forEach(f => f.effectivity = 0);
      }
    }

    // Remove the facility
    this.facilities.splice(index, 1);
    return true;
  }

  /**
   * Update administrative load for all offices based on controlled facilities
   * Must be called before facility worker calculations
   */
  updateAdministrativeLoads(): void {
    // Get all offices
    const offices = this.facilities.filter(f => f instanceof Office) as Office[];

    offices.forEach(office => {
      // Calculate total wages of controlled facilities
      let totalWages = 0;
      office.controlledFacilityIds.forEach(facId => {
        const facility = this.facilities.find(f => f.id === facId);
        if (facility) {
          totalWages += facility.getWagePerTick();
        }
      });

      // Update the office's administrative load
      office.updateAdministrativeLoad(totalWages);
    });
  }

  /**
   * Update office effectivity multipliers for all facilities
   * Non-office facilities get a hard cap equal to their controlling office's effectivity (0-1)
   * Facilities in countries without offices get 0 effectivity multiplier
   * Offices themselves always have multiplier = 1 to avoid circular dependency
   */
  updateOfficeEffectivity(): void {
    // Get all countries where we have facilities
    const countries = new Set(this.facilities.map(f => f.city.country));

    countries.forEach(country => {
      // Find the office in this country (should only be one per country)
      const office = this.facilities.find(f => f instanceof Office && f.city.country === country) as Office | undefined;

      // Get the office's effectivity as a hard cap (0-1)
      const officeEffectivityCap = office ? Math.min(1, Math.max(0, office.effectivity)) : 0;

      // Update all non-office facilities in this country
      this.facilities
        .filter(f => !(f instanceof Office) && f.city.country === country)
        .forEach(f => {
          f.officeEffectivityMultiplier = officeEffectivityCap;
          f.calculateEffectivity(); // Recalculate with new multiplier
        });
    });
  }

  /**
   * Upgrade a facility's size
   * @param facility The facility to upgrade
   * @returns true if upgrade was successful, false if failed (not enough balance)
   */
  upgradeFacility(facility: FacilityBase): boolean {
    // Verify facility belongs to this company
    if (facility.ownerId !== this.id) {
      return false;
    }

    const cost = facility.getUpgradeCost();

    // Check if company has enough balance
    if (this.balance < cost) {
      return false;
    }

    // Perform upgrade
    const actualCost = facility.upgradeSize();
    if (actualCost !== null) {
      this.balance -= actualCost;
      return true;
    }

    return false;
  }

  /**
   * Degrade a facility's size
   * @param facility The facility to degrade
   * @returns true if degrade was successful (gives 50% refund), false if already at size 1
   */
  degradeFacility(facility: FacilityBase): boolean {
    // Verify facility belongs to this company
    if (facility.ownerId !== this.id) {
      return false;
    }

    if (facility.size <= 1) {
      return false; // Can't degrade size 1
    }

    // Perform degrade and get refund
    const refund = facility.degradeSize();
    if (refund !== null) {
      this.balance += refund;
      return true;
    }

    return false;
  }

  /**
   * Adjust worker count for a facility
   * @param facility The facility to adjust workers for
   * @param workerCount New worker count
   * @returns true if successful, false if failed (insufficient balance or out of bounds)
   */
  setFacilityWorkers(facility: FacilityBase, workerCount: number): boolean {
    // Verify facility belongs to this company
    if (facility.ownerId !== this.id) {
      return false;
    }

    // Calculate hiring/firing cost before making the change
    const workerChange = Math.abs(workerCount - facility.workers);
    const baseWage = 1.0;
    const hiringCost = 4 * baseWage * facility.city.wealth * workerChange;

    // Check if company has enough balance
    if (this.balance < hiringCost) {
      return false;
    }

    // Attempt to set worker count
    const success = facility.setWorkerCount(workerCount);

    if (success) {
      // Deduct the hiring/firing cost
      this.balance -= hiringCost;
      return true;
    }

    return false;
  }



  /**
   * Process wage payments for all facilities
   * Called each tick to deduct wages from company balance
   * @returns Total wages paid this tick
   */
  processWages(): number {
    let totalWages = 0;
    this.facilities.forEach(facility => {
      const wage = facility.getWagePerTick();
      totalWages += wage;
    });
    this.balance -= totalWages;
    return totalWages;
  }

  /**
   * Get total wage expenses per tick
   */
  getTotalWagesPerTick(): number {
    return this.facilities.reduce((sum, facility) => sum + facility.getWagePerTick(), 0);
  }

  /**
   * Get player summary for display
   */
  getSummary(): string {
    return `${this.name}: $${this.balance.toFixed(2)}, ${this.facilities.length} facilities`;
  }
}
