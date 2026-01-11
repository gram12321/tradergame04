import { FacilityBase } from './FacilityBase.ts';

export interface CompanyLike {
  id: string;
  name: string;
  facilities: FacilityBase[];
}

export interface SellOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerFacilityId: string;
  sellerFacilityName: string;
  resource: string;
  amountAvailable: number;
  amountInStock: number;
  pricePerUnit: number;
}

export interface TradeRoute {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerFacilityId: string;
  sellerFacilityName: string;
  buyerId: string;
  buyerName: string;
  buyerFacilityId: string;
  buyerFacilityName: string;
  resource: string;
  amountPerTick: number;
  pricePerUnit: number;
  totalPrice: number;
  createdAt: number;
  lastFailedTick: number | null;
  isInternal: boolean;
  sellOfferId?: string;
}

export class ContractSystem {
  private sellOffers = new Map<string, SellOffer>();
  private tradeRoutes = new Map<string, TradeRoute>();
  private creationCounter = 0;

  constructor() { }

  // --- Sell Offers ---
  addSellOffer(sellerId: string, sellerName: string, sellerFacilityId: string, sellerFacilityName: string, resource: string, amount: number, price: number): SellOffer {
    const offer: SellOffer = { id: Math.random().toString(36).substring(7), sellerId, sellerName, sellerFacilityId, sellerFacilityName, resource, amountAvailable: amount, amountInStock: amount, pricePerUnit: price };
    this.sellOffers.set(offer.id, offer);
    this.recalculateSellOfferInStock(offer.id);
    return offer;
  }

  removeSellOffer(id: string) { return this.sellOffers.delete(id); }

  private recalculateSellOfferInStock(offerId: string) {
    const offer = this.sellOffers.get(offerId);
    if (!offer) return;
    const contracted = Array.from(this.tradeRoutes.values()).filter(r => r.sellOfferId === offerId).reduce((sum, r) => sum + r.amountPerTick, 0);
    offer.amountInStock = Math.max(0, offer.amountAvailable - contracted);
  }

  getSellOffer(id: string) { return this.sellOffers.get(id); }
  getAllSellOffers() { return Array.from(this.sellOffers.values()); }
  getAvailableSellOffers() { return this.getAllSellOffers().filter(o => o.amountInStock > 0); }

  updateSellOfferAmount(id: string, newAmount: number) {
    const offer = this.sellOffers.get(id);
    if (!offer) return false;
    offer.amountAvailable = newAmount;
    this.recalculateSellOfferInStock(id);
    return true;
  }

  updateSellOffer(id: string, price?: number, amount?: number) {
    const offer = this.sellOffers.get(id);
    if (!offer) return false;
    if (price !== undefined) offer.pricePerUnit = price;
    if (amount !== undefined) offer.amountAvailable = amount;
    this.recalculateSellOfferInStock(id);
    return true;
  }

  // Orchestration
  executeCreateSellOffer(seller: CompanyLike, facility: FacilityBase, resource: string, amount: number, price: number): SellOffer | null {
    if (amount <= 0 || price <= 0 || facility.ownerId !== seller.id) return null;
    return this.addSellOffer(seller.id, seller.name, facility.id, facility.name, resource, amount, price);
  }
  executeCancelSellOffer(seller: CompanyLike, id: string) {
    const o = this.getSellOffer(id);
    return (o && o.sellerId === seller.id) ? this.removeSellOffer(id) : false;
  }
  executeUpdateSellOffer(seller: CompanyLike, id: string, price?: number, amount?: number) {
    const o = this.getSellOffer(id);
    return (o && o.sellerId === seller.id) ? this.updateSellOffer(id, price, amount) : false;
  }

  // --- Trade Routes (Contracts & Transfers) ---
  getTradeRoute(id: string) { return this.tradeRoutes.get(id); }
  getAllTradeRoutes() { return Array.from(this.tradeRoutes.values()); }
  getTradeRoutesByCreationOrder() { return this.getAllTradeRoutes().sort((a, b) => a.createdAt - b.createdAt); }

  cancelTradeRoute(id: string) {
    const route = this.tradeRoutes.get(id);
    if (!route) return null;
    this.tradeRoutes.delete(id);
    if (route.sellOfferId) this.recalculateSellOfferInStock(route.sellOfferId);
    return route;
  }

