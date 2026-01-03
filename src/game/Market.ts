export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  facilityId: string;
  resource: string;
  amount: number;
  pricePerUnit: number;
  totalPrice: number;
}

export class Market {
  private listings: Map<string, MarketListing>;

  constructor() {
    this.listings = new Map();
  }

  /**
   * Add a listing to the market
   */
  addListing(
    sellerId: string,
    sellerName: string,
    facilityId: string,
    resource: string,
    amount: number,
    pricePerUnit: number
  ): MarketListing {
    const listing: MarketListing = {
      id: Math.random().toString(36).substring(7),
      sellerId,
      sellerName,
      facilityId,
      resource,
      amount,
      pricePerUnit,
      totalPrice: amount * pricePerUnit
    };

    this.listings.set(listing.id, listing);
    return listing;
  }

  /**
   * Remove a listing from the market
   */
  removeListing(listingId: string): boolean {
    return this.listings.delete(listingId);
  }

  /**
   * Get a specific listing
   */
  getListing(listingId: string): MarketListing | undefined {
    return this.listings.get(listingId);
  }

  /**
   * Get all listings
   */
  getAllListings(): MarketListing[] {
    return Array.from(this.listings.values());
  }

  /**
   * Get listings by resource type
   */
  getListingsByResource(resource: string): MarketListing[] {
    return this.getAllListings().filter(listing => listing.resource === resource);
  }

  /**
   * Display market state
   */
  displayMarket(): string {
    const lines: string[] = ['\n=== Market ==='];
    
    if (this.listings.size === 0) {
      lines.push('No items listed on the market.');
      return lines.join('\n');
    }

    // Group by resource
    const byResource = new Map<string, MarketListing[]>();
    this.getAllListings().forEach(listing => {
      if (!byResource.has(listing.resource)) {
        byResource.set(listing.resource, []);
      }
      byResource.get(listing.resource)!.push(listing);
    });

    // Display grouped listings
    byResource.forEach((resourceListings, resource) => {
      lines.push(`\n${resource}:`);
      resourceListings
        .sort((a, b) => a.pricePerUnit - b.pricePerUnit) // Sort by price, cheapest first
        .forEach(listing => {
          lines.push(
            `  [${listing.id}] ${listing.amount} units @ $${listing.pricePerUnit.toFixed(2)}/unit = $${listing.totalPrice.toFixed(2)} (Seller: ${listing.sellerName})`
          );
        });
    });

    return lines.join('\n');
  }
}
