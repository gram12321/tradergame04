import { Facility } from './Facility.js';
import { Market, MarketListing } from './Market.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { RecipeRegistry } from './RecipeRegistry.js';

export class Company {
  id: string;
  name: string;
  balance: number;
  facilities: Facility[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.balance = 10000; // Starting balance
    this.facilities = [];
  }

  /**
   * Create a new facility
   * @param type The facility type (e.g., 'farm', 'mill', 'bakery', 'warehouse')
   * @returns The created facility, or null if failed
   */
  createFacility(type: string): Facility | null {
    const definition = FacilityRegistry.get(type);
    
    // Check if facility type exists
    if (!definition) {
      return null;
    }

    // Check if company has enough balance
    if (this.balance < definition.cost) {
      return null;
    }

    // Count existing facilities of this type
    const typeCount = this.facilities.filter(f => f.type === type).length;
    const facilityNumber = typeCount + 1;
    
    // Generate facility name: [CompanyName] [FacilityType] #X
    const facilityName = `${this.name} ${definition.name} #${facilityNumber}`;

    // Deduct cost and create facility
    this.balance -= definition.cost;
    const facility = new Facility(type, this.id, facilityName);
    this.facilities.push(facility);

    // Set default recipe if one exists
    if (definition.defaultRecipe) {
      const recipe = RecipeRegistry.get(definition.defaultRecipe);
      if (recipe) {
        facility.setRecipe(recipe);
      }
    }

    return facility;
  }

  /**
   * Transfer resources between two facilities
   */
  transferResource(fromFacility: Facility, toFacility: Facility, resource: string, amount: number): boolean {
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
   * Get player summary for display
   */
  getSummary(): string {
    return `${this.name}: $${this.balance.toFixed(2)}, ${this.facilities.length} facilities`;
  }

  /**
   * List resources from a facility on the market
   */
  listResourceOnMarket(
    market: Market,
    facility: Facility,
    resource: string,
    amount: number,
    pricePerUnit: number
  ): MarketListing | null {
    // Verify facility belongs to this company
    if (facility.ownerId !== this.id) {
      return null;
    }

    // Check if facility has enough resources
    if (facility.getResource(resource) < amount) {
      return null;
    }

    // Remove resources from facility inventory
    if (!facility.removeResource(resource, amount)) {
      return null;
    }

    // Add listing to market
    const listing = market.addListing(
      this.id,
      this.name,
      facility.id,
      resource,
      amount,
      pricePerUnit
    );

    return listing;
  }

  /**
   * Cancel a market listing and return resources to facility
   */
  cancelMarketListing(
    market: Market,
    listingId: string
  ): boolean {
    const listing = market.getListing(listingId);
    
    // Verify listing exists and belongs to this company
    if (!listing || listing.sellerId !== this.id) {
      return false;
    }

    // Find the facility
    const facility = this.facilities.find(f => f.id === listing.facilityId);
    if (!facility) {
      return false;
    }

    // Return resources to facility
    facility.addResource(listing.resource, listing.amount);

    // Remove listing from market
    return market.removeListing(listingId);
  }

  /**
   * Purchase a listing from the market
   */
  purchaseFromMarket(
    market: Market,
    seller: Company,
    listingId: string,
    receivingFacility: Facility
  ): boolean {
    const listing = market.getListing(listingId);
    
    // Verify listing exists
    if (!listing) {
      return false;
    }

    // Can't buy from yourself
    if (listing.sellerId === this.id) {
      return false;
    }

    // Verify receiving facility belongs to this company
    if (receivingFacility.ownerId !== this.id) {
      return false;
    }

    // Check if buyer has enough balance
    if (this.balance < listing.totalPrice) {
      return false;
    }

    // Transfer money
    this.balance -= listing.totalPrice;
    seller.balance += listing.totalPrice;

    // Add resources to receiving facility
    receivingFacility.addResource(listing.resource, listing.amount);

    // Remove listing from market
    market.removeListing(listingId);

    return true;
  }
}
