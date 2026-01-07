/**
 * Definition of a resource type
 */
export enum ResourceLevel {
  RAW = 'raw',           // grain, grapes - farm output
  INTERMEDIATE = 'intermediate',  // flour, sugar - processed once
  FINISHED = 'finished'   // bread, wine, cake - consumer ready
}

export interface ResourceDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: ResourceLevel;  // NEW
  weight: number;
  // Remove: basePrice
}

/**
 * Default consumption rates per population unit per tick
 * Defines how much of each resource one population unit consumes
 * Rule: Finished goods > Intermediate products > Raw materials
 */
export const DEFAULT_CONSUMPTION_RATES: Record<string, number> = {
  grain: 0.001,   // Raw material - rarely consumed directly
  flour: 0.003,   // Intermediate - sometimes used directly
  bread: 0.010,   // Finished consumer good - primary consumption
  grapes: 0.0005, // Raw material - rarely consumed directly
  wine: 0.008,    // Finished consumer good - luxury beverage
  sugar: 0.002,   // Intermediate - sometimes used directly
  cake: 0.005     // Finished consumer good - luxury baked good
};

/**
 * Reference price ratios for resources - used for relative price comparison
 * These are NOT actual consumer prices, but baseline ratios for price elasticity calculations
 * Used to determine "normal" price relationships between resources for substitution
 * 
 * Calculation basis (base wage = 1):
 * - Grain: (0 inputs + 1 wage × 2 ticks × 3 workers) / 10 output = 6/10 = 0.6 → Index: 60
 * - Flour: (2 grain × 0.6 + 1 wage × 1 tick × 3.5 workers) / 10 output = 4.7/10 = 0.47 → Index: 47
 * - Bread: (20 flour × 0.47 + 1 wage × 1 tick × 3.5 workers) / 1 output = 12.9/1 = 12.9 → Index: 129
 * - Grapes: (0 inputs + 1 wage × 2 ticks × 3 workers) / 8 output = 6/8 = 0.75 → Index: 75
 * - Wine: (5 grapes × 0.75 + 1 wage × 2 ticks × 3 workers) / 1 output = 9.75/1 = 9.75 → Index: 98
 * - Sugar: (0 inputs + 1 wage × 2 ticks × 3 workers) / 12 output = 6/12 = 0.5 → Index: 50
 * - Cake: (10 flour × 0.47 + 5 sugar × 0.5 + 1 wage × 2 ticks × 3.5 workers) / 1 output = 14.2/1 = 14.2 → Index: 142
 */
export const RESOURCE_PRICE_RATIOS: Record<string, number> = {
  grain: 60,
  flour: 47,
  bread: 129,
  grapes: 75,
  wine: 98,
  sugar: 50,
  cake: 142
};

/**
 * Cross-level substitution elasticity matrix
 * Controls how readily consumers substitute between resources of different processing levels
 * 
 * Same level (raw↔raw): High elasticity - consumers easily switch grain for grapes
 * Adjacent levels (raw↔intermediate): Low elasticity - harder to substitute grain for flour
 * Distant levels (raw↔finished): Very low - rarely substitute grain for bread directly
 * 
 * Formula: demandShift = deviation × baseDemand × elasticity × 0.5 (dampening)
 * Where deviation = (actualPriceRatio / referencePriceRatio) - 1
 */
export const CROSS_LEVEL_ELASTICITY: Record<ResourceLevel, Record<ResourceLevel, number>> = {
  [ResourceLevel.RAW]: {
    [ResourceLevel.RAW]: 0.7,           // High: grain ↔ grapes ↔ sugar
    [ResourceLevel.INTERMEDIATE]: 0.2,  // Low: grain → flour
    [ResourceLevel.FINISHED]: 0.1       // Very low: grain → bread
  },
  [ResourceLevel.INTERMEDIATE]: {
    [ResourceLevel.RAW]: 0.2,           // Low: flour → grain
    [ResourceLevel.INTERMEDIATE]: 0.6,  // High: flour ↔ sugar (both intermediate)
    [ResourceLevel.FINISHED]: 0.3       // Medium: flour → bread
  },
  [ResourceLevel.FINISHED]: {
    [ResourceLevel.RAW]: 0.1,           // Very low: bread → grain
    [ResourceLevel.INTERMEDIATE]: 0.3,  // Medium: bread → flour
    [ResourceLevel.FINISHED]: 0.5       // Medium-high: bread ↔ wine ↔ cake
  }
};

/**
 * Inter-retailer price sensitivity coefficients
 * Controls how aggressively consumers shift between retailers based on price differences
 * 
 * High sensitivity (>1.5): Consumers actively compare prices, large shifts with small price differences
 * Medium sensitivity (0.8-1.2): Some price comparison, moderate shifts
 * Low sensitivity (<0.5): Convenience/location dominates, minor price differences mostly ignored
 * 
 * Formula: demand_share[retailer] = (avgPrice / retailer_price)^sensitivity
 * 
 * Examples:
 * - Bread (0.3): Staple food, convenience matters - 20% price difference → ~6% demand shift
 * - Wine (1.8): Luxury beverage, high comparison shopping - 20% price difference → ~33% demand shift
 * - Flour (0.5): Intermediate good - 20% price difference → ~10% demand shift
 */
export const INTER_RETAILER_SENSITIVITY: Record<string, number> = {
  grain: 0.4,   // Raw material - some price comparison
  flour: 0.5,   // Intermediate - moderate comparison
  bread: 0.3,   // Staple - convenience dominates
  grapes: 0.4,  // Raw material - some price comparison  
  wine: 1.8,    // Luxury - high price comparison
  sugar: 0.4,   // Intermediate - some price comparison
  cake: 1.2     // Luxury dessert - moderate-high comparison
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
      weight: 1.0,
      level: ResourceLevel.RAW
    });

    this.register({
      id: 'grapes',
      name: 'Grapes',
      description: 'Fresh grapes for wine production',
      icon: '🍇',
      weight: 0.9,
      level: ResourceLevel.RAW
    });

    this.register({
      id: 'sugar',
      name: 'Sugar',
      description: 'Sweet crystals refined from crops',
      icon: '🍬',
      weight: 0.7,
      level: ResourceLevel.RAW
    });

    // Processed goods
    this.register({
      id: 'flour',
      name: 'Flour',
      description: 'Ground grain ready for baking',
      icon: '🥛',
      weight: 0.8,
      level: ResourceLevel.INTERMEDIATE
    });

    // Finished products
    this.register({
      id: 'bread',
      name: 'Bread',
      description: 'Freshly baked bread',
      icon: '🍞',
      weight: 1.5,
      level: ResourceLevel.FINISHED
    });

    this.register({
      id: 'wine',
      name: 'Wine',
      description: 'Fine wine made from grapes',
      icon: '🍷',
      weight: 1.2,
      level: ResourceLevel.FINISHED
    });

    this.register({
      id: 'cake',
      name: 'Cake',
      description: 'Delicious sweet cake',
      icon: '🍰',
      weight: 1.3,
      level: ResourceLevel.FINISHED
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
      lines.push(`  ${resource.icon} ${resource.name} - ${resource.description} (Weight: ${resource.weight})`);
    });

    return lines.join('\n');
  }
}