  markRouteStatus(id: string, tick: number | null) {
    const r = this.tradeRoutes.get(id);
    if (r) r.lastFailedTick = tick;
  }

  // Orchestration Methods
  executeAcceptSellOffer(buyer: CompanyLike, seller: CompanyLike, offerId: string, facility: FacilityBase, amount: number): TradeRoute | null {
    const offer = this.getSellOffer(offerId);
    if (!offer || offer.sellerId === buyer.id || facility.ownerId !== buyer.id || offer.amountInStock < amount) return null;
    const sellerFacility = seller.facilities.find(f => f.id === offer.sellerFacilityId);
    if (!sellerFacility) return null;

    const route: TradeRoute = {
      id: Math.random().toString(36).substring(7),
      sellOfferId: offer.id, sellerId: offer.sellerId, sellerName: offer.sellerName, sellerFacilityId: offer.sellerFacilityId, sellerFacilityName: sellerFacility.name,
      buyerId: buyer.id, buyerName: buyer.name, buyerFacilityId: facility.id, buyerFacilityName: facility.name,
      resource: offer.resource, amountPerTick: amount, pricePerUnit: offer.pricePerUnit, totalPrice: amount * offer.pricePerUnit,
      createdAt: this.creationCounter++, lastFailedTick: null, isInternal: false
    };

    this.tradeRoutes.set(route.id, route);
    this.recalculateSellOfferInStock(offer.id);
    sellerFacility.addTradeRoute(route.id, route.resource, route.amountPerTick, route.pricePerUnit, true, false);
    facility.addTradeRoute(route.id, route.resource, route.amountPerTick, route.pricePerUnit, false, false);
    return route;
  }

  executeCancelTradeRoute(id: string, acting: CompanyLike, other: CompanyLike | null): boolean {
    const r = this.tradeRoutes.get(id);
    if (!r || (r.buyerId !== acting.id && r.sellerId !== acting.id)) return false;
    [acting, other].forEach(c => {
      c?.facilities.find(f => f.id === r.buyerFacilityId || f.id === r.sellerFacilityId)?.removeTradeRoute(id);
    });
    return !!this.cancelTradeRoute(id);
  }

  executeUpdateTradeRouteAmount(id: string, buyer: CompanyLike, amount: number): boolean {
    const r = this.tradeRoutes.get(id);
    if (!r || r.buyerId !== buyer.id) return false;
    const offer = r.sellOfferId ? this.sellOffers.get(r.sellOfferId) : null;
    if (offer && offer.amountInStock < (amount - r.amountPerTick)) return false;

    r.amountPerTick = amount;
    r.totalPrice = amount * r.pricePerUnit;
    if (r.sellOfferId) this.recalculateSellOfferInStock(r.sellOfferId);
    buyer.facilities.find(f => f.id === r.buyerFacilityId)?.addTradeRoute(id, r.resource, r.amountPerTick, r.pricePerUnit, false, r.isInternal);
    return true;
  }

  executeUpdateTradeRoutePrice(id: string, seller: CompanyLike, price: number): boolean {
    const r = this.tradeRoutes.get(id);
    if (!r || r.sellerId !== seller.id) return false;
    r.pricePerUnit = price;
    r.totalPrice = r.amountPerTick * price;
    seller.facilities.find(f => f.id === r.sellerFacilityId)?.addTradeRoute(id, r.resource, r.amountPerTick, r.pricePerUnit, true, r.isInternal);
    return true;
  }

  executeCreateInternalTransfer(owner: CompanyLike, from: FacilityBase, to: FacilityBase, resource: string, amount: number): TradeRoute | null {
    if (from.ownerId !== owner.id || to.ownerId !== owner.id || from.id === to.id) return null;
    if (![from, to].some(f => f.type === 'warehouse')) return null;

    const route: TradeRoute = {
      id: Math.random().toString(36).substring(7),
      sellerId: owner.id, sellerName: owner.name, sellerFacilityId: from.id, sellerFacilityName: from.name,
      buyerId: owner.id, buyerName: owner.name, buyerFacilityId: to.id, buyerFacilityName: to.name,
      resource, amountPerTick: amount, pricePerUnit: 0, totalPrice: 0,
      createdAt: this.creationCounter++, lastFailedTick: null, isInternal: true
    };

    this.tradeRoutes.set(route.id, route);
    from.addTradeRoute(route.id, resource, amount, 0, true, true);
    to.addTradeRoute(route.id, resource, amount, 0, false, true);
    return route;
  }

