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
     * Returns a formatted display string for this city
     */
    toString(): string {
        return `${this.name}, ${this.country} (Pop: ${this.population.toLocaleString()}, Wealth: ${this.wealth})`;
    }
}
