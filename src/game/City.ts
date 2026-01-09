import { DEFAULT_CONSUMPTION_RATES, INTER_RETAILER_SENSITIVITY, CROSS_LEVEL_ELASTICITY, RESOURCE_PRICE_RATIOS, ResourceLevel, ResourceRegistry } from './ResourceRegistry.js';
import type { RetailFacility } from './RetailFacility.js';

export class City {
    constructor(
        public readonly name: string,
        public readonly country: string,
        public readonly wealth: number, // 0-1 scale
        public readonly population: number
    ) {
        if (wealth < 0 || wealth > 1) {
            throw new Error(`Wealth must be between 0 and 1, got ${wealth}`);
        }
        if (population < 0) {
            throw new Error(`Population must be positive, got ${population}`);
        }
    }

    /**
     * Process retail demand for this city
     * 
     * STEP 1: Calculate base demand per resource (consumption rate per capita)
     * STEP 2: Multiply by city population to get total city demand
     * STEP 2.5: Apply wealth effect (wealthier cities consume 0.8x to 1.5x more)
     * STEP 3: Apply cross-resource substitution based on price deviations (BIDIRECTIONAL)
     *         - Tracks both demand losses (to substitutes) and gains (from other resources)
     *         - Net effect applied to maintain demand balance
     * STEP 3.5: Apply demand creation for below-average pricing
     *           - Retailers pricing below city average create additional demand
     *           - Dampened to minimum 5 retailers to prevent thin market exploitation
     *           - Only one retailer per company counted to prevent gaming
     * STEP 3.6: Apply demand shocks (5% chance per resource)
     *           - Randomly affects one retailer with ±15% demand shock
     *           - Demand loss/gain redistributed proportionally to other retailers
     * STEP 4a: Calculate equal share allocation (for reference)
     * STEP 4b: Apply price sensitivity to adjust shares (avgPrice / price)^sensitivity
     *         - Per-retailer randomness (±5%) applied to shares for natural variation
     * STEP 4c: First pass - each retailer fulfills their price-weighted share (with shocks applied)
     * STEP 4d: Second pass - redistribute unfulfilled demand among remaining retailers
     * 
     * @param retailers All retail facilities in this city
     */
    processRetailDemand(retailers: RetailFacility[]): void {
        if (retailers.length === 0) return;

        // STEP 1 & 2: Calculate base demand (consumption rate × population)
        // STEP 2.5: Apply wealth effect (0.8x to 1.5x multiplier based on city wealth)
        const wealthMultiplier = 0.8 + this.wealth * 0.7; // wealth is 0-1, gives 0.8-1.5 range
        const baseDemand = new Map<string, number>();
        const avgPrices = new Map<string, number>();
        
        for (const [resourceId, consumptionRate] of Object.entries(DEFAULT_CONSUMPTION_RATES)) {
            if (consumptionRate <= 0) continue;
            
            baseDemand.set(resourceId, this.population * consumptionRate * wealthMultiplier);
            
            // Calculate average retail price for this resource
            const activeRetailers = retailers.filter(r => r.getPrice(resourceId) > 0);
            if (activeRetailers.length > 0) {
                const avgPrice = activeRetailers.reduce((sum, r) => sum + r.getPrice(resourceId), 0) / activeRetailers.length;
                avgPrices.set(resourceId, avgPrice);
            }
        }

        // STEP 3: Apply cross-resource substitution based on price deviations (BIDIRECTIONAL)
        const adjustedDemand = new Map(baseDemand); // Start with base demand
        const substitutionGains = new Map<string, number>(); // Track gains from other resources
        const substitutionLosses = new Map<string, number>(); // Track losses to other resources
        
        const resources = Array.from(baseDemand.keys());
        for (let i = 0; i < resources.length; i++) {
            for (let j = i + 1; j < resources.length; j++) {
                const resA = resources[i];
                const resB = resources[j];
                
                const priceA = avgPrices.get(resA);
                const priceB = avgPrices.get(resB);
                
                // Skip if either resource has no price
                if (!priceA || !priceB) continue;
                
                // Get resource levels for elasticity lookup
                const levelA = ResourceRegistry.get(resA)?.level;
                const levelB = ResourceRegistry.get(resB)?.level;
                if (!levelA || !levelB) continue;
                
                // Get cross-level elasticity
                const elasticity = CROSS_LEVEL_ELASTICITY[levelA][levelB];
                if (elasticity <= 0) continue;
                
                // Get reference price ratios
                const ratioA = RESOURCE_PRICE_RATIOS[resA];
                const ratioB = RESOURCE_PRICE_RATIOS[resB];
                if (!ratioA || !ratioB) continue;
                
                // Calculate actual and expected price ratios
                const actualRatio = priceA / priceB;
                const referenceRatio = ratioA / ratioB;
                
                // Only substitute if deviation is significant (> 2%)
                const deviation = Math.abs((actualRatio / referenceRatio) - 1);
                if (deviation < 0.02) continue;
                
                // Determine which resource is relatively expensive
                if (actualRatio > referenceRatio) {
                    // Resource A is expensive relative to B → shift demand from A to B
                    const demandA = baseDemand.get(resA) || 0;
                    const shiftAmount = demandA * deviation * elasticity * 0.5; // 0.5 = dampening
                    
                    // Track bidirectional substitution
                    substitutionLosses.set(resA, (substitutionLosses.get(resA) || 0) + shiftAmount);
                    substitutionGains.set(resB, (substitutionGains.get(resB) || 0) + shiftAmount);
                } else {
                    // Resource B is expensive relative to A → shift demand from B to A
                    const demandB = baseDemand.get(resB) || 0;
                    const shiftAmount = demandB * deviation * elasticity * 0.5; // 0.5 = dampening
                    
                    // Track bidirectional substitution
                    substitutionLosses.set(resB, (substitutionLosses.get(resB) || 0) + shiftAmount);
                    substitutionGains.set(resA, (substitutionGains.get(resA) || 0) + shiftAmount);
                }
            }
        }
        
        // Apply net substitution effects
        for (const [resourceId, baseDemandValue] of baseDemand.entries()) {
            const loss = substitutionLosses.get(resourceId) || 0;
            const gain = substitutionGains.get(resourceId) || 0;
            adjustedDemand.set(resourceId, Math.max(0, baseDemandValue - loss + gain));
        }

        // STEP 3.5: Apply demand creation for below-average pricing
        // When retailers price below city average, additional demand is created
        for (const [resourceId, currentDemand] of adjustedDemand.entries()) {
            const avgPrice = avgPrices.get(resourceId);
            if (!avgPrice || avgPrice <= 0) continue;

            const activeRetailers = retailers.filter(r => r.getPrice(resourceId) > 0);
            if (activeRetailers.length === 0) continue;

            // Get unique companies to prevent gaming (only count one retailer per company)
            const uniqueCompanies = new Set(activeRetailers.map(r => r.ownerId));
            const uniqueRetailers = Array.from(uniqueCompanies).map(ownerId => 
                activeRetailers.find(r => r.ownerId === ownerId)!
            );

            // Calculate dampened average price (treat as if minimum 5 unique retailers)
            // This prevents excessive demand creation in thin markets
            const effectiveRetailerCount = Math.max(5, uniqueRetailers.length);
            
            // For dampening, blend actual prices with the average to simulate more retailers
            const actualPrices = uniqueRetailers.map(r => r.getPrice(resourceId));
            const dampenedPrices = [...actualPrices];
            
            // Add synthetic "average" retailers to reach minimum of 5
            const syntheticRetailersNeeded = Math.max(0, effectiveRetailerCount - uniqueRetailers.length);
            for (let i = 0; i < syntheticRetailersNeeded; i++) {
                dampenedPrices.push(avgPrice);
            }
            
            const dampenedAvgPrice = dampenedPrices.reduce((sum, p) => sum + p, 0) / dampenedPrices.length;

            // Calculate demand creation for each retailer below dampened average
            let totalCreatedDemand = 0;
            for (const retailer of uniqueRetailers) {
                const price = retailer.getPrice(resourceId);
                
                // Only create demand if price is below dampened average
                if (price >= dampenedAvgPrice) continue;

                const priceRatio = price / dampenedAvgPrice;
                const sensitivity = INTER_RETAILER_SENSITIVITY[resourceId] || 1.0;

                // Use power function similar to calculateDemandCreationFactor
                // More aggressive than just redistribution, but still bounded
                const creationFactor = Math.pow(1 / priceRatio, sensitivity * 0.8);
                
                // Created demand is a fraction of base demand, capped to prevent extreme values
                const maxCreationMultiplier = Math.min(creationFactor - 1, 0.5); // Cap at 50% additional demand
                const createdDemand = currentDemand * maxCreationMultiplier * 0.3; // 0.3 = dampening factor
                
                totalCreatedDemand += createdDemand;
            }

            // Add created demand to adjusted demand
            if (totalCreatedDemand > 0) {
                adjustedDemand.set(resourceId, currentDemand + totalCreatedDemand);
            }
        }
        
        // STEP 3.6: Apply demand shocks (5% chance per resource)
        // Affects one random retailer, redistributes demand loss to others
        const demandShockAdjustments = new Map<string, Map<string, number>>(); // resourceId -> Map<retailerId, adjustment>
        
        for (const [resourceId] of adjustedDemand.entries()) {
            // 5% chance of demand shock for this resource
            if (Math.random() >= 0.05) continue;
            
            const activeRetailers = retailers.filter(r => r.getPrice(resourceId) > 0);
            if (activeRetailers.length <= 1) continue; // Need at least 2 retailers for redistribution
            
            // Pick one random retailer to be shocked
            const shockedRetailer = activeRetailers[Math.floor(Math.random() * activeRetailers.length)];
            
            // Apply ±15% shock
            const shockMultiplier = Math.random() < 0.5 ? 0.85 : 1.15;
            
            // Store shock adjustments for later application in distribution
            if (!demandShockAdjustments.has(resourceId)) {
                demandShockAdjustments.set(resourceId, new Map());
            }
            demandShockAdjustments.get(resourceId)!.set(shockedRetailer.id, shockMultiplier);
        }

        // STEP 4: Distribute adjusted demand among retailers
        for (const [resourceId, totalDemand] of adjustedDemand.entries()) {
            if (totalDemand <= 0) continue;

            // Filter retailers that have this resource priced
            const activeRetailers = retailers.filter(r => r.getPrice(resourceId) > 0);
            if (activeRetailers.length === 0) continue;

            // STEP 4a: Equal share would be totalDemand / activeRetailers.length
            // STEP 4b: Price-weighted distribution based on inter-retailer sensitivity
            const sensitivity = INTER_RETAILER_SENSITIVITY[resourceId] || 1.0;
            
            // Calculate average price across all retailers
            const avgPrice = activeRetailers.reduce((sum, r) => sum + r.getPrice(resourceId), 0) / activeRetailers.length;
            
            // Calculate price-weighted shares: (avgPrice / retailPrice)^sensitivity
            const rawShares = activeRetailers.map(r => {
                const price = r.getPrice(resourceId);
                return Math.pow(avgPrice / price, sensitivity);
            });
            
            // Apply per-retailer randomness (±5%) to raw shares
            const randomizedShares = rawShares.map(share => {
                const randomFactor = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
                return share * randomFactor;
            });
            
            // Normalize shares to sum to 1
            const totalRandomizedShares = randomizedShares.reduce((sum, val) => sum + val, 0);
            const normalizedShares = randomizedShares.map(share => share / totalRandomizedShares);
            
            // Calculate demand per retailer
            let demandShares = normalizedShares.map(share => totalDemand * share);
            
            // Apply demand shocks if any exist for this resource
            const shockAdjustments = demandShockAdjustments.get(resourceId);
            if (shockAdjustments && shockAdjustments.size > 0) {
                // Find the shocked retailer index
                const shockedRetailerId = Array.from(shockAdjustments.keys())[0];
                const shockMultiplier = shockAdjustments.get(shockedRetailerId)!;
                const shockedIndex = activeRetailers.findIndex(r => r.id === shockedRetailerId);
                
                if (shockedIndex !== -1) {
                    const originalDemand = demandShares[shockedIndex];
                    const shockedDemand = originalDemand * shockMultiplier;
                    const demandDifference = originalDemand - shockedDemand;
                    
                    // Apply shock to the shocked retailer
                    demandShares[shockedIndex] = shockedDemand;
                    
                    // Redistribute the difference to other retailers proportionally
                    if (demandDifference !== 0) {
                        const otherRetailersCount = activeRetailers.length - 1;
                        if (otherRetailersCount > 0) {
                            // Calculate total share of non-shocked retailers
                            let totalOtherShares = 0;
                            for (let i = 0; i < demandShares.length; i++) {
                                if (i !== shockedIndex) {
                                    totalOtherShares += normalizedShares[i];
                                }
                            }
                            
                            // Redistribute proportionally
                            for (let i = 0; i < demandShares.length; i++) {
                                if (i !== shockedIndex) {
                                    const redistributionShare = normalizedShares[i] / totalOtherShares;
                                    demandShares[i] += demandDifference * redistributionShare;
                                }
                            }
                        }
                    }
                }
            }

            // STEP 4c: First pass - each retailer tries to fulfill their share
            const unfulfilled: number[] = [];
            for (let i = 0; i < activeRetailers.length; i++) {
                const retailer = activeRetailers[i];
                const available = retailer.getResource(resourceId);
                const demandShare = demandShares[i];
                const sold = Math.min(demandShare, available);
                
                retailer.executeSale(resourceId, sold);
                unfulfilled.push(demandShare - sold);
            }

            // STEP 4d: Second pass - redistribute unfulfilled demand
            const totalUnfulfilled = unfulfilled.reduce((sum, val) => sum + val, 0);
            if (totalUnfulfilled > 0) {
                const retailersWithInventory = activeRetailers.filter(r => r.getResource(resourceId) > 0);
                
                if (retailersWithInventory.length > 0) {
                    const redistributionShare = totalUnfulfilled / retailersWithInventory.length;
                    
                    for (const retailer of retailersWithInventory) {
                        const available = retailer.getResource(resourceId);
                        const sold = Math.min(redistributionShare, available);
                        retailer.executeSale(resourceId, sold);
                    }
                }
            }
        }
    }