  executeInstantTransfer(owner: CompanyLike, from: FacilityBase, to: FacilityBase, resource: string, amount: number): boolean {
    if (from.ownerId !== owner.id || to.ownerId !== owner.id || from.getResource(resource) < amount) return false;
    if (from.removeResource(resource, amount)) {
      to.addResource(resource, amount);
      return true;
    }
    return false;
  }

  // --- Display Helpers ---
  getSellOfferDisplayLines(): string[] {
    const lines: string[] = [];
    const available = this.getAvailableSellOffers();
    if (available.length === 0) return ['No sell offers available.'];

    const byResource = new Map<string, SellOffer[]>();
    available.forEach(o => { (byResource.get(o.resource) || byResource.set(o.resource, []).get(o.resource)!).push(o); });

    byResource.forEach((offers, res) => {
      lines.push(`\n${res}:`);
      offers.sort((a, b) => a.pricePerUnit - b.pricePerUnit).forEach(o => {
        lines.push(`  [${o.id}] Available: ${o.amountAvailable}/tick | In Stock: ${o.amountInStock}/tick @ $${o.pricePerUnit.toFixed(2)}/unit (Seller: ${o.sellerName})`);
      });
    });
    return lines;
  }

  getTradeRouteDisplayLines(): string[] {
    const lines: string[] = [];
    const active = this.getAllTradeRoutes();
    if (active.length === 0) return ['No active trade routes.'];

    active.forEach(r => {
      lines.push(`[${r.id}] ${r.buyerName} ${r.isInternal ? 'transferring' : 'buying'} ${r.amountPerTick}/tick ${r.resource} ${r.isInternal ? 'from' : 'from'} ${r.sellerName} @ $${r.pricePerUnit.toFixed(2)} [${r.lastFailedTick ? 'FAILED' : 'OK'}]`);
    });
    return lines;
  }

  // Database Persistence
  async save(): Promise<{ success: boolean; error?: string }> {
    try {
      const { TradeRouteRepository } = await import('../database/TradeRouteRepository.js');
      const offerResult = await TradeRouteRepository.saveSellOffers(this.getAllSellOffers());
      if (!offerResult.success) return offerResult;
      return await TradeRouteRepository.saveTradeRoutes(this.getAllTradeRoutes());
    } catch (err: any) {
      console.error('ContractSystem save failed:', err);
      return { success: false, error: err.message };
    }
  }

  async load(companies: Map<string, CompanyLike>): Promise<{ success: boolean; error?: string }> {
    try {
      const { TradeRouteRepository } = await import('../database/TradeRouteRepository.js');

      // Load Sell Offers
      const offers = await TradeRouteRepository.loadSellOffers();
      this.sellOffers.clear();
      offers.forEach(o => this.sellOffers.set(o.id, o));

      // Load Trade Routes
      const routes = await TradeRouteRepository.loadTradeRoutes();
      this.tradeRoutes.clear();
      this.creationCounter = 0;

      routes.forEach(r => {
        this.tradeRoutes.set(r.id, r);
        if (r.createdAt >= this.creationCounter) this.creationCounter = r.createdAt + 1;

        // Restore facility tracking
        const seller = companies.get(r.sellerId);
        const buyer = companies.get(r.buyerId);

        const sellerFac = seller?.facilities.find(f => f.id === r.sellerFacilityId);
        const buyerFac = buyer?.facilities.find(f => f.id === r.buyerFacilityId);

        if (sellerFac) {
          sellerFac.addTradeRoute(r.id, r.resource, r.amountPerTick, r.pricePerUnit, true, r.isInternal);
        }
        if (buyerFac) {
          buyerFac.addTradeRoute(r.id, r.resource, r.amountPerTick, r.pricePerUnit, false, r.isInternal);
        }
      });

      // Recalculate in-stock for all offers after loading routes
      this.sellOffers.forEach((_, id) => this.recalculateSellOfferInStock(id));

      return { success: true };
    } catch (err: any) {
      console.error('ContractSystem load failed:', err);
      return { success: false, error: err.message };
    }
  }
}
