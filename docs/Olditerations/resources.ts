/**
 * Centralized Resource Management
 * This file contains all resource-related definitions and utilities
 */

import { ResourceValues } from './constants';

/**
 * Resource types in the game
 */
export const RESOURCE_TYPES = {
  GRAIN: 'grain',
  CORN: 'corn',
  FLOUR: 'flour',
  SUGAR: 'sugar',
  BREAD: 'bread',
  CORN_BREAD: 'corn_bread',
  CAKE: 'cake',
} as const;

// Add a type for resource values
export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES];

/**
 * Resource icons using emoji
 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_TYPES.GRAIN]: '🌾',
  [RESOURCE_TYPES.CORN]: '🌽',
  [RESOURCE_TYPES.FLOUR]: '🧾',
  [RESOURCE_TYPES.SUGAR]: '🧂',
  [RESOURCE_TYPES.BREAD]: '🍞',
  [RESOURCE_TYPES.CORN_BREAD]: '🌽🍞',
  [RESOURCE_TYPES.CAKE]: '🍰',
};

/**
 * Resource display names with proper capitalization
 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_TYPES.GRAIN]: 'Grain',
  [RESOURCE_TYPES.CORN]: 'Corn',
  [RESOURCE_TYPES.FLOUR]: 'Flour',
  [RESOURCE_TYPES.SUGAR]: 'Sugar',
  [RESOURCE_TYPES.BREAD]: 'Bread',
  [RESOURCE_TYPES.CORN_BREAD]: 'Corn Bread',
  [RESOURCE_TYPES.CAKE]: 'Cake',
};

/**
 * Resource colors for UI elements
 */
export const RESOURCE_COLORS: Record<string, { bg: string, text: string }> = {
  [RESOURCE_TYPES.GRAIN]: { bg: 'bg-amber-50', text: 'text-amber-800' },
  [RESOURCE_TYPES.CORN]: { bg: 'bg-yellow-50', text: 'text-yellow-800' },
  [RESOURCE_TYPES.FLOUR]: { bg: 'bg-stone-50', text: 'text-stone-800' },
  [RESOURCE_TYPES.SUGAR]: { bg: 'bg-blue-50', text: 'text-blue-800' },
  [RESOURCE_TYPES.BREAD]: { bg: 'bg-amber-100', text: 'text-amber-900' },
  [RESOURCE_TYPES.CORN_BREAD]: { bg: 'bg-yellow-100', text: 'text-yellow-900' },
  [RESOURCE_TYPES.CAKE]: { bg: 'bg-pink-50', text: 'text-pink-800' },
};

/**
 * Default consumption rates for resources
 * Defines the base consumption rate per capita for each resource
 */
export const DEFAULT_CONSUMPTION_RATES: Partial<Record<ResourceType, number>> = {
  [RESOURCE_TYPES.GRAIN]: 1,
  [RESOURCE_TYPES.CORN]: 1,
  [RESOURCE_TYPES.FLOUR]: 2,
  [RESOURCE_TYPES.SUGAR]: 4,
  [RESOURCE_TYPES.BREAD]: 3,
  [RESOURCE_TYPES.CORN_BREAD]: 2,
  [RESOURCE_TYPES.CAKE]: 1,
};

/**
 * Reference price ratios for resources - used for relative price comparison
 * These are NOT actual consumer prices, but baseline ratios for price elasticity calculations
 */
export const RESOURCE_PRICE_RATIOS: Partial<Record<ResourceType, number>> = {
  [RESOURCE_TYPES.GRAIN]: 10,
  [RESOURCE_TYPES.CORN]: 20,
  [RESOURCE_TYPES.FLOUR]: 25,
  [RESOURCE_TYPES.SUGAR]: 30,
  [RESOURCE_TYPES.BREAD]: 40,
  [RESOURCE_TYPES.CORN_BREAD]: 35,
  [RESOURCE_TYPES.CAKE]: 60,
};

/**
 * Price elasticity between resource pairs
 * Higher values mean consumers switch more readily between resources when prices change
 */
