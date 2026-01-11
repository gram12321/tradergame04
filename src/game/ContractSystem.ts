import { FacilityBase } from './FacilityBase.js';
import { ProductionFacility } from './ProductionFacility.js';
import { StorageFacility } from './StorageFacility.js';
import { RetailFacility } from './RetailFacility.js';

// Minimal interface to avoid circular dependency with Company.ts
export interface CompanyLike {
  id: string;
  name: string;
  facilities: FacilityBase[];
}

// Sell offers that can be accepted to form contracts
export interface SellOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerFacilityId: string;
  resource: string;
  amountAvailable: number; // Total amount listed (can grow with production)
  amountInStock: number; // Amount available minus what's already contracted
  pricePerUnit: number;
}

// Recurring contract between buyer and seller
export interface Contract {
  id: string;
  sellOfferId: string; // Link back to the sell offer this contract is based on
  sellerId: string;
  sellerName: string;
  sellerFacilityId: string;
  buyerId: string;
  buyerName: string;
  buyerFacilityId: string;
  resource: string;
  amountPerTick: number;
  pricePerUnit: number;
  totalPrice: number; // amountPerTick * pricePerUnit
  createdAt: number; // Tick when contract was created
  lastFailedTick: number | null; // Last tick when contract failed, null if never failed or last success
}

// Internal transfer between facilities within the same company
// At least one facility must be a warehouse (storage facility)
export interface InternalTransfer {
  id: string;
  ownerId: string;
  ownerName: string;
  fromFacilityId: string;
  fromFacilityName: string;
  toFacilityId: string;
  toFacilityName: string;
  resource: string;
  amountPerTick: number;
  createdAt: number; // Tick when transfer was created
  lastFailedTick: number | null; // Last tick when transfer failed
}

export class ContractSystem {
  private sellOffers: Map<string, SellOffer>;
  private contracts: Map<string, Contract>;
  private contractCreationCounter: number; // For ordering contracts
  private internalTransfers: Map<string, InternalTransfer>;
  private internalTransferCreationCounter: number; // For ordering internal transfers

  constructor() {
    this.sellOffers = new Map();
    this.contracts = new Map();
    this.contractCreationCounter = 0;
    this.internalTransfers = new Map();
    this.internalTransferCreationCounter = 0;
  }

  // ========================================
  // SELL OFFER METHODS
  // ========================================

  /**
   * Add a sell offer
   */
  addSellOffer(
    sellerId: string,
    sellerName: string,
    sellerFacilityId: string,
    resource: string,
    amountAvailable: number,
    pricePerUnit: number
  ): SellOffer {
    const offer: SellOffer = {
      id: Math.random().toString(36).substring(7),
      sellerId,
      sellerName,
      sellerFacilityId,
      resource,
      amountAvailable,
      amountInStock: amountAvailable, // Initially, in stock equals available
      pricePerUnit
    };

    this.sellOffers.set(offer.id, offer);
    return offer;
  }

  /**
   * Remove a sell offer
   */
  removeSellOffer(offerId: string): boolean {
    return this.sellOffers.delete(offerId);
  }

  /**
   * Update a sell offer's available amount
   */
  updateSellOfferAmount(offerId: string, newAmount: number): boolean {
    const offer = this.sellOffers.get(offerId);
    if (!offer) {
      return false;
    }

    if (newAmount <= 0) {
      return this.removeSellOffer(offerId);
    }

    offer.amountAvailable = newAmount;
    // Recalculate in stock based on contracted amounts
    this.recalculateSellOfferInStock(offerId);
    return true;
  }

  /**
   * Recalculate the in-stock amount for a sell offer based on active contracts
   */
  private recalculateSellOfferInStock(offerId: string): void {
    const offer = this.sellOffers.get(offerId);
    if (!offer) return;

    // Find all contracts linked to this offer
    let totalContracted = 0;
    this.contracts.forEach(contract => {
      if (contract.sellOfferId === offerId) {
        totalContracted += contract.amountPerTick;
      }
    });

    offer.amountInStock = Math.max(0, offer.amountAvailable - totalContracted);
  }

