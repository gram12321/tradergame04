import { Company } from './Company.js';
import { ContractSystem } from './ContractSystem.js';
import { ProductionFacility } from './ProductionFacility.js';
import { StorageFacility } from './StorageFacility.js';
import { RetailFacility } from './RetailFacility.js';
import { CityRegistry } from './CityRegistry.js';

export class GameEngine {
  private companies: Map<string, Company>;
  private tickCount: number;
  private contractSystem: ContractSystem;

  constructor() {
    this.companies = new Map();
    this.tickCount = 0;
    this.contractSystem = new ContractSystem();
  }

  /**
   * Get all companies
   */
  getCompanies(): Company[] {
    return Array.from(this.companies.values());
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
   * Save all game state to database
   */
  async saveAll(): Promise<{ success: boolean; error?: string }> {
    try {
      // Dynamically import repositories
      const { GameStateRepository } = await import('../database/GameStateRepository.js');

      // Save tick count
      const tickResult = await GameStateRepository.setTickCount(this.tickCount);
      if (!tickResult.success) {
        return tickResult;
      }

      // Save all companies (and their facilities)
      for (const company of this.companies.values()) {
        const result = await company.save();
        if (!result.success) {
          return result;
        }
      }

      // Save contract system state (sell offers and trade routes)
      const marketResult = await this.contractSystem.save();
      if (!marketResult.success) {
        return marketResult;
      }

      console.log(`✅ Game saved successfully (tick ${this.tickCount})`);
      return { success: true };
    } catch (err: any) {
      console.error('Failed to save game:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Load all game state from database
   */
  async loadAll(): Promise<{ success: boolean; error?: string }> {
    try {
      // Dynamically import repositories
      const { GameStateRepository } = await import('../database/GameStateRepository.js');
      const { CompanyRepository } = await import('../database/CompanyRepository.js');

      // Load tick count
      this.tickCount = await GameStateRepository.getTickCount();

      // Load all companies
      const companyRows = await CompanyRepository.loadAll();

      this.companies.clear();
      for (const companyRow of companyRows) {
        // Load facilities for this company
        const { FacilityRepository } = await import('../database/FacilityRepository.js');
        companyRow.facilities = await FacilityRepository.loadByCompanyId(companyRow.id);

        // Add to game engine
        this.companies.set(companyRow.id, companyRow);
      }

      // Load contract system state (sell offers and trade routes)
      const marketLoadResult = await this.contractSystem.load(this.companies);
      if (!marketLoadResult.success) {
        return marketLoadResult;
      }

      console.log(`✅ Game loaded successfully (tick ${this.tickCount}, ${this.companies.size} companies)`);
      return { success: true };
    } catch (err: any) {
      console.error('Failed to load game:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get current tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Process one game tick for all companies and their facilities.
   * This processes wages, then production, then contracts, then updates sell offers, then advances to the next tick.
   * @param autosave Whether to automatically save to database after processing (default: false)
   */
  async processTick(autosave: boolean = false): Promise<void> {
    // First, update administrative loads for all offices (based on controlled facility wages)
    this.companies.forEach(company => {
      company.updateAdministrativeLoads();
    });

    // Then, update office effectivity multipliers for all facilities
    this.companies.forEach(company => {
      company.updateOfficeEffectivity();
    });

    // Then, process wages for all companies
    this.companies.forEach(company => {
      company.processWages();
    });

    // Then, process all production for all facilities
    this.companies.forEach(company => {
      company.facilities.forEach(facility => {
        facility.processTick();
      });
    });

    // Then, process all trade routes (contracts and internal transfers) in creation order
    this.processTradeRoutes();

    // Process retail demand for all cities
    this.processRetailDemand();


    // Update sell offers based on net production
    this.updateSellOffers();

    // Advance to next tick after processing
    this.tickCount++;

    // Auto-save if enabled
    if (autosave) {
      await this.saveAll();
    }
  }

  /**
   * Process retail demand for all cities
   * Calculates demand and distributes sales among retailers in each city
   */
  private processRetailDemand(): void {
    const cities = CityRegistry.getAllCities();

    for (const city of cities) {
      // Collect all retail facilities in this city across all companies
      const retailersInCity: RetailFacility[] = [];

      this.companies.forEach(company => {
        company.facilities.forEach(facility => {
          if (facility instanceof RetailFacility &&
            facility.city.name === city.name &&
            facility.city.country === city.country) {
            retailersInCity.push(facility);
          }
        });
      });

      // Process demand for this city
      if (retailersInCity.length > 0) {
        city.processRetailDemand(retailersInCity);

        // Add retail revenue to company balances
        retailersInCity.forEach(retailer => {
          const company = this.companies.get(retailer.ownerId);
          if (company && retailer.revenue > 0) {
            company.balance += retailer.revenue;
          }
        });
      }
    }
  }

  /**
   * Update sell offers based on facility net production
   */
  private updateSellOffers(): void {
    this.contractSystem.getAllSellOffers().forEach(offer => {
      const seller = this.companies.get(offer.sellerId);
      const facility = seller?.facilities.find(f => f.id === offer.sellerFacilityId);

      if (facility instanceof ProductionFacility || facility instanceof StorageFacility) {
        const netFlow = facility.getNetFlow().get(offer.resource) || 0;
        this.contractSystem.updateSellOfferAmount(offer.id, Math.max(0, offer.amountAvailable + netFlow));
      }
    });
  }

  /**
   * Process all recurring trade routes (contracts and internal transfers)
   */
  private processTradeRoutes(): void {
    this.contractSystem.getTradeRoutesByCreationOrder().forEach(route => {
      const buyer = this.companies.get(route.buyerId);
      const seller = this.companies.get(route.sellerId);
      const fromFac = seller?.facilities.find(f => f.id === route.sellerFacilityId);
      const toFac = buyer?.facilities.find(f => f.id === route.buyerFacilityId);

      if (!fromFac || !toFac || !(fromFac instanceof ProductionFacility || fromFac instanceof StorageFacility) || !(toFac instanceof ProductionFacility || toFac instanceof StorageFacility)) return;

      // Internal transfer requirements: at least one warehouse
      if (route.isInternal && !(fromFac instanceof StorageFacility || toFac instanceof StorageFacility)) return;

      const hasMoney = route.isInternal || buyer!.balance >= route.totalPrice;
      const hasStock = fromFac.getResource(route.resource) >= route.amountPerTick;

      if (hasMoney && hasStock) {
        if (fromFac.removeResource(route.resource, route.amountPerTick)) {
          toFac.addResource(route.resource, route.amountPerTick);
          if (!route.isInternal) {
            buyer!.balance -= route.totalPrice;
            seller!.balance += route.totalPrice;
          }
          this.contractSystem.markRouteStatus(route.id, null);
        }
      } else {
        this.contractSystem.markRouteStatus(route.id, this.tickCount);
      }
    });
  }

  /**
   * Get the contract system
   */
  getContractSystem(): ContractSystem {
    return this.contractSystem;
  }
}
