import { FacilityBase } from './FacilityBase.ts';
import { Recipe } from './Recipe.ts';
import { FacilityRegistry } from './FacilityRegistry.ts';
import { City } from './City.ts';

/**
 * Production facility that can craft items using recipes
 * Examples: Farm, Mill, Bakery
 */
export class ProductionFacility extends FacilityBase {
  recipe: Recipe | null;
  productionProgress: number;
  isProducing: boolean;

  constructor(type: string, ownerId: string, name: string, city: City) {
    super(type, ownerId, name, city);
    this.initInventory();
    this.recipe = null;
    this.productionProgress = 0;
    this.isProducing = false;
    // Now set workers after all properties are initialized
    this.initWorkers();
  }

  /**
   * Get production multiplier based on size
   * Formula: sqrt(size)
   */
  getProductionMultiplier(): number {
    return Math.sqrt(this.size);
  }

  /**
   * Set recipe for production
   */
  setRecipe(recipe: Recipe): boolean {
    if (!FacilityRegistry.canProduce(this.type)) return false;
    if (!FacilityRegistry.isRecipeAllowed(this.type, recipe.name)) return false;

    this.recipe = recipe;
    this.isProducing = false;
    this.productionProgress = 0;
    return true;
  }

  /**
   * Start production if inputs available
   */
  startProduction(): boolean {
    if (!this.recipe || this.isProducing) return false;
    if (this.recipe.canExecute(this.inventory!)) {
      this.isProducing = true;
      this.productionProgress = 0;
      return true;
    }
    return false;
  }

  /**
   * Get production rate per tick
   */
  getProductionRate(): Map<string, number> {
    const production = new Map<string, number>();
    if (!this.recipe) return production;

    const multiplier = this.getProductionMultiplier() * this.effectivity;
    this.recipe.outputs.forEach(output => {
      const ratePerTick = (output.amount * multiplier) / this.recipe!.ticksRequired;
      production.set(output.resource, ratePerTick);
    });
    return production;
  }

  /**
   * Get consumption rate per tick
   */
  getConsumptionRate(): Map<string, number> {
    const consumption = new Map<string, number>();
    if (!this.recipe) return consumption;

    const multiplier = this.getProductionMultiplier() * this.effectivity;
    this.recipe.inputs.forEach(input => {
      const ratePerTick = (input.amount * multiplier) / this.recipe!.ticksRequired;
      consumption.set(input.resource, ratePerTick);
    });
    return consumption;
  }

  /**
   * Get net flow per tick
   */
  getNetFlow(): Map<string, number> {
    const imports = this.getImportRate();
    const production = this.getProductionRate();
    const consumption = this.getConsumptionRate();
    const exports = this.negateFlow(this.getExportRate());
    const consumptionOut = this.negateFlow(consumption);
    return this.buildNetFlow([imports, exports, production, consumptionOut]);
  }

  /**
   * Get ticks until resource depletes
   */
  getTicksUntilDepletion(resource: string): number | null {
    return this.getTicksUntilDepletionFromNetFlow(resource, this.getNetFlow());
  }

  /**
   * Process one tick of production
   */
  processTick(): void {
    this.updateInventoryCapacityForTick();

    if (!this.isProducing && this.recipe) {
      this.startProduction();
    }

    if (!this.isProducing || !this.recipe) return;

    this.productionProgress++;

    if (this.productionProgress >= this.recipe.ticksRequired) {
      this.completeProduction();
    }
  }

  /**
   * Complete production cycle
   */
  private completeProduction(): void {
    if (!this.recipe) return;

    const multiplier = this.getProductionMultiplier() * this.effectivity;
    this.recipe.inputs.forEach(input => {
      this.removeResource(input.resource, input.amount * multiplier);
    });

    this.recipe.outputs.forEach(output => {
      this.addResource(output.resource, output.amount * multiplier);
    });

    this.isProducing = false;
    this.productionProgress = 0;
    this.startProduction();
  }

  /**
   * Get facility status string
   */
  getStatus(): string {
    const inventoryStr = Array.from(this.inventory!.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([resource, amount]) => `${resource}: ${amount}`)
      .join(', ');

    const statusStr = this.isProducing
      ? `Producing (${this.productionProgress}/${this.recipe?.ticksRequired})`
      : 'Idle';

    return `[${this.name}] ${statusStr} | Inventory: {${inventoryStr || 'empty'}}`;
  }
}