export interface ElasticityPair {
  resource1: ResourceType;
  resource2: ResourceType;
  elasticity: number; // 0-1 scale (0 = inelastic, 1 = highly elastic)
}

export const RESOURCE_ELASTICITY_PAIRS: ElasticityPair[] = [
  // Raw Resources (high elasticity between raw resources)
  { resource1: RESOURCE_TYPES.GRAIN, resource2: RESOURCE_TYPES.CORN, elasticity: 0.8 },
  { resource1: RESOURCE_TYPES.CORN, resource2: RESOURCE_TYPES.GRAIN, elasticity: 0.8 },
  
  // Intermediate Resources (high elasticity between intermediate resources)
  { resource1: RESOURCE_TYPES.FLOUR, resource2: RESOURCE_TYPES.SUGAR, elasticity: 0.7 },
  { resource1: RESOURCE_TYPES.SUGAR, resource2: RESOURCE_TYPES.FLOUR, elasticity: 0.7 },
  
  // Processed Foods (high elasticity between similar processed foods)
  { resource1: RESOURCE_TYPES.BREAD, resource2: RESOURCE_TYPES.CORN_BREAD, elasticity: 0.9 },
  { resource1: RESOURCE_TYPES.CORN_BREAD, resource2: RESOURCE_TYPES.BREAD, elasticity: 0.9 },
  { resource1: RESOURCE_TYPES.CAKE, resource2: RESOURCE_TYPES.BREAD, elasticity: 0.5 },
  { resource1: RESOURCE_TYPES.CAKE, resource2: RESOURCE_TYPES.CORN_BREAD, elasticity: 0.5 },
  { resource1: RESOURCE_TYPES.BREAD, resource2: RESOURCE_TYPES.CAKE, elasticity: 0.4 },
  { resource1: RESOURCE_TYPES.CORN_BREAD, resource2: RESOURCE_TYPES.CAKE, elasticity: 0.4 },
  
  // Raw to Intermediate (moderate elasticity)
  { resource1: RESOURCE_TYPES.GRAIN, resource2: RESOURCE_TYPES.FLOUR, elasticity: 0.4 },
  { resource1: RESOURCE_TYPES.CORN, resource2: RESOURCE_TYPES.FLOUR, elasticity: 0.3 },
  { resource1: RESOURCE_TYPES.FLOUR, resource2: RESOURCE_TYPES.GRAIN, elasticity: 0.4 },
  { resource1: RESOURCE_TYPES.FLOUR, resource2: RESOURCE_TYPES.CORN, elasticity: 0.3 },
  
  // Raw to Processed (low elasticity)
  { resource1: RESOURCE_TYPES.GRAIN, resource2: RESOURCE_TYPES.BREAD, elasticity: 0.2 },
  { resource1: RESOURCE_TYPES.GRAIN, resource2: RESOURCE_TYPES.CORN_BREAD, elasticity: 0.1 },
  { resource1: RESOURCE_TYPES.GRAIN, resource2: RESOURCE_TYPES.CAKE, elasticity: 0.05 },
  { resource1: RESOURCE_TYPES.CORN, resource2: RESOURCE_TYPES.BREAD, elasticity: 0.1 },
  { resource1: RESOURCE_TYPES.CORN, resource2: RESOURCE_TYPES.CORN_BREAD, elasticity: 0.3 },
  { resource1: RESOURCE_TYPES.CORN, resource2: RESOURCE_TYPES.CAKE, elasticity: 0.05 },
  
  // Intermediate to Processed (moderate to high elasticity based on recipe relevance)
  { resource1: RESOURCE_TYPES.FLOUR, resource2: RESOURCE_TYPES.BREAD, elasticity: 0.6 },
  { resource1: RESOURCE_TYPES.FLOUR, resource2: RESOURCE_TYPES.CORN_BREAD, elasticity: 0.5 },
  { resource1: RESOURCE_TYPES.FLOUR, resource2: RESOURCE_TYPES.CAKE, elasticity: 0.3 },
  { resource1: RESOURCE_TYPES.SUGAR, resource2: RESOURCE_TYPES.CAKE, elasticity: 0.7 },
  { resource1: RESOURCE_TYPES.SUGAR, resource2: RESOURCE_TYPES.BREAD, elasticity: 0.1 },
  { resource1: RESOURCE_TYPES.SUGAR, resource2: RESOURCE_TYPES.CORN_BREAD, elasticity: 0.1 },
  
  // Reverse relationships - processed to ingredients (lower values)
  { resource1: RESOURCE_TYPES.BREAD, resource2: RESOURCE_TYPES.FLOUR, elasticity: 0.4 },
  { resource1: RESOURCE_TYPES.CORN_BREAD, resource2: RESOURCE_TYPES.FLOUR, elasticity: 0.3 },
  { resource1: RESOURCE_TYPES.CORN_BREAD, resource2: RESOURCE_TYPES.CORN, elasticity: 0.2 },
  { resource1: RESOURCE_TYPES.CAKE, resource2: RESOURCE_TYPES.FLOUR, elasticity: 0.2 },
  { resource1: RESOURCE_TYPES.CAKE, resource2: RESOURCE_TYPES.SUGAR, elasticity: 0.5 },
];