    /**
     * Get demand and sales report for this city
     * @param retailers All retail facilities in this city
     * @returns Report containing base demand, total sales, and per-retailer breakdown
     */
    getDemandSalesReport(retailers: RetailFacility[]): {
        city: string;
        population: number;
        resources: Map<string, {
            baseDemand: number;
            consumptionRate: number;
            totalSales: number;
            fulfillmentRate: number;
            retailers: Array<{
                facilityId: string;
                facilityName: string;
                ownerId: string;
                price: number;
                sales: number;
                revenue: number;
                currentStock: number;
                marketShare: number;
            }>;
        }>;
    } {
        const resourcesReport = new Map();
        
        // Get all resources being sold in this city
        const resourcesInCity = new Set<string>();
        for (const retailer of retailers) {
            for (const [resourceId] of retailer.prices.entries()) {
                if (retailer.getPrice(resourceId) > 0) {
                    resourcesInCity.add(resourceId);
                }
            }
        }
        
        // Build report for each resource
        for (const resourceId of resourcesInCity) {
            const consumptionRate = DEFAULT_CONSUMPTION_RATES[resourceId] || 0;
            const baseDemand = this.population * consumptionRate;
            
            let totalSales = 0;
            const retailerData: Array<{
                facilityId: string;
                facilityName: string;
                ownerId: string;
                price: number;
                sales: number;
                revenue: number;
                currentStock: number;
                marketShare: number;
            }> = [];
            
            // Collect data from each retailer
            for (const retailer of retailers) {
                const price = retailer.getPrice(resourceId);
                if (price === 0) continue;
                
                const sales = retailer.getSoldAmount(resourceId);
                const revenue = sales * price;
                const currentStock = retailer.getResource(resourceId);
                
                totalSales += sales;
                retailerData.push({
                    facilityId: retailer.id,
                    facilityName: retailer.name,
                    ownerId: retailer.ownerId,
                    price,
                    sales,
                    revenue,
                    currentStock,
                    marketShare: 0 // Will be calculated after totalSales is known
                });
            }
            
            // Calculate market shares
            for (const data of retailerData) {
                data.marketShare = totalSales > 0 ? (data.sales / totalSales) : 0;
            }
            
            // Sort by sales (descending)
            retailerData.sort((a, b) => b.sales - a.sales);
            
            const fulfillmentRate = baseDemand > 0 ? (totalSales / baseDemand) : 0;
            
            resourcesReport.set(resourceId, {
                baseDemand,
                consumptionRate,
                totalSales,
                fulfillmentRate,
                retailers: retailerData
            });
        }
        
        return {
            city: this.name,
            population: this.population,
            resources: resourcesReport
        };
    }

    /**
     * Returns a formatted display string for this city
     */
    toString(): string {
        return `${this.name}, ${this.country} (Pop: ${this.population.toLocaleString()}, Wealth: ${this.wealth})`;
    }
}
