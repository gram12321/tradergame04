import { Recipe } from './Recipe.js';

/**
 * Category of facility
 */
export type FacilityCategory = 'production' | 'storage' | 'office' | 'retail';

/**
 * Definition of a facility type
 */
export interface FacilityDefinition {
  type: string;
  name: string;
  category: FacilityCategory; // Type of facility (production/storage/office)
  cost: number;
  workerMultiplier: number; // Worker multiplier (warehouse = 1.0 baseline)
  capacityMultiplier: number; // Inventory capacity multiplier (warehouse = 10x baseline)
  allowedRecipes: string[]; // Recipe names that can be assigned to this facility
  defaultRecipe: string | null; // Default recipe assigned when facility is built
  description: string;
}

/**
 * Registry of all available facility types in the game
 */
export class FacilityRegistry {
  private static facilities: Map<string, FacilityDefinition> = new Map();

  static {
    // Farm - produces raw materials
    this.register({
      type: 'farm',
      name: 'Farm',
      category: 'production',
      cost: 1000,
      workerMultiplier: 3.0,
      capacityMultiplier: 1.0, // Base capacity
      allowedRecipes: ['Grow Grain', 'Grow Grapes'],
      defaultRecipe: 'Grow Grain',
      description: 'Produces grain from the land'
    });

    // Mill - processes grain into flour
    this.register({
      type: 'mill',
      name: 'Mill',
      category: 'production',
      cost: 1500,
      workerMultiplier: 2.5,
      capacityMultiplier: 1.5, // 1.5x capacity
      allowedRecipes: ['Make Flour'],
      defaultRecipe: 'Make Flour',
      description: 'Processes grain into flour'
    });

    // Bakery - processes flour into bread
    this.register({
      type: 'bakery',
      name: 'Bakery',
      category: 'production',
      cost: 2000,
      workerMultiplier: 2.0,
      capacityMultiplier: 2.0, // 2x capacity
      allowedRecipes: ['Bake Bread'],
      defaultRecipe: 'Bake Bread',
      description: 'Bakes flour into bread'
    });

    // Winery - processes grapes into wine
    this.register({
      type: 'winery',
      name: 'Winery',
      category: 'production',
      cost: 1800,
      workerMultiplier: 2.3,
      capacityMultiplier: 1.8, // 1.8x capacity
      allowedRecipes: ['Make Wine'],
      defaultRecipe: 'Make Wine',
      description: 'Produces wine from grapes'
    });

    // Warehouse - storage only, no production
    this.register({
      type: 'warehouse',
      name: 'Warehouse',
      category: 'storage',
      cost: 500,
      workerMultiplier: 1.0,
      capacityMultiplier: 10.0, // 10x capacity!
      allowedRecipes: [], // No recipes allowed
      defaultRecipe: null,
      description: 'Storage facility for goods, cannot produce'
    });

    // Office - administrative facility, required for operating in a country
    this.register({
      type: 'office',
      name: 'Office',
      category: 'office',
      cost: 2500,
      workerMultiplier: 2.0,
      capacityMultiplier: 0.0, // No inventory capacity
      allowedRecipes: [], // No recipes allowed
      defaultRecipe: null,
      description: 'Administrative office required to operate facilities in a country'
    });

    // Retail - sells products to the population
    this.register({
      type: 'retail',
      name: 'Retail',
      category: 'retail',
      cost: 1800,
      workerMultiplier: 1.5,
      capacityMultiplier: 3.0, // 3x capacity for storing goods to sell
      allowedRecipes: [], // No recipes - sells existing products
      defaultRecipe: null,
      description: 'Retail facility that sells products to the population for revenue'
    });
  }

  /**
   * Register a facility definition
   */
  private static register(definition: FacilityDefinition): void {
    this.facilities.set(definition.type, definition);
  }

  /**
   * Get a facility definition by type
   */
  static get(type: string): FacilityDefinition | undefined {
    return this.facilities.get(type.toLowerCase());
  }

  /**
   * Check if a recipe is allowed for a facility type
   */
  static isRecipeAllowed(facilityType: string, recipeName: string): boolean {
    const definition = this.get(facilityType);
    if (!definition) return false;
    return definition.allowedRecipes.includes(recipeName);
  }

  /**
   * Check if a facility type can produce (has any allowed recipes)
   */
  static canProduce(facilityType: string): boolean {
    const definition = this.get(facilityType);
    if (!definition) return false;
    return definition.allowedRecipes.length > 0;
  }

  /**
   * Display all available facilities
   */
  static displayFacilities(): string {
    const lines: string[] = ['\n=== Available Facilities ==='];
    
    this.facilities.forEach(facility => {
      lines.push(`\n${facility.name} (${facility.type})`);
      lines.push(`  Cost: $${facility.cost}`);
      lines.push(`  Description: ${facility.description}`);
      
      if (facility.allowedRecipes.length > 0) {
        lines.push(`  Allowed Recipes: ${facility.allowedRecipes.join(', ')}`);
      } else {
        lines.push(`  Allowed Recipes: None (storage only)`);
      }
    });
    
    return lines.join('\n');
  }
}