  /**
   * Get a specific sell offer
   */
  getSellOffer(offerId: string): SellOffer | undefined {
    return this.sellOffers.get(offerId);
  }

  /**
   * Get all sell offers
   */
  getAllSellOffers(): SellOffer[] {
    return Array.from(this.sellOffers.values());
  }

  /**
   * Get all sell offers that have stock available (for display/purchase)
   */
  getAvailableSellOffers(): SellOffer[] {
    return Array.from(this.sellOffers.values()).filter(offer => offer.amountInStock > 0);
  }

  /**
   * Get sell offers by resource type (only those with stock)
   */
  getSellOffersByResource(resource: string): SellOffer[] {
    return this.getAvailableSellOffers().filter(offer => offer.resource === resource);
  }

  /**
   * Update sell offer price and/or amount
   */
  updateSellOffer(offerId: string, newPrice?: number, newAmount?: number): boolean {
    const offer = this.sellOffers.get(offerId);
    if (!offer) {
      return false;
    }

    // Update price if provided
    if (newPrice !== undefined) {
      offer.pricePerUnit = newPrice;
    }

    // Update amount if provided
    if (newAmount !== undefined) {
      const oldAmount = offer.amountAvailable;
      const amountDiff = newAmount - oldAmount;

      offer.amountAvailable = newAmount;
      // Adjust in stock by the same difference
      offer.amountInStock = Math.max(0, offer.amountInStock + amountDiff);
    }

    return true;
  }

  /**
   * Orchestrate creating a sell offer (system + facility update)
   */
  executeCreateSellOffer(
    seller: CompanyLike,
    facility: FacilityBase,
    resource: string,
    amountAvailable: number,
    pricePerUnit: number
  ): SellOffer | null {
    // Basic validation
    if (amountAvailable <= 0 || pricePerUnit <= 0 || facility.ownerId !== seller.id) {
      return null;
    }

    // Add sell offer to market
    return this.addSellOffer(
      seller.id,
      seller.name,
      facility.id,
      resource,
      amountAvailable,
      pricePerUnit
    );
  }

  /**
   * Orchestrate canceling a sell offer (system update)
   */
  executeCancelSellOffer(seller: CompanyLike, offerId: string): boolean {
    const offer = this.getSellOffer(offerId);
    if (!offer || offer.sellerId !== seller.id) {
      return false;
    }
    return this.removeSellOffer(offerId);
  }

  /**
   * Orchestrate updating a sell offer (system update)
   */
  executeUpdateSellOffer(
    seller: CompanyLike,
    offerId: string,
    newPrice?: number,
    newAmount?: number
  ): boolean {
    const offer = this.getSellOffer(offerId);
    if (!offer || offer.sellerId !== seller.id) {
      return false;
    }
    return this.updateSellOffer(offerId, newPrice, newAmount);
  }

  // ========================================
  // CONTRACT METHODS
  // ========================================

  /**
   * Create a contract from a sell offer
   * Note: Caller must handle facility tracking (addContract to facilities)
   */
  createContract(
    offer: SellOffer,
    buyerId: string,
    buyerName: string,
    buyerFacilityId: string,
    amountPerTick: number
  ): Contract | null {
    // Verify offer exists and has enough in stock
    if (!this.sellOffers.has(offer.id) || offer.amountInStock < amountPerTick) {
      return null;
    }

    const contract: Contract = {
      id: Math.random().toString(36).substring(7),
      sellOfferId: offer.id,
      sellerId: offer.sellerId,
      sellerName: offer.sellerName,
      sellerFacilityId: offer.sellerFacilityId,
      buyerId,
      buyerName,
      buyerFacilityId,
      resource: offer.resource,
      amountPerTick,
      pricePerUnit: offer.pricePerUnit,
      totalPrice: amountPerTick * offer.pricePerUnit,
      createdAt: this.contractCreationCounter++,
      lastFailedTick: null
    };

    this.contracts.set(contract.id, contract);

    // Reduce in-stock amount
    offer.amountInStock -= amountPerTick;

    return contract;
  }

