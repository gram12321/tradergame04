import { Recipe } from './Recipe.js';

/**
 * Registry of all available recipes in the game
 */
export class RecipeRegistry {
  private static recipes: Map<string, Recipe> = new Map();

  static {
    // Farm recipes
    this.register(new Recipe(
      'Grow Grain',
      [], // No inputs
      [{ resource: 'grain', amount: 10 }],
      2 // Takes 2 ticks
    ));

    // Mill recipes
    this.register(new Recipe(
      'Make Flour',
      [{ resource: 'grain', amount: 2 }],
      [{ resource: 'flour', amount: 10 }],
      1 // Takes 1 tick
    ));

    // Bakery recipes
    this.register(new Recipe(
      'Bake Bread',
      [{ resource: 'flour', amount: 20 }],
      [{ resource: 'bread', amount: 1 }],
      1 // Takes 1 tick
    ));
  }

  /**
   * Register a recipe
   */
  private static register(recipe: Recipe): void {
    this.recipes.set(recipe.name, recipe);
  }

  /**
   * Get a recipe by name
   */
  static get(name: string): Recipe | undefined {
    return this.recipes.get(name);
  }
}
