import { Recipe } from './Recipe.js';
import { FacilityRegistry } from './FacilityRegistry.js';

export class Facility {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  inventory: Map<string, number>;
  recipe: Recipe | null;
  productionProgress: number;
  isProducing: boolean;

  constructor(type: string, ownerId: string, name: string) {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.type = type;
    this.ownerId = ownerId;
    this.inventory = new Map();
    this.recipe = null;
    this.productionProgress = 0;
    this.isProducing = false;
  }

  /**
   * Set the recipe for this facility
   * @returns true if recipe was set successfully, false if not allowed
   */
  setRecipe(recipe: Recipe): boolean {
    // Check if this facility type can produce
    if (!FacilityRegistry.canProduce(this.type)) {
      return false;
    }

    // Check if recipe is allowed for this facility type
    if (!FacilityRegistry.isRecipeAllowed(this.type, recipe.name)) {
      return false;
    }

    this.recipe = recipe;
    this.isProducing = false;
    this.productionProgress = 0;
    return true;
  }

  /**
   * Add resources to facility inventory
   */
  addResource(resource: string, amount: number): void {
    const current = this.inventory.get(resource) || 0;
    this.inventory.set(resource, current + amount);
  }

  /**
   * Remove resources from facility inventory
   */
  removeResource(resource: string, amount: number): boolean {
    const current = this.inventory.get(resource) || 0;
    if (current >= amount) {
      this.inventory.set(resource, current - amount);
      return true;
    }
    return false;
  }

  /**
   * Get resource amount in inventory
   */
  getResource(resource: string): number {
    return this.inventory.get(resource) || 0;
  }

  /**
   * Start production if recipe can be executed
   */
  startProduction(): boolean {
    if (!this.recipe || this.isProducing) {
      return false;
    }

    if (this.recipe.canExecute(this.inventory)) {
      this.isProducing = true;
      this.productionProgress = 0;
      return true;
    }

    return false;
  }

  /**
   * Process one tick of production
   */
  processTick(): void {
    // Try to auto-start production if not producing
    if (!this.isProducing && this.recipe) {
      this.startProduction();
    }

    // If not producing (no recipe or can't start), exit early
    if (!this.isProducing || !this.recipe) {
      return;
    }

    this.productionProgress++;

    // Check if production is complete
    if (this.productionProgress >= this.recipe.ticksRequired) {
      this.completeProduction();
    }
  }

  /**
   * Complete the current production cycle
   */
  private completeProduction(): void {
    if (!this.recipe) return;

    // Consume inputs
    this.recipe.inputs.forEach(input => {
      this.removeResource(input.resource, input.amount);
    });

    // Produce outputs
    this.recipe.outputs.forEach(output => {
      this.addResource(output.resource, output.amount);
    });

    // Reset production state
    this.isProducing = false;
    this.productionProgress = 0;

    // Auto-start next cycle if possible
    this.startProduction();
  }

  /**
   * Get facility status
   */
  getStatus(): string {
    const inventoryStr = Array.from(this.inventory.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([resource, amount]) => `${resource}: ${amount}`)
      .join(', ');

    const statusStr = this.isProducing 
      ? `Producing (${this.productionProgress}/${this.recipe?.ticksRequired})` 
      : 'Idle';

    return `[${this.name}] ${statusStr} | Inventory: {${inventoryStr || 'empty'}}`;
  }
}
