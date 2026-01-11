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

    // Then, process all contracts in creation order
    this.processContracts();

    // Then, process all internal transfers in creation order
    this.processInternalTransfers();

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
    // Get all sell offers
    const offers = this.contractSystem.getAllSellOffers();

    offers.forEach(offer => {
      // Find the seller company and facility
      const seller = this.companies.get(offer.sellerId);
      if (!seller) return;

      const facility = seller.facilities.find(f => f.id === offer.sellerFacilityId);
      if (!facility) return;

      // Only production and storage facilities have inventory and flow tracking
      if (!(facility instanceof ProductionFacility || facility instanceof StorageFacility)) return;

      // Get the net flow for this resource
      const netFlow = facility.getNetFlow();
      const resourceNetFlow = netFlow.get(offer.resource) || 0;

      // Update available amount based on net flow
      const newAvailable = Math.max(0, offer.amountAvailable + resourceNetFlow);
      this.contractSystem.updateSellOfferAmount(offer.id, newAvailable);
    });
  }

  /**
   * Process all contracts for the current tick
   * Contracts are processed in creation order (oldest first)
   */
  private processContracts(): void {
    const contracts = this.contractSystem.getContractsByCreationOrder();

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

      // Check if facilities have inventory (Production or Storage facilities)
      if (!(buyerFacility instanceof ProductionFacility || buyerFacility instanceof StorageFacility) ||
        !(sellerFacility instanceof ProductionFacility || sellerFacility instanceof StorageFacility)) {
        // Can't execute contracts on offices
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
        this.contractSystem.markContractSuccess(contract.id);
      } else {
        // Mark contract as failed for this tick
        this.contractSystem.markContractFailed(contract.id, this.tickCount);
      }
    }
  }

  /**
   * Process all internal transfers for the current tick
   * Internal transfers are processed in creation order (oldest first)
   */
  private processInternalTransfers(): void {
    const transfers = this.contractSystem.getInternalTransfersByCreationOrder();

    for (const transfer of transfers) {
      // Find owner company
      const owner = this.companies.get(transfer.ownerId);

      if (!owner) {
        // Company no longer exists, skip this transfer
        continue;
      }

      // Find from and to facilities
      const fromFacility = owner.facilities.find(f => f.id === transfer.fromFacilityId);
      const toFacility = owner.facilities.find(f => f.id === transfer.toFacilityId);

      if (!fromFacility || !toFacility) {
        // Facility no longer exists, skip this transfer
        continue;
      }

      // Check if at least one facility is a warehouse (Storage facility)
      // Transfers are allowed between any facility and a warehouse (in either direction)
      const fromIsWarehouse = fromFacility instanceof StorageFacility;
      const toIsWarehouse = toFacility instanceof StorageFacility;

      if (!fromIsWarehouse && !toIsWarehouse) {
        // At least one facility must be a warehouse
        continue;
      }

      // Both facilities must have inventory (Production or Storage facilities)
      if (!(fromFacility instanceof ProductionFacility || fromFacility instanceof StorageFacility) ||
        !(toFacility instanceof ProductionFacility || toFacility instanceof StorageFacility)) {
        // Can't transfer to/from offices
        continue;
      }

      // Verify source has enough available resources
      const sourceAvailable = fromFacility.getResource(transfer.resource);
      const hasEnoughResources = sourceAvailable >= transfer.amountPerTick;

      // Execute transfer if resources are available
      if (hasEnoughResources) {
        // Transfer resources from source to destination (no cost)
        fromFacility.removeResource(transfer.resource, transfer.amountPerTick);
        toFacility.addResource(transfer.resource, transfer.amountPerTick);

        // Mark transfer as successful (clear any previous failure)
        this.contractSystem.markInternalTransferSuccess(transfer.id);
      } else {
        // Mark transfer as failed for this tick
        this.contractSystem.markInternalTransferFailed(transfer.id, this.tickCount);
      }
    }
  }

  /**
   * Get the contract system
   */
  getContractSystem(): ContractSystem {
    return this.contractSystem;
  }
}