/**
 * Price sensitivity for each resource type
 * Higher values mean consumption changes more dramatically with price changes
 */
export const RESOURCE_PRICE_SENSITIVITY: Partial<Record<ResourceType, number>> = {
  [RESOURCE_TYPES.GRAIN]: 0.8, // Staple goods are more price sensitive
  [RESOURCE_TYPES.CORN]: 0.7,
  [RESOURCE_TYPES.FLOUR]: 0.5, // Processed goods are less price sensitive
  [RESOURCE_TYPES.SUGAR]: 0.3, // Sugar is a luxury item, less price sensitive
  [RESOURCE_TYPES.BREAD]: 0.6, // Bread is a staple but processed
  [RESOURCE_TYPES.CORN_BREAD]: 0.5, // Corn bread is less common
  [RESOURCE_TYPES.CAKE]: 0.2, // Cake is a luxury item, least price sensitive
};

/**
 * Format a resource name with its icon
 */
export function formatResourceWithIcon(resourceType: string): string {
  return `${RESOURCE_ICONS[resourceType] || ''} ${RESOURCE_NAMES[resourceType] || resourceType}`;
}

/**
 * Format a resource quantity with name and icon
 */
export function formatResourceQuantity(resourceType: string, amount: number): string {
  return `${RESOURCE_ICONS[resourceType] || ''} ${amount} ${resourceType}`;
}

/**
 * Check if a resource type is valid
 */
export function isValidResourceType(resourceType: string): boolean {
  return Object.values(RESOURCE_TYPES).includes(resourceType as ResourceType);
}

/**
 * Get default empty inventory for any facility
 * This function is also available in facilities.ts to avoid circular dependencies
 */
export function getEmptyInventory(): ResourceValues {
  return {
    [RESOURCE_TYPES.GRAIN]: 0,
    [RESOURCE_TYPES.CORN]: 0,
    [RESOURCE_TYPES.FLOUR]: 0,
    [RESOURCE_TYPES.SUGAR]: 0,
    [RESOURCE_TYPES.BREAD]: 0,
    [RESOURCE_TYPES.CORN_BREAD]: 0,
    [RESOURCE_TYPES.CAKE]: 0,
  };
}

/**
 * Helper guide for adding a new resource:
 * 1. Add a new entry to RESOURCE_TYPES
 * 2. Add an icon to RESOURCE_ICONS
 * 3. Add a display name to RESOURCE_NAMES
 * 4. Add colors to RESOURCE_COLORS
 * 5. Add consumption rate to DEFAULT_CONSUMPTION_RATES
 * 6. Add price ratio to RESOURCE_PRICE_RATIOS
 * 7. Add elasticity pairs to RESOURCE_ELASTICITY_PAIRS
 * 8. Add price sensitivity to RESOURCE_PRICE_SENSITIVITY
 * 9. Add recipe in recipes.ts
 * 10. Add to allowed recipes in facilities.ts
 * 11. Add to starting resources in constants.ts
 */ 