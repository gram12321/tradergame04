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
