/**
 * Definition of a resource type
 */
export interface ResourceDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji
  basePrice: number; // Suggested market price
  weight: number; // Weight per unit (affects inventory capacity)
}

/**
 * Default consumption rates per population unit per tick
 * Defines how much of each resource one population unit consumes
 * Rule: Finished goods > Intermediate products > Raw materials
 */
export const DEFAULT_CONSUMPTION_RATES: Record<string, number> = {
  grain: 0.01,   // Raw material - rarely consumed directly
  flour: 0.03,   // Intermediate - sometimes used directly
  bread: 0.10    // Finished consumer good - primary consumption
};

/**
 * Reference price ratios for resources - used for relative price comparison
 * These are NOT actual consumer prices, but baseline ratios for price elasticity calculations
 * 
 * Calculation basis (base wage = 1):
 * - Grain: (0 inputs + 1 wage × 2 ticks × 3 workers) / 10 output = 6/10 = 0.6 → Index: 60
 * - Flour: (2 grain × 0.6 + 1 wage × 1 tick × 3.5 workers) / 10 output = 4.7/10 = 0.47 → Index: 47
 * - Bread: (20 flour × 0.47 + 1 wage × 1 tick × 3.5 workers) / 1 output = 12.9/1 = 12.9 → Index: 129
 */
export const RESOURCE_PRICE_RATIOS: Record<string, number> = {
  grain: 60,
  flour: 47,
  bread: 129
};

/**
 * Registry of all available resources in the game
 */
export class ResourceRegistry {
  private static resources: Map<string, ResourceDefinition> = new Map();

  static {
    // Raw materials
    this.register({
      id: 'grain',
      name: 'Grain',
      description: 'Raw crop harvested from farms',
      icon: '🌾',
      basePrice: 2.50,
      weight: 1.0
    });

    // Processed goods
    this.register({
      id: 'flour',
      name: 'Flour',
      description: 'Ground grain ready for baking',
      icon: '🥛',
      basePrice: 5.00,
      weight: 0.8
    });

    // Finished products
    this.register({
      id: 'bread',
      name: 'Bread',
      description: 'Freshly baked bread',
      icon: '🍞',
      basePrice: 10.00,
      weight: 1.5
    });
  }

  /**
   * Register a resource definition
   */
  private static register(definition: ResourceDefinition): void {
    this.resources.set(definition.id, definition);
  }

  /**
   * Get a resource definition by ID
   */
  static get(id: string): ResourceDefinition | undefined {
    return this.resources.get(id.toLowerCase());
  }

  /**
   * Get all resource definitions
   */
  static getAll(): ResourceDefinition[] {
    return Array.from(this.resources.values());
  }

  /**
   * Display all resources
   */
  static displayResources(): string {
    const lines: string[] = ['\n=== Available Resources ==='];
    
    this.resources.forEach(resource => {
      lines.push(`  ${resource.icon} ${resource.name} - ${resource.description} (Base price: $${resource.basePrice.toFixed(2)}, Weight: ${resource.weight})`);
    });

    return lines.join('\n');
  }
}
