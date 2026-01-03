import { Recipe } from './Recipe.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import type { Market } from './Market.js';

export interface MarketListingInfo {
  listingId: string;
  amount: number;
  pricePerUnit: number;
}

export class Facility {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  inventory: Map<string, number>;
  marketListings: Map<string, MarketListingInfo[]>; // resource -> array of listing info
  recipe: Recipe | null;
  productionProgress: number;
  isProducing: boolean;

  constructor(type: string, ownerId: string, name: string) {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.type = type;
    this.ownerId = ownerId;
    this.inventory = new Map();
    this.marketListings = new Map();
    this.recipe = null;
    this.productionProgress = 0;
    this.isProducing = false;
  }

  /**
   * Set the recipe for this facility
   * @returns true if recipe was set successfully, false if not allowed
   */
  setRecipe(recipe: Recipe): boolean {
    // Check if this facility type can produce
    if (!FacilityRegistry.canProduce(this.type)) {
      return false;
    }

    // Check if recipe is allowed for this facility type
    if (!FacilityRegistry.isRecipeAllowed(this.type, recipe.name)) {
      return false;
    }

    this.recipe = recipe;
    this.isProducing = false;
    this.productionProgress = 0;
    return true;
  }

  /**
   * Add resources to facility inventory
   */
  addResource(resource: string, amount: number): void {
    const current = this.inventory.get(resource) || 0;
    this.inventory.set(resource, current + amount);
  }

  /**
   * Remove resources from facility inventory
   * For internal use (production, transfer): reduces available first, then adjusts listings if needed
   */
  removeResource(resource: string, amount: number, market?: Market): boolean {
    const current = this.inventory.get(resource) || 0;
    if (current < amount) {
      return false;
    }
    
    const newTotal = current - amount;
    this.inventory.set(resource, newTotal);
    
    // Check if we need to adjust market listings
    const listed = this.getListedAmount(resource);
    if (listed > 0 && market) {
      // If the new total is less than what's listed, we need to reduce listings
      if (newTotal < listed) {
        const reduceListingsBy = listed - newTotal;
        this.reduceMarketListings(resource, reduceListingsBy, market);
      }
    }
    
    return true;
  }
  
  /**
   * Reduce market listings for a resource proportionally
   */
  private reduceMarketListings(resource: string, amountToReduce: number, market: Market): void {
    const listings = this.marketListings.get(resource);
    if (!listings || listings.length === 0) return;
    
    let remaining = amountToReduce;
    
    // Reduce from listings proportionally (oldest first)
    for (let i = 0; i < listings.length && remaining > 0; i++) {
      const listing = listings[i];
      const reduceAmount = Math.min(listing.amount, remaining);
      
      listing.amount -= reduceAmount;
      remaining -= reduceAmount;
      
      // Update the market listing
      if (listing.amount <= 0) {
        // Remove from market
        market.removeListing(listing.listingId);
        listings.splice(i, 1);
        i--; // Adjust index after removal
      } else {
        // Update market listing amount
        market.updateListingAmount(listing.listingId, listing.amount);
      }
    }
    
    // Clean up empty arrays
    if (listings.length === 0) {
      this.marketListings.delete(resource);
    }
  }

  /**
   * Get resource amount in inventory
   */
  getResource(resource: string): number {
    return this.inventory.get(resource) || 0;
  }

  /**
   * Get the amount of a resource that is listed on the market
   */
  getListedAmount(resource: string): number {
    const listings = this.marketListings.get(resource) || [];
    return listings.reduce((sum, listing) => sum + listing.amount, 0);
  }

  /**
   * Get the available (unlisted) amount of a resource
   */
  getAvailableAmount(resource: string): number {
    const total = this.getResource(resource);
    const listed = this.getListedAmount(resource);
    return total - listed;
  }

  /**
   * Add a market listing for resources in this facility
   */
  addMarketListing(resource: string, amount: number, listingId: string, pricePerUnit: number): boolean {
    // Check if we have enough available resources
    if (this.getAvailableAmount(resource) < amount) {
      return false;
    }

    // Add to market listings
    if (!this.marketListings.has(resource)) {
      this.marketListings.set(resource, []);
    }
    
    this.marketListings.get(resource)!.push({
      listingId,
      amount,
      pricePerUnit
    });

    return true;
  }

  /**
   * Remove a market listing from this facility
   */
  removeMarketListing(resource: string, listingId: string): boolean {
    const listings = this.marketListings.get(resource);
    if (!listings) {
      return false;
    }

    const index = listings.findIndex(l => l.listingId === listingId);
    if (index === -1) {
      return false;
    }

    // Remove the listing
    listings.splice(index, 1);

    // Clean up empty arrays
    if (listings.length === 0) {
      this.marketListings.delete(resource);
    }

    return true;
  }

  /**
   * Remove resources from inventory when sold on market
   * Reduces both total inventory and the specific listing
   */
  soldFromMarket(resource: string, listingId: string, market?: Market): boolean {
    const listings = this.marketListings.get(resource);
    if (!listings) {
      return false;
    }

    const listingIndex = listings.findIndex(l => l.listingId === listingId);
    if (listingIndex === -1) {
      return false;
    }

    const listing = listings[listingIndex];
    const current = this.inventory.get(resource) || 0;
    
    // Check if we have enough in inventory
    if (current < listing.amount) {
      return false;
    }

    // Remove from total inventory
    this.inventory.set(resource, current - listing.amount);

    // Remove from market listings
    listings.splice(listingIndex, 1);
    if (listings.length === 0) {
      this.marketListings.delete(resource);
    }

    return true;
  }

  /**
   * Start production if recipe can be executed
   */
  startProduction(): boolean {
    if (!this.recipe || this.isProducing) {
      return false;
    }

    if (this.recipe.canExecute(this.inventory)) {
      this.isProducing = true;
      this.productionProgress = 0;
      return true;
    }

    return false;
  }

  /**
   * Process one tick of production
   */
  processTick(market?: Market): void {
    // Try to auto-start production if not producing
    if (!this.isProducing && this.recipe) {
      this.startProduction();
    }

    // If not producing (no recipe or can't start), exit early
    if (!this.isProducing || !this.recipe) {
      return;
    }

    this.productionProgress++;

    // Check if production is complete
    if (this.productionProgress >= this.recipe.ticksRequired) {
      this.completeProduction(market);
    }
  }

  /**
   * Complete the current production cycle
   */
  private completeProduction(market?: Market): void {
    if (!this.recipe) return;

    // Consume inputs (market parameter allows automatic listing reduction if needed)
    this.recipe.inputs.forEach(input => {
      this.removeResource(input.resource, input.amount, market);
    });

    // Produce outputs
    this.recipe.outputs.forEach(output => {
      this.addResource(output.resource, output.amount);
    });

    // Reset production state
    this.isProducing = false;
    this.productionProgress = 0;

    // Auto-start next cycle if possible
    this.startProduction();
  }

  /**
   * Get facility status
   */
  getStatus(): string {
    const inventoryStr = Array.from(this.inventory.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([resource, amount]) => {
        const listed = this.getListedAmount(resource);
        if (listed > 0) {
          const available = amount - listed;
          return `${resource}: ${amount} (${available} available, ${listed} listed)`;
        }
        return `${resource}: ${amount}`;
      })
      .join(', ');

    const statusStr = this.isProducing 
      ? `Producing (${this.productionProgress}/${this.recipe?.ticksRequired})` 
      : 'Idle';

    return `[${this.name}] ${statusStr} | Inventory: {${inventoryStr || 'empty'}}`;
  }
}