  /**
   * Get a specific contract
   */
  getContract(contractId: string): Contract | undefined {
    return this.contracts.get(contractId);
  }

  /**
   * Get all contracts
   */
  getAllContracts(): Contract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Get contracts sorted by creation order (oldest first)
   */
  getContractsByCreationOrder(): Contract[] {
    return this.getAllContracts().sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Update contract amount (buyer adjusts how much they want per tick)
   * Returns the amount difference if successful, null if failed
   * Caller must check sell offer stock availability before calling
   */
  updateContractAmount(contractId: string, newAmount: number): { amountDiff: number; offer: SellOffer } | null {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      return null;
    }

    const offer = this.sellOffers.get(contract.sellOfferId);
    if (!offer) {
      return null;
    }

    const oldAmount = contract.amountPerTick;
    const amountDiff = newAmount - oldAmount;

    // Check if there's enough in stock for the increase
    if (amountDiff > 0 && offer.amountInStock < amountDiff) {
      return null;
    }

    // Update contract
    contract.amountPerTick = newAmount;
    contract.totalPrice = newAmount * contract.pricePerUnit;

    // Update offer in stock
    offer.amountInStock -= amountDiff;

    return { amountDiff, offer };
  }

  /**
   * Update contract price (seller adjusts price)
   */
  updateContractPrice(contractId: string, newPrice: number): boolean {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      return false;
    }

