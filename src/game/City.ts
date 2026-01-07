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
     * STEP 3: Apply cross-resource substitution based on price deviations
     * STEP 4a: Calculate equal share allocation (for reference)
     * STEP 4b: Apply price sensitivity to adjust shares (avgPrice / price)^sensitivity
     * STEP 4c: First pass - each retailer fulfills their price-weighted share
     * STEP 4d: Second pass - redistribute unfulfilled demand among remaining retailers
     * 
     * @param retailers All retail facilities in this city
     */
    processRetailDemand(retailers: RetailFacility[]): void {
        if (retailers.length === 0) return;

        // STEP 1 & 2: Calculate base demand (consumption rate × population)
        const baseDemand = new Map<string, number>();
        const avgPrices = new Map<string, number>();
        
        for (const [resourceId, consumptionRate] of Object.entries(DEFAULT_CONSUMPTION_RATES)) {
            if (consumptionRate <= 0) continue;
            
            baseDemand.set(resourceId, this.population * consumptionRate);
            
            // Calculate average retail price for this resource
            const activeRetailers = retailers.filter(r => r.getPrice(resourceId) > 0);
            if (activeRetailers.length > 0) {
                const avgPrice = activeRetailers.reduce((sum, r) => sum + r.getPrice(resourceId), 0) / activeRetailers.length;
                avgPrices.set(resourceId, avgPrice);
            }
        }

        // STEP 3: Apply cross-resource substitution based on price deviations
        const adjustedDemand = new Map(baseDemand); // Start with base demand
        
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
                    const demandA = adjustedDemand.get(resA) || 0;
                    const shiftAmount = demandA * deviation * elasticity * 0.5; // 0.5 = dampening
                    
                    adjustedDemand.set(resA, Math.max(0, demandA - shiftAmount));
                    adjustedDemand.set(resB, (adjustedDemand.get(resB) || 0) + shiftAmount);
                } else {
                    // Resource B is expensive relative to A → shift demand from B to A
                    const demandB = adjustedDemand.get(resB) || 0;
                    const shiftAmount = demandB * deviation * elasticity * 0.5; // 0.5 = dampening
                    
                    adjustedDemand.set(resB, Math.max(0, demandB - shiftAmount));
                    adjustedDemand.set(resA, (adjustedDemand.get(resA) || 0) + shiftAmount);
                }
            }
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
            
            // Normalize shares to sum to 1
            const totalRawShares = rawShares.reduce((sum, val) => sum + val, 0);
            const normalizedShares = rawShares.map(share => share / totalRawShares);
            
            // Calculate demand per retailer
            const demandShares = normalizedShares.map(share => totalDemand * share);

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
