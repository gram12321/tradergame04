import { Recipe } from './Recipe.ts';

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

    this.register(new Recipe(
      'Grow Grapes',
      [], // No inputs
      [{ resource: 'grapes', amount: 8 }],
      2 // Takes 2 ticks
    ));

    this.register(new Recipe(
      'Grow Sugar',
      [], // No inputs
      [{ resource: 'sugar', amount: 12 }],
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

    this.register(new Recipe(
      'Bake Cake',
      [{ resource: 'flour', amount: 10 }, { resource: 'sugar', amount: 5 }],
      [{ resource: 'cake', amount: 1 }],
      2 // Takes 2 ticks
    ));

    // Winery recipes
    this.register(new Recipe(
      'Make Wine',
      [{ resource: 'grapes', amount: 5 }],
      [{ resource: 'wine', amount: 1 }],
      2 // Takes 2 ticks
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
