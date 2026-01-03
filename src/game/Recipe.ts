export interface ResourceAmount {
  resource: string;
  amount: number;
}

export class Recipe {
  name: string;
  inputs: ResourceAmount[];
  outputs: ResourceAmount[];
  ticksRequired: number;

  constructor(
    name: string,
    inputs: ResourceAmount[],
    outputs: ResourceAmount[],
    ticksRequired: number = 1
  ) {
    this.name = name;
    this.inputs = inputs;
    this.outputs = outputs;
    this.ticksRequired = ticksRequired;
  }

  /**
   * Check if recipe can be executed with given inventory
   */
  canExecute(inventory: Map<string, number>): boolean {
    return this.inputs.every(input => {
      const available = inventory.get(input.resource) || 0;
      return available >= input.amount;
    });
  }

  /**
   * Get recipe description
   */
  getDescription(): string {
    const inputStr = this.inputs.map(i => `${i.amount}x ${i.resource}`).join(', ');
    const outputStr = this.outputs.map(o => `${o.amount}x ${o.resource}`).join(', ');
    return `${this.name}: [${inputStr}] → [${outputStr}] (${this.ticksRequired} ticks)`;
  }
}
