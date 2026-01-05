import { DEFAULT_CONSUMPTION_RATES } from './ResourceRegistry.js';
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
     * Calculates demand for each resource and distributes sales among retailers
     * @param retailers All retail facilities in this city
     */
    processRetailDemand(retailers: RetailFacility[]): void {
        if (retailers.length === 0) return;

        // Process each resource that has consumer demand
        for (const [resourceId, consumptionRate] of Object.entries(DEFAULT_CONSUMPTION_RATES)) {
            if (consumptionRate <= 0) continue;

            // Calculate total demand for this resource in this city
            const totalDemand = this.population * consumptionRate;

            // Filter retailers that have this resource priced
            const activeRetailers = retailers.filter(r => r.getPrice(resourceId) > 0);
            if (activeRetailers.length === 0) continue;

            // Equal share distribution
            const demandShare = totalDemand / activeRetailers.length;

            // First pass: each retailer tries to fulfill their share
            const unfulfilled: number[] = [];
            for (let i = 0; i < activeRetailers.length; i++) {
                const retailer = activeRetailers[i];
                const available = retailer.getResource(resourceId);
                const sold = Math.min(demandShare, available);
                
                retailer.executeSale(resourceId, sold);
                unfulfilled.push(demandShare - sold);
            }

            // Second pass: redistribute unfulfilled demand to retailers with remaining inventory
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
     * Returns a formatted display string for this city
     */
    toString(): string {
        return `${this.name}, ${this.country} (Pop: ${this.population.toLocaleString()}, Wealth: ${this.wealth})`;
    }
}
