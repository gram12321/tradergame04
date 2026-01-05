import { FacilityBase } from './FacilityBase.js';
import { Recipe } from './Recipe.js';
import { FacilityRegistry } from './FacilityRegistry.js';
import { ResourceRegistry } from './ResourceRegistry.js';
import { City } from './City.js';

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
    this.inventory = new Map();
    this.cachedMaxInventoryCapacity = 0;
    this.recipe = null;
    this.productionProgress = 0;
    this.isProducing = false;
    // Now set workers after all properties are initialized
    this.workers = this.calculateRequiredWorkers();
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
   * Get import rate from buying contracts
   */
  getImportRate(): Map<string, number> {
    const imports = new Map<string, number>();
    this.getBuyingContracts().forEach(contract => {
      const current = imports.get(contract.resource) || 0;
      imports.set(contract.resource, current + contract.amountPerTick);
    });
    return imports;
  }

  /**
   * Get export rate from selling contracts
   */
  getExportRate(): Map<string, number> {
    const exports = new Map<string, number>();
    this.getSellingContracts().forEach(contract => {
      const current = exports.get(contract.resource) || 0;
      exports.set(contract.resource, current + contract.amountPerTick);
    });
    return exports;
  }

  /**
   * Get net flow per tick
   */
  getNetFlow(): Map<string, number> {
    const netFlow = new Map<string, number>();
    const allResources = new Set<string>();
    
    this.inventory!.forEach((_, resource) => allResources.add(resource));
    this.getImportRate().forEach((_, resource) => allResources.add(resource));
    this.getExportRate().forEach((_, resource) => allResources.add(resource));
    this.getProductionRate().forEach((_, resource) => allResources.add(resource));
    this.getConsumptionRate().forEach((_, resource) => allResources.add(resource));
    
    allResources.forEach(resource => {
      let net = 0;
      net += this.getImportRate().get(resource) || 0;
      net += this.getProductionRate().get(resource) || 0;
      net -= this.getExportRate().get(resource) || 0;
      net -= this.getConsumptionRate().get(resource) || 0;
      
      if (net !== 0) {
        netFlow.set(resource, net);
      }
    });
    
    return netFlow;
  }

  /**
   * Get ticks until resource depletes
   */
  getTicksUntilDepletion(resource: string): number | null {
    const netFlow = this.getNetFlow().get(resource) || 0;
    if (netFlow >= 0) return null;
    
    const currentAmount = this.getResource(resource);
    if (currentAmount <= 0) return 0;
    
    return Math.floor(currentAmount / Math.abs(netFlow));
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
