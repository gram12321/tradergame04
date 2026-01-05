import { FacilityBase } from './FacilityBase.js';
import { ProductionFacility } from './ProductionFacility.js';
import { StorageFacility } from './StorageFacility.js';
import { Office } from './Office.js';
import { Market, SellOffer, Contract } from './Market.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { RecipeRegistry } from './RecipeRegistry.js';
import { City } from './City.js';

export class Company {
  id: string;
  name: string;
  balance: number;
  facilities: FacilityBase[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.balance = 10000; // Starting balance
    this.facilities = [];
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
    if (facility instanceof ProductionFacility || facility instanceof StorageFacility) {
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
   * Transfer resources between two facilities
   */
  transferResource(fromFacility: ProductionFacility | StorageFacility, toFacility: ProductionFacility | StorageFacility, resource: string, amount: number): boolean {
    // Verify both facilities belong to this company
    if (fromFacility.ownerId !== this.id || toFacility.ownerId !== this.id) {
      return false;
    }

    // Check if source has enough resources
    if (fromFacility.getResource(resource) < amount) {
      return false;
    }

    // Perform transfer
    if (fromFacility.removeResource(resource, amount)) {
      toFacility.addResource(resource, amount);
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

  /**
   * Create a sell offer on the market
   * Resources are NOT reserved - they stay in facility inventory
   */
  createSellOffer(
    market: Market,
    facility: ProductionFacility | StorageFacility,
    resource: string,
    amountAvailable: number,
    pricePerUnit: number
  ): SellOffer | null {
    // Verify facility belongs to this company
    if (facility.ownerId !== this.id) {
      return null;
    }

    // No check needed - resources are not reserved
    // The seller can list more than they have, contracts will just fail if resources aren't available
    
    // Add sell offer to market
    const offer = market.addSellOffer(
      this.id,
      this.name,
      facility.id,
      resource,
      amountAvailable,
      pricePerUnit
    );

    return offer;
  }

  /**
   * Cancel a sell offer
   */
  cancelSellOffer(
    market: Market,
    offerId: string
  ): boolean {
    const offer = market.getSellOffer(offerId);
    
    // Verify offer exists and belongs to this company
    if (!offer || offer.sellerId !== this.id) {
      return false;
    }

    // Remove offer from market
    return market.removeSellOffer(offerId);
  }

  /**
   * Accept a sell offer and create a contract
   */
  acceptSellOffer(
    market: Market,
    seller: Company,
    offerId: string,
    buyingFacility: ProductionFacility | StorageFacility,
    amountPerTick: number,
    currentTick: number
  ): Contract | null {
    const offer = market.getSellOffer(offerId);
    
    // Verify offer exists
    if (!offer) {
      return null;
    }

    // Can't buy from yourself
    if (offer.sellerId === this.id) {
      return null;
    }

    // Verify buying facility belongs to this company
    if (buyingFacility.ownerId !== this.id) {
      return null;
    }

    // Verify amount is available
    if (offer.amountAvailable < amountPerTick) {
      return null;
    }

    // Create contract in market
    const contract = market.createContract(
      offer,
      this.id,
      this.name,
      buyingFacility.id,
      amountPerTick,
      currentTick
    );

    if (!contract) {
      return null;
    }

    // Find seller's facility
    const sellerFacility = seller.facilities.find(f => f.id === offer.sellerFacilityId);
    if (!sellerFacility) {
      // Rollback contract creation
      market.cancelContract(contract.id);
      return null;
    }

    // Add contract to both facilities for tracking
    sellerFacility.addContract(contract.id, contract.resource, contract.amountPerTick, contract.pricePerUnit, true);
    buyingFacility.addContract(contract.id, contract.resource, contract.amountPerTick, contract.pricePerUnit, false);

    return contract;
  }

  /**
   * Cancel a contract (can be called by either buyer or seller)
   */
  cancelContract(
    market: Market,
    contractId: string
  ): boolean {
    const contract = market.getContract(contractId);
    
    // Verify contract exists
    if (!contract) {
      return false;
    }

    // Verify this company is either buyer or seller
    if (contract.buyerId !== this.id && contract.sellerId !== this.id) {
      return false;
    }

    // Find both facilities
    let sellerFacility: FacilityBase | undefined;
    let buyerFacility: FacilityBase | undefined;

    // Find seller facility (might be in this company or another)
    if (contract.sellerId === this.id) {
      sellerFacility = this.facilities.find(f => f.id === contract.sellerFacilityId);
    }
    
    // Find buyer facility (might be in this company or another)
    if (contract.buyerId === this.id) {
      buyerFacility = this.facilities.find(f => f.id === contract.buyerFacilityId);
    }

    // Remove contract from facilities that we found
    if (sellerFacility) {
      sellerFacility.removeContract(contractId);
    }
    if (buyerFacility) {
      buyerFacility.removeContract(contractId);
    }

    // Cancel contract in market
    return market.cancelContract(contractId) !== null;
  }

  /**
   * Update contract amount (buyer side)
   */
  updateContractAmount(
    market: Market,
    contractId: string,
    newAmount: number
  ): boolean {
    const contract = market.getContract(contractId);
    
    // Verify contract exists and this company is the buyer
    if (!contract || contract.buyerId !== this.id) {
      return false;
    }

    // Update in market
    if (!market.updateContractAmount(contractId, newAmount)) {
      return false;
    }

    // Update in buyer's facility
    const buyerFacility = this.facilities.find(f => f.id === contract.buyerFacilityId);
    if (buyerFacility) {
      buyerFacility.removeContract(contractId);
      buyerFacility.addContract(contractId, contract.resource, newAmount, contract.pricePerUnit, false);
    }

    return true;
  }

  /**
   * Update contract price (seller side)
   */
  updateContractPrice(
    market: Market,
    contractId: string,
    newPrice: number
  ): boolean {
    const contract = market.getContract(contractId);
    
    // Verify contract exists and this company is the seller
    if (!contract || contract.sellerId !== this.id) {
      return false;
    }

    // Update in market
    if (!market.updateContractPrice(contractId, newPrice)) {
      return false;
    }

    // Update in seller's facility
    const sellerFacility = this.facilities.find(f => f.id === contract.sellerFacilityId);
    if (sellerFacility) {
      sellerFacility.removeContract(contractId);
      sellerFacility.addContract(contractId, contract.resource, contract.amountPerTick, newPrice, true);
    }

    return true;
  }

  /**
   * Update sell offer price and/or amount (seller side)
   */
  updateSellOffer(
    market: Market,
    offerId: string,
    newPrice?: number,
    newAmount?: number
  ): boolean {
    const offer = market.getSellOffer(offerId);
    
    // Verify offer exists and belongs to this company
    if (!offer || offer.sellerId !== this.id) {
      return false;
    }

    return market.updateSellOffer(offerId, newPrice, newAmount);
  }

  /**
   * Helper to remove contract from facilities (used by GameEngine during processing)
   * This is for when the other company cancels and we need to clean up our side
   */
  removeContractFromFacility(contractId: string, facilityId: string): void {
    const facility = this.facilities.find(f => f.id === facilityId);
    if (facility) {
      facility.removeContract(contractId);
    }
  }
}