    contract.pricePerUnit = newPrice;
    contract.totalPrice = contract.amountPerTick * newPrice;
    return true;
  }

  /**
   * Cancel a contract
   * Returns the cancelled contract (caller must handle facility cleanup)
   * Automatically restores stock to the sell offer
   */
  cancelContract(contractId: string): Contract | null {
    const contract = this.contracts.get(contractId);
    if (!contract) {
      return null;
    }

    this.contracts.delete(contractId);

    // Restore the in-stock amount to the sell offer
    const offer = this.sellOffers.get(contract.sellOfferId);
    if (offer) {
      offer.amountInStock += contract.amountPerTick;
    }

    return contract;
  }

  /**
   * Mark a contract as failed for this tick
   */
  markContractFailed(contractId: string, currentTick: number): void {
    const contract = this.contracts.get(contractId);
    if (contract) {
      contract.lastFailedTick = currentTick;
    }
  }

  /**
   * Orchestrate accepting a sell offer (system + facility updates for both parties)
   */
  executeAcceptSellOffer(
    buyer: CompanyLike,
    seller: CompanyLike,
    offerId: string,
    buyingFacility: FacilityBase,
    amountPerTick: number
  ): Contract | null {
    const offer = this.getSellOffer(offerId);

    // Verify offer and ownership
    if (!offer || offer.sellerId === buyer.id || buyingFacility.ownerId !== buyer.id) {
      return null;
    }

    // Verify amount is available
    if (offer.amountAvailable < amountPerTick) {
      return null;
    }

    // Create contract in system
    const contract = this.createContract(
      offer,
      buyer.id,
      buyer.name,
      buyingFacility.id,
      amountPerTick
    );

    if (!contract) {
      return null;
    }

    // Find seller's facility
    const sellerFacility = seller.facilities.find(f => f.id === offer.sellerFacilityId);
    if (!sellerFacility) {
      // Rollback contract creation if seller facility not found
      this.contracts.delete(contract.id);
      offer.amountInStock += amountPerTick;
      return null;
    }

    // Update facilities for tracking
    sellerFacility.addContract(contract.id, contract.resource, contract.amountPerTick, contract.pricePerUnit, true);
    buyingFacility.addContract(contract.id, contract.resource, contract.amountPerTick, contract.pricePerUnit, false);

    return contract;
  }

  /**
   * Orchestrate canceling a contract (system + facility updates for both parties)
   */
  executeCancelContract(
    contractId: string,
    actingCompany: CompanyLike,
    otherCompany: CompanyLike | null
  ): boolean {
    const contract = this.getContract(contractId);
    if (!contract) return false;

    // Verify acting company is part of the contract
    if (contract.buyerId !== actingCompany.id && contract.sellerId !== actingCompany.id) {
      return false;
    }

    // Find facilities to update
    const actingIsBuyer = contract.buyerId === actingCompany.id;

    // Update acting company's facility
    const actingFacilityId = actingIsBuyer ? contract.buyerFacilityId : contract.sellerFacilityId;
    const actingFacility = actingCompany.facilities.find(f => f.id === actingFacilityId);
    if (actingFacility) {
      actingFacility.removeContract(contractId);
    }

    // Update other company's facility if provided
    if (otherCompany) {
      const otherFacilityId = actingIsBuyer ? contract.sellerFacilityId : contract.buyerFacilityId;
      const otherFacility = otherCompany.facilities.find(f => f.id === otherFacilityId);
      if (otherFacility) {
        otherFacility.removeContract(contractId);
      }
    }

    // Cancel in system (handles stock restoration)
    return this.cancelContract(contractId) !== null;
  }

  /**
   * Orchestrate updating contract amount (system + facility updates)
   */
  executeUpdateContractAmount(
    contractId: string,
    buyer: CompanyLike,
    newAmount: number
  ): boolean {
    const contract = this.getContract(contractId);
    if (!contract || contract.buyerId !== buyer.id) {
      return false;
    }

    // Update in system
    const result = this.updateContractAmount(contractId, newAmount);
    if (!result) return false;

    // Update buyer's facility
    const buyerFacility = buyer.facilities.find(f => f.id === contract.buyerFacilityId);
    if (buyerFacility) {
      buyerFacility.removeContract(contractId);
      buyerFacility.addContract(contractId, contract.resource, newAmount, contract.pricePerUnit, false);
    }

    return true;
  }

  /**
   * Orchestrate updating contract price (system + facility updates)
   */
  executeUpdateContractPrice(
    contractId: string,
    seller: CompanyLike,
    newPrice: number
  ): boolean {
    const contract = this.getContract(contractId);
    if (!contract || contract.sellerId !== seller.id) {
      return false;
    }

    // Update in system
    if (!this.updateContractPrice(contractId, newPrice)) {
      return false;
    }

    // Update seller's facility
    const sellerFacility = seller.facilities.find(f => f.id === contract.sellerFacilityId);
    if (sellerFacility) {
      sellerFacility.removeContract(contractId);
      sellerFacility.addContract(contractId, contract.resource, contract.amountPerTick, newPrice, true);
    }

    return true;
  }

  /**
   * Mark a contract as successful (clear failure status)
   */
  markContractSuccess(contractId: string): void {
    const contract = this.contracts.get(contractId);
    if (contract) {
      contract.lastFailedTick = null;
    }
  }

  // ========================================
  // INTERNAL TRANSFER METHODS
  // ========================================

  /**
   * Create an internal transfer between facilities
   * At least one facility must be a warehouse (storage facility)
   * Note: Caller must handle facility tracking (addInternalTransfer to facilities)
   */
  createInternalTransfer(
    ownerId: string,
    ownerName: string,
    fromFacilityId: string,
    fromFacilityName: string,
    toFacilityId: string,
    toFacilityName: string,
    resource: string,
    amountPerTick: number
  ): InternalTransfer {
    const transfer: InternalTransfer = {
      id: Math.random().toString(36).substring(7),
      ownerId,
      ownerName,
      fromFacilityId,
      fromFacilityName,
      toFacilityId,
      toFacilityName,
      resource,
      amountPerTick,
      createdAt: this.internalTransferCreationCounter++,
      lastFailedTick: null
    };

    this.internalTransfers.set(transfer.id, transfer);
    return transfer;
  }

  /**
   * Get a specific internal transfer
   */
  getInternalTransfer(transferId: string): InternalTransfer | undefined {
    return this.internalTransfers.get(transferId);
  }

  /**
   * Get all internal transfers
   */
  getAllInternalTransfers(): InternalTransfer[] {
    return Array.from(this.internalTransfers.values());
  }

  /**
   * Get internal transfers sorted by creation order (oldest first)
   */
  getInternalTransfersByCreationOrder(): InternalTransfer[] {
    return this.getAllInternalTransfers().sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Update internal transfer amount
   */
  updateInternalTransferAmount(transferId: string, newAmount: number): boolean {
    const transfer = this.internalTransfers.get(transferId);
    if (!transfer) {
      return false;
    }

    transfer.amountPerTick = newAmount;
    return true;
  }

  /**
   * Cancel an internal transfer
   * Returns the cancelled transfer (caller must handle facility cleanup)
   */
  cancelInternalTransfer(transferId: string): InternalTransfer | null {
    const transfer = this.internalTransfers.get(transferId);
    if (!transfer) {
      return null;
    }

    this.internalTransfers.delete(transferId);
    return transfer;
  }

  /**
   * Mark an internal transfer as failed for this tick
   */
  markInternalTransferFailed(transferId: string, currentTick: number): void {
    const transfer = this.internalTransfers.get(transferId);
    if (transfer) {
      transfer.lastFailedTick = currentTick;
    }
  }

  /**
   * Orchestrate creating an internal transfer (system + facility updates)
   */
  executeCreateInternalTransfer(
    owner: CompanyLike,
    fromFacility: FacilityBase,
    toFacility: FacilityBase,
    resource: string,
    amountPerTick: number
  ): InternalTransfer | null {
    // Verify ownership and facility types
    if (fromFacility.ownerId !== owner.id || toFacility.ownerId !== owner.id) return null;
    if (fromFacility.id === toFacility.id) return null;

    // Check warehouse requirement
    const fromIsWarehouse = fromFacility.type === 'warehouse';
    const toIsWarehouse = toFacility.type === 'warehouse';
    if (!fromIsWarehouse && !toIsWarehouse) return null;

    // Check inventory capability
    if (!(fromFacility instanceof ProductionFacility || fromFacility instanceof StorageFacility) ||
      !(toFacility instanceof ProductionFacility || toFacility instanceof StorageFacility)) {
      return null;
    }

    // Create in system
    const transfer = this.createInternalTransfer(
      owner.id,
      owner.name,
      fromFacility.id,
      fromFacility.name,
      toFacility.id,
      toFacility.name,
      resource,
      amountPerTick
    );

    // Update facilities
    fromFacility.addInternalTransfer(transfer.id, resource, amountPerTick, true);
    toFacility.addInternalTransfer(transfer.id, resource, amountPerTick, false);

    return transfer;
  }

  /**
   * Orchestrate canceling an internal transfer (system + facility updates)
   */
  executeCancelInternalTransfer(transferId: string, owner: CompanyLike): boolean {
    const transfer = this.getInternalTransfer(transferId);
    if (!transfer || transfer.ownerId !== owner.id) return false;

    // Remove from facilities
    const fromFacility = owner.facilities.find(f => f.id === transfer.fromFacilityId);
    const toFacility = owner.facilities.find(f => f.id === transfer.toFacilityId);

    if (fromFacility) fromFacility.removeInternalTransfer(transferId);
    if (toFacility) toFacility.removeInternalTransfer(transferId);

    // Remove from system
    return this.cancelInternalTransfer(transferId) !== null;
  }

  /**
   * Orchestrate updating an internal transfer amount (system + facility updates)
   */
  executeUpdateInternalTransferAmount(
    transferId: string,
    owner: CompanyLike,
    newAmount: number
  ): boolean {
    const transfer = this.getInternalTransfer(transferId);
    if (!transfer || transfer.ownerId !== owner.id) return false;

    // Update in system
    if (!this.updateInternalTransferAmount(transferId, newAmount)) return false;

    // Update facilities
    const fromFacility = owner.facilities.find(f => f.id === transfer.fromFacilityId);
    const toFacility = owner.facilities.find(f => f.id === transfer.toFacilityId);

    if (fromFacility) {
      fromFacility.removeInternalTransfer(transferId);
      fromFacility.addInternalTransfer(transferId, transfer.resource, newAmount, true);
    }
    if (toFacility) {
      toFacility.removeInternalTransfer(transferId);
      toFacility.addInternalTransfer(transferId, transfer.resource, newAmount, false);
    }

    return true;
  }

  /**
   * Mark an internal transfer as successful (clear failure status)
   */
  markInternalTransferSuccess(transferId: string): void {
    const transfer = this.internalTransfers.get(transferId);
    if (transfer) {
      transfer.lastFailedTick = null;
    }
  }

  /**
   * Orchestrate an instant resource transfer between two facilities
   * (Standard instant transfer within the same company)
   */
  executeInstantTransfer(
    owner: CompanyLike,
    fromFacility: FacilityBase,
    toFacility: FacilityBase,
    resource: string,
    amount: number
  ): boolean {
    // Verify ownership
    if (fromFacility.ownerId !== owner.id || toFacility.ownerId !== owner.id) {
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

  // ========================================
  // DISPLAY METHODS
  // ========================================

  /**
   * Get display lines for sell offers
   */
  getSellOfferDisplayLines(): string[] {
    const lines: string[] = [];
    const availableOffers = this.getAvailableSellOffers();

    if (availableOffers.length === 0) {
      lines.push('No sell offers available.');
    } else {
      // Group by resource
      const byResource = new Map<string, SellOffer[]>();
      availableOffers.forEach(offer => {
        if (!byResource.has(offer.resource)) {
          byResource.set(offer.resource, []);
        }
        byResource.get(offer.resource)!.push(offer);
      });

      // Display grouped offers
      byResource.forEach((resourceOffers, resource) => {
        lines.push(`\n${resource}:`);
        resourceOffers
          .sort((a, b) => a.pricePerUnit - b.pricePerUnit)
          .forEach(offer => {
            lines.push(
              `  [${offer.id}] Available: ${offer.amountAvailable}/tick | In Stock: ${offer.amountInStock}/tick @ $${offer.pricePerUnit.toFixed(2)}/unit (Seller: ${offer.sellerName})`
            );
          });
      });
    }

    return lines;
  }

  /**
   * Get display lines for active contracts
   */
  getContractDisplayLines(): string[] {
    const lines: string[] = [];

    if (this.contracts.size === 0) {
      lines.push('No active contracts.');
    } else {
      const sortedContracts = this.getContractsByCreationOrder();
      sortedContracts.forEach(contract => {
        const status = contract.lastFailedTick !== null ? ' [FAILED LAST TICK]' : '';
        lines.push(
          `  [${contract.id}] ${contract.resource}: ${contract.amountPerTick} units/tick @ $${contract.pricePerUnit.toFixed(2)}/unit = $${contract.totalPrice.toFixed(2)}/tick${status}`
        );
        lines.push(`    Seller: ${contract.sellerName} | Buyer: ${contract.buyerName}`);
      });
    }

    return lines;
  }

  /**
   * Get display lines for internal transfers
   */
  getInternalTransferDisplayLines(): string[] {
    const lines: string[] = [];

    if (this.internalTransfers.size === 0) {
      lines.push('No internal transfers.');
    } else {
      const sortedTransfers = this.getInternalTransfersByCreationOrder();
      sortedTransfers.forEach(transfer => {
        const status = transfer.lastFailedTick !== null ? ' [FAILED LAST TICK]' : '';
        lines.push(
          `  [${transfer.id}] ${transfer.resource}: ${transfer.amountPerTick} units/tick${status}`
        );
        lines.push(`    From: ${transfer.fromFacilityName} → To: ${transfer.toFacilityName} (${transfer.ownerName})`);
      });
    }

    return lines;
  }

  /**
   * Display complete contract system state
   */
  displayState(): string {
    const lines: string[] = ['\n=== Contract System ==='];

    // Display sell offers
    lines.push('\n--- Sell Offers ---');
    lines.push(...this.getSellOfferDisplayLines());

    // Display active contracts
    lines.push('\n--- Active Contracts ---');
    lines.push(...this.getContractDisplayLines());

    // Display internal transfers
    lines.push('\n--- Internal Transfers ---');
    lines.push(...this.getInternalTransferDisplayLines());

    return lines.join('\n');
  }
}
