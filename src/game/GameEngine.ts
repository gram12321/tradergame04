import { Company } from './Company.js';
import { Market } from './Market.js';

export class GameEngine {
  private companies: Map<string, Company>;
  private tickCount: number;
  private market: Market;

  constructor() {
    this.companies = new Map();
    this.tickCount = 0;
    this.market = new Market();
  }

  /**
   * Add a company to the game
   */
  addCompany(id: string, name: string): Company {
    const company = new Company(id, name);
    this.companies.set(id, company);
    return company;
  }

  /**
   * Process one game tick for all companies and their facilities.
   * This processes production, then contracts, then updates sell offers, then advances to the next tick.
   */
  processTick(): void {
    // First, process all production for all facilities
    this.companies.forEach(company => {
      company.facilities.forEach(facility => {
        facility.processTick();
      });
    });
    
    // Then, process all contracts in creation order
    this.processContracts();
    
    // Update sell offers based on net production
    this.updateSellOffers();
    
    // Advance to next tick after processing
    this.tickCount++;
  }

  /**
   * Update sell offers based on facility net production
   */
  private updateSellOffers(): void {
    // Get all sell offers
    const offers = this.market.getAllSellOffers();
    
    offers.forEach(offer => {
      // Find the seller company and facility
      const seller = this.companies.get(offer.sellerId);
      if (!seller) return;
      
      const facility = seller.facilities.find(f => f.id === offer.sellerFacilityId);
      if (!facility) return;
      
      // Get the net flow for this resource
      const netFlow = facility.getNetFlow();
      const resourceNetFlow = netFlow.get(offer.resource) || 0;
      
      // Update available amount based on net flow
      const newAvailable = Math.max(0, offer.amountAvailable + resourceNetFlow);
      this.market.updateSellOfferAmount(offer.id, newAvailable);
    });
  }

  /**
   * Process all contracts for the current tick
   * Contracts are processed in creation order (oldest first)
   */
  private processContracts(): void {
    const contracts = this.market.getContractsByCreationOrder();
    
    for (const contract of contracts) {
      // Find buyer and seller companies
      const buyer = this.companies.get(contract.buyerId);
      const seller = this.companies.get(contract.sellerId);
      
      if (!buyer || !seller) {
        // Company no longer exists, skip this contract
        // (In a real game, you might want to auto-cancel these)
        continue;
      }
      
      // Find buyer and seller facilities
      const buyerFacility = buyer.facilities.find(f => f.id === contract.buyerFacilityId);
      const sellerFacility = seller.facilities.find(f => f.id === contract.sellerFacilityId);
      
      if (!buyerFacility || !sellerFacility) {
        // Facility no longer exists, skip this contract
        continue;
      }
      
      // Verify buyer has enough money
      const hasEnoughMoney = buyer.balance >= contract.totalPrice;
      
      // Verify seller has enough available resources
      // (Available = total - reserved for other contracts/offers)
      const sellerAvailable = sellerFacility.getResource(contract.resource);
      const hasEnoughResources = sellerAvailable >= contract.amountPerTick;
      
      // Execute contract if both conditions are met
      if (hasEnoughMoney && hasEnoughResources) {
        // Transfer resources from seller to buyer
        sellerFacility.removeResource(contract.resource, contract.amountPerTick);
        buyerFacility.addResource(contract.resource, contract.amountPerTick);
        
        // Transfer money from buyer to seller
        buyer.balance -= contract.totalPrice;
        seller.balance += contract.totalPrice;
        
        // Mark contract as successful (clear any previous failure)
        this.market.markContractSuccess(contract.id);
      } else {
        // Mark contract as failed for this tick
        this.market.markContractFailed(contract.id, this.tickCount);
      }
    }
  }

  /**
   * Get a company by ID
   */
  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  /**
   * Get current game state summary
   */
  getGameState(): string {
    const lines: string[] = [];
    lines.push(`\n=== Tick ${this.tickCount} ===`);
    
    this.companies.forEach(company => {
      lines.push(company.getSummary());
      company.facilities.forEach((facility, index) => {
        lines.push(`  Facility ${index + 1}: ${facility.getStatus()}`);
      });
    });
    
    return lines.join('\n');
  }

  /**
   * Get current tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Get the market
   */
  getMarket(): Market {
    return this.market;
  }
}
