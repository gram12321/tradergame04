/**
 * Consumer demand and behavior simulation
 */
import { 
  ResourceType, 
  RESOURCE_PRICE_RATIOS, 
  RESOURCE_ELASTICITY_PAIRS, 
  RESOURCE_PRICE_SENSITIVITY,
  DEFAULT_CONSUMPTION_RATES
} from './resources';
import { Shop } from './types';
import { CITY_CONFIG, CityId } from './locations';

/**
 * Calculate price elasticity effect using an improved formula with sigmoid function
 * This creates a more realistic curve without artificial limits
 * 
 * @param price The price to calculate effect for
 * @param averagePrice The average market price
 * @param resourceType The resource type
 * @returns Multiplier for consumption amount based on price
 */
export function calculatePriceEffect(
  price: number,
  avgPrice: number,
  resourceType: ResourceType
): number {
  if (price <= 0) return 0; // Zero price means not for sale
  if (avgPrice <= 0) return 1; // If no average price available, return neutral effect

  // Use the existing sensitivity values
  const sensitivity = RESOURCE_PRICE_SENSITIVITY[resourceType] || 0.5;
  const priceRatio = price / avgPrice;

  // Apply different formulas based on price ratio
  if (priceRatio <= 1) {
    // Below average price: power function for gentle curve
    // Higher sensitivity means more dramatic effect for price reductions
    const effect = Math.pow(1 / priceRatio, sensitivity * 6 * 0.2);
    // Cap the maximum effect to prevent extremely high values
    return Math.min(effect, 5);
  } else {
    // Above average price: exponential decay for steep drop
    // Higher sensitivity means steeper drop-off for price increases
    const effect = Math.exp(-sensitivity * 6 * 0.2 * (priceRatio - 1));
    return effect;
  }
}

/**
 * Calculate additional demand created by exceptional pricing
 * This represents consumers buying more of a product than they normally would
 * when prices are significantly below average
 * 
 * @param price The shop price
 * @param averagePrice The city average price
 * @param resourceType The resource type
 * @returns Demand creation multiplier (1.0 = no change)
 */
export function calculateDemandCreationFactor(
  price: number,
  avgPrice: number,
  resourceType: ResourceType
): number {
  if (price <= 0) return 0; // Zero price means not for sale
  if (avgPrice <= 0) return 1; // If no average price available, return neutral effect

  // Use the existing sensitivity values
  const sensitivity = RESOURCE_PRICE_SENSITIVITY[resourceType] || 0.5;
  const priceRatio = price / avgPrice;

  // Only create additional demand for prices below average
  if (priceRatio >= 1) {
    return 1.0; // No additional demand (but no reduction either)
  }

  // Calculate demand creation factor - more aggressive than the distribution effect
  // More sensitivity means more demand creation for price reductions
  const effect = Math.pow(1 / priceRatio, sensitivity * 3 * 0.3);
  
  // No hard cap, but practical limit to prevent extreme values
  return Math.min(effect, 10);
}

/**
 * Consumer type enum - can be expanded later
 */
export enum ConsumerType {
  STANDARD = 'standard',
  WEALTHY = 'wealthy',
  FRUGAL = 'frugal',
}

/**
 * Consumer behavior statistics for analysis
 */
export interface ConsumerStats {
  resourceType: ResourceType;
  cityId: string;
  avgPrice: number;
  shopCount: number;
  priceRange: {
    min: number;
    max: number;
  };
  shops: Array<{
    shopId: string;
    price: number;
    selectionProbability: number;
    priceDiffFromAvg: number;
  }>;
}

/**
 * Calculate the average price for a resource in a city
 * 
 * @param shops All shops in a city
 * @param resourceType The resource type to calculate average price for
 * @returns The average price or 0 if no shops have consumer prices for this resource
 */
export function calculateAverageCityPrice(
  shops: Shop[],
  resourceType: ResourceType
): number {
  // Filter out shops with no inventory or no price set
  const validShops = shops.filter((shop): shop is Shop => {
    // Check if shop has inventory and consumer prices
    if (!shop.inventory || !shop.consumerPrices) return false;
    
    // Check inventory amount using type assertion
    const inventoryAmount = shop.inventory[resourceType as keyof typeof shop.inventory];
    if (inventoryAmount === undefined || inventoryAmount <= 0) return false;
    
    // Check consumer price using type assertion
    const consumerPrice = shop.consumerPrices[resourceType as keyof typeof shop.consumerPrices];
    if (consumerPrice === undefined || consumerPrice <= 0) return false;
    
    return true;
  });
  
  if (validShops.length === 0) {
    // Don't fall back to ratio prices, return 0 if no valid prices
    return 0;
  }
  
  // Calculate sum manually to avoid TypeScript issues with reduce
  let sum = 0;
  for (const shop of validShops) {
    if (shop.consumerPrices && typeof shop.consumerPrices[resourceType] === 'number') {
      sum += shop.consumerPrices[resourceType];
    }
  }
  
  return sum / validShops.length;
}

/**
 * Calculate probability of selecting a shop based on its price compared to others
 * with detailed statistics for analysis
 * 
 * @param shops All shops in the city offering this resource
 * @param resourceType The resource type to compare
 * @param cityId The city ID for statistics tracking
 * @returns Map of shop IDs to selection probabilities (0-1) and stats
 */
export function calculateShopSelectionProbabilitiesWithStats(
  shops: Shop[],
  resourceType: ResourceType,
  cityId: string
): { probabilities: Map<string, number>; stats: ConsumerStats } {
  const result = new Map<string, number>();
  
  // Initialize stats object
  const stats: ConsumerStats = {
    resourceType,
    cityId,
    avgPrice: 0,
    shopCount: 0,
    priceRange: {
      min: Number.MAX_VALUE,
      max: 0
    },
    shops: []
  };
  
  // Filter shops that have this resource in inventory AND have a consumer price set
  const relevantShops = shops.filter(shop => 
    shop.inventory && 
    typeof shop.inventory[resourceType] === 'number' &&
    shop.inventory[resourceType] > 0 &&
    shop.consumerPrices &&
    typeof shop.consumerPrices[resourceType] === 'number' &&
    shop.consumerPrices[resourceType] > 0
  );
  
  stats.shopCount = relevantShops.length;
  
  if (relevantShops.length === 0) {
    return { probabilities: result, stats };
  }
  
  // If only one shop, it gets 100% probability
  if (relevantShops.length === 1) {
    const shop = relevantShops[0];
    const price = shop.consumerPrices?.[resourceType] || 0;
    
    if (price > 0) {
      result.set(shop.id, 1);
      
      // Update stats
      stats.avgPrice = price;
      stats.priceRange.min = price;
      stats.priceRange.max = price;
      stats.shops.push({
        shopId: shop.id,
        price,
        selectionProbability: 1,
        priceDiffFromAvg: 0
      });
    }
    
    return { probabilities: result, stats };
  }
  
  // Calculate average price and price range
  let sum = 0;
  for (const shop of relevantShops) {
    if (shop.consumerPrices && typeof shop.consumerPrices[resourceType] === 'number') {
      const price = shop.consumerPrices[resourceType];
      sum += price;
      
      // Update price range
      if (price < stats.priceRange.min) stats.priceRange.min = price;
      if (price > stats.priceRange.max) stats.priceRange.max = price;
    }
  }
  const avgPrice = sum / relevantShops.length;
  stats.avgPrice = avgPrice;
  
  // Calculate price differences from average
  const priceFactors: number[] = [];
  for (let i = 0; i < relevantShops.length; i++) {
    const shop = relevantShops[i];
    const price = shop.consumerPrices![resourceType];
    
    if (typeof price !== 'number' || price <= 0 || avgPrice === 0) {
      priceFactors.push(1); // Default factor if price data is invalid
      continue;
    }
    
    const priceDiff = avgPrice / price; // Higher for lower prices
    // Amplify the differences (but keep between 0.5 and 2)
    priceFactors.push(Math.max(0.5, Math.min(2, priceDiff * priceDiff)));
  }
  
  // Calculate total for normalization
  let totalFactor = 0;
  for (const factor of priceFactors) {
    totalFactor += factor;
  }
  
  // Assign probabilities
  for (let i = 0; i < relevantShops.length; i++) {
    const shop = relevantShops[i];
    const price = shop.consumerPrices?.[resourceType] || 0;
    
    if (price <= 0) continue; // Skip if price is invalid
    
    const probability = totalFactor > 0 ? priceFactors[i] / totalFactor : 0;
    
    result.set(shop.id, probability);
    
    // Add to stats
    stats.shops.push({
      shopId: shop.id,
      price,
      selectionProbability: probability,
      priceDiffFromAvg: ((price / avgPrice) - 1) * 100 // As percentage difference
    });
  }
  
  // Sort shops by selection probability (highest first)
  stats.shops.sort((a, b) => b.selectionProbability - a.selectionProbability);
  
  return { probabilities: result, stats };
}

/**
 * Original function maintained for backward compatibility
 */
export function calculateShopSelectionProbabilities(
  shops: Shop[],
  resourceType: ResourceType
): Map<string, number> {
  return calculateShopSelectionProbabilitiesWithStats(shops, resourceType, "unknown").probabilities;
}

/**
 * Determine if a consumer will substitute one resource for another based on price differences
 * with detailed logging of decision factors
 * 
 * @param resourceType Current resource
 * @param alternativeType Alternative resource
 * @param resourcePrice Current resource price
 * @param alternativePrice Alternative resource price
 * @param enableLogging Whether to log the substitution decision process
 * @returns True if consumer will substitute, false otherwise
 */
export function willSubstituteResource(
  resourceType: ResourceType,
  alternativeType: ResourceType,
  resourcePrice: number,
  alternativePrice: number,
  enableLogging: boolean = false
): boolean {
  // Find elasticity between these resources
  const elasticityPair = RESOURCE_ELASTICITY_PAIRS.find(
    pair => 
      (pair.resource1 === resourceType && pair.resource2 === alternativeType) ||
      (pair.resource1 === alternativeType && pair.resource2 === resourceType)
  );
  
  if (!elasticityPair) {
    if (enableLogging) {
      console.log(`  No elasticity defined between ${resourceType} and ${alternativeType}`);
    }
    return false; // No elasticity defined for this pair
  }
  
  const elasticity = elasticityPair.elasticity;
  
  // Just compare actual prices directly - we can still use RESOURCE_PRICE_RATIOS
  // for this purpose as it represents relative value between resources, not actual prices
  const referenceRatio = 
    (RESOURCE_PRICE_RATIOS[resourceType] || 1) / 
    (RESOURCE_PRICE_RATIOS[alternativeType] || 1);
  
  // If prices are missing, don't substitute
  if (!resourcePrice || !alternativePrice) {
    if (enableLogging) {
      console.log(`  Missing prices: ${resourceType}=${resourcePrice}, ${alternativeType}=${alternativePrice}`);
    }
    return false;
  }
  
  const actualRatio = resourcePrice / alternativePrice;
  
  // Calculate difference from expected ratio
  const ratioDifference = actualRatio / referenceRatio;
  
  // Apply elasticity and add randomness
  const substitutionThreshold = 1 + (0.3 * elasticity);
  const randomFactor = Math.random() < elasticity * 0.2;
  
  const willSubstitute = ratioDifference > substitutionThreshold || 
         (randomFactor && ratioDifference > 1);
  
  if (enableLogging) {
    console.log(`  Substitution Decision: ${resourceType} → ${alternativeType}`);
    console.log(`    Prices: ${resourceType}=${resourcePrice.toFixed(2)}🪙, ${alternativeType}=${alternativePrice.toFixed(2)}🪙`);
    console.log(`    Reference Ratio: ${referenceRatio.toFixed(2)} (expected price relationship)`);
    console.log(`    Actual Ratio: ${actualRatio.toFixed(2)} (current price relationship)`);
    console.log(`    Price Disparity: ${(ratioDifference * 100 - 100).toFixed(1)}% ${ratioDifference > 1 ? 'higher' : 'lower'} than expected`);
    console.log(`    Elasticity: ${elasticity.toFixed(2)} (how easily consumers switch)`);
    console.log(`    Threshold: ${substitutionThreshold.toFixed(2)} (minimum ratio difference needed)`);
    console.log(`    Random Factor: ${randomFactor ? 'Yes' : 'No'} (adds unpredictability)`);
    console.log(`    Decision: Will ${willSubstitute ? 'SUBSTITUTE ✓' : 'NOT substitute ✗'}`);
    console.log(`    Reason: ${willSubstitute 
      ? (ratioDifference > substitutionThreshold 
          ? 'Price difference exceeds threshold' 
          : 'Random factor with favorable price') 
      : 'Price difference too small'}`);
  }
  
  return willSubstitute;
}

/**
 * Apply wealth-based consumption multiplier
 * 
 * @param baseConsumption Base consumption amount
 * @param cityWealthScore City wealth score (0-100)
 * @param resourceType Resource type
 * @returns Adjusted consumption amount
 */
export function applyWealthEffect(
  baseConsumption: number, 
  cityWealthScore: number, 
  resourceType: ResourceType
): number {
  // Convert wealth score to a multiplier between 0.8 and 1.5
  const wealthMultiplier = 0.8 + (cityWealthScore / 100) * 0.7;
  
  return baseConsumption * wealthMultiplier;
}

/**
 * Simulate consumption for a single consumer in a city
 * with detailed substitution logging
 * 
 * @param consumerType Type of consumer
 * @param shops Available shops in the city
 * @param resourceType Resource to consume
 * @param cityWealthScore City's wealth score (0-100)
 * @param cityId The ID of the city
 * @param enableSubstitutionLogging Whether to log substitution decisions
 * @returns Map of shop IDs to consumption amounts
 */
export function simulateConsumption(
  consumerType: ConsumerType,
  shops: Shop[],
  resourceType: ResourceType,
  cityWealthScore: number,
  cityId: string,
  enableSubstitutionLogging: boolean = false
): Map<string, number> {
  const result = new Map<string, number>();
  
  // Check for potential substitutes
  if (enableSubstitutionLogging) {
    console.groupCollapsed(`🔄 Resource Substitution Analysis (${resourceType.toUpperCase()})`);
    
    // Find potential substitutes (resources with elasticity pairs)
    const potentialSubstitutes = RESOURCE_ELASTICITY_PAIRS
      .filter(pair => pair.resource1 === resourceType || pair.resource2 === resourceType)
      .map(pair => pair.resource1 === resourceType ? pair.resource2 : pair.resource1);
    
    if (potentialSubstitutes.length > 0) {
      console.log(`Checking substitutes for ${resourceType}: ${potentialSubstitutes.join(', ')}`);
      
      // For each potential substitute, check prices and substitution likelihood
      potentialSubstitutes.forEach(alternativeType => {
        // Get average prices for both resources
        const resourceAvgPrice = calculateAverageCityPrice(shops, resourceType);
        const alternativeAvgPrice = calculateAverageCityPrice(shops, alternativeType as ResourceType);
        
        // Check if we have valid prices for both
        if (resourceAvgPrice > 0 && alternativeAvgPrice > 0) {
          // Check substitution likelihood
          const willSubstitute = willSubstituteResource(
            resourceType, 
            alternativeType as ResourceType, 
            resourceAvgPrice, 
            alternativeAvgPrice,
            true // Enable detailed logging
          );
          
          // Calculate approximate substitution amount if substitution occurs
          if (willSubstitute) {
            const baseRate = DEFAULT_CONSUMPTION_RATES[resourceType] || 0;
            const elasticity = RESOURCE_ELASTICITY_PAIRS.find(
              pair => (pair.resource1 === resourceType && pair.resource2 === alternativeType) ||
                    (pair.resource1 === alternativeType && pair.resource2 === resourceType)
            )?.elasticity || 0;
            
            // Calculate approximate substitution percentage
            // Higher elasticity and higher price disparity = more substitution
            const actualRatio = resourceAvgPrice / alternativeAvgPrice;
            const referenceRatio = (RESOURCE_PRICE_RATIOS[resourceType] || 1) / 
                                  (RESOURCE_PRICE_RATIOS[alternativeType as ResourceType] || 1);
            const ratioDifference = actualRatio / referenceRatio;
            
            // Simple formula: Substitute between 30-70% based on elasticity and price difference
            const substitutionAmount = baseRate * Math.min(0.7, Math.max(0.3, elasticity) * 
                                     Math.min(1.5, Math.max(1.0, ratioDifference - 1 + 0.5)));
            
            console.log(`    Estimated Substitution: ~${substitutionAmount.toFixed(2)} units shifted to ${alternativeType}`);
            console.log(`    Impact: ~${Math.round(substitutionAmount / baseRate * 100)}% of ${resourceType} demand shifts to ${alternativeType}`);
          }
        } else {
          console.log(`  Cannot compare prices: ${resourceType}=${resourceAvgPrice}, ${alternativeType}=${alternativeAvgPrice}`);
        }
      });
    } else {
      console.log(`No substitutes defined for ${resourceType}`);
    }
    
    console.groupEnd();
  }
  
  // Calculate shop selection probabilities
  const shopProbabilities = calculateShopSelectionProbabilities(shops, resourceType);
  
  if (shopProbabilities.size === 0) {
    return result;
  }
  
  // Calculate average city price
  const avgPrice = calculateAverageCityPrice(shops, resourceType);
  
  if (enableSubstitutionLogging) {
    console.groupCollapsed(`💰 Consumption Factors (${resourceType.toUpperCase()})`);
    
    // Calculate and log wealth effect
    const baseRate = DEFAULT_CONSUMPTION_RATES[resourceType] || 0;
    const wealthMultiplier = 0.8 + (cityWealthScore / 100) * 0.7;
    const totalWealthEffect = wealthMultiplier;
    
    // Track substitution effects between resources
    const substitutionEffects = new Map<string, number>();
    
    // Find potential substitutes for this resource
    const potentialSubstitutes = RESOURCE_ELASTICITY_PAIRS
      .filter(pair => pair.resource1 === resourceType || pair.resource2 === resourceType)
      .map(pair => pair.resource1 === resourceType ? pair.resource2 : pair.resource1);
    
    // Calculate amount lost to substitution (approximate)
    const substitutionAmount = potentialSubstitutes.reduce((total: number, altType: string) => {
      const resourceAvgPrice = calculateAverageCityPrice(shops, resourceType);
      const alternativeAvgPrice = calculateAverageCityPrice(shops, altType as ResourceType);
      
      if (resourceAvgPrice > 0 && alternativeAvgPrice > 0) {
        if (willSubstituteResource(resourceType, altType as ResourceType, resourceAvgPrice, alternativeAvgPrice)) {
          const elasticity = RESOURCE_ELASTICITY_PAIRS.find(
            pair => (pair.resource1 === resourceType && pair.resource2 === altType) ||
                  (pair.resource1 === altType && pair.resource2 === resourceType)
          )?.elasticity || 0;
          
          const actualRatio = resourceAvgPrice / alternativeAvgPrice;
          const referenceRatio = (RESOURCE_PRICE_RATIOS[resourceType] || 1) / 
                                (RESOURCE_PRICE_RATIOS[altType as ResourceType] || 1);
          const ratioDifference = actualRatio / referenceRatio;
          
          const substitutionEffect = baseRate * Math.min(0.7, Math.max(0.3, elasticity) * 
                       Math.min(1.5, Math.max(1.0, ratioDifference - 1 + 0.5)));

          // Track the substitution effect for the alternative resource
          if (!substitutionEffects.has(altType)) {
            substitutionEffects.set(altType, 0);
          }
          substitutionEffects.set(altType, substitutionEffects.get(altType)! + substitutionEffect);
          
          return total + substitutionEffect;
        }
      }
      return total;
    }, 0);
    
    // Add the random component
    const randomVariation = (Math.random() * 0.4) - 0.2; // ±20%
    
    console.log(`Base consumption rate: ${baseRate} units per consumer`);
    console.log(`City wealth score: ${cityWealthScore}/100`);
    console.log(`Wealth multiplier: ${wealthMultiplier.toFixed(2)}`);
    console.log(`Total wealth effect: ${totalWealthEffect.toFixed(2)}x`);
    
    // Log price sensitivity and estimated impacts
    const sensitivity = RESOURCE_PRICE_SENSITIVITY[resourceType] || 0.5;
    console.log(`Price sensitivity: ${sensitivity.toFixed(2)} (how much price affects demand)`);
    
    // Calculate final consumption estimate before shop distribution
    const baseAdjusted = baseRate * totalWealthEffect;
    const afterSubstitution = Math.max(0, baseAdjusted - substitutionAmount);
    const withRandomness = afterSubstitution * (1 + randomVariation);

    // Apply substitution gains from other resources switching to this one
    const substitutionGain = substitutionEffects.get(resourceType) || 0;
    const finalConsumption = withRandomness + substitutionGain;
    
    console.log(`\n--- Consumption Calculation ---`);
    console.log(`Base rate: ${baseRate.toFixed(2)} units`);
    console.log(`After wealth adjustments: ${baseAdjusted.toFixed(2)} units`);
    console.log(`After substitution effects: ${afterSubstitution.toFixed(2)} units (lost ${substitutionAmount.toFixed(2)} to substitution)`);
    console.log(`After gaining substitutions: ${finalConsumption.toFixed(2)} units (gained ${substitutionGain.toFixed(2)} from substitution)`);
    console.log(`With random variation (${(randomVariation * 100).toFixed(1)}%): ${finalConsumption.toFixed(2)} units`);
    
    // Fix TypeScript error by properly casting cityId to CityId
    const typedCityId = cityId as keyof typeof CITY_CONFIG;
    const cityPopulation = CITY_CONFIG[typedCityId]?.population || 0;
    
    console.log(`Total city population: ${cityPopulation} consumers`);
    console.log(`Estimated total consumption: ~${(finalConsumption * cityPopulation).toFixed(2)} units`);
    
    console.groupEnd();
  }
  
  // For each shop with probability > 0
  Array.from(shopProbabilities.entries()).forEach(([shopId, probability]) => {
    // Find the shop
    const shop = shops.find(s => s.id === shopId);
    if (!shop || !shop.consumerPrices) return;
    
    // Get consumer price - we already verified it exists in calculateShopSelectionProbabilities
    const price = shop.consumerPrices[resourceType];
    if (typeof price !== 'number' || price <= 0) return;
    
    // Base consumption rate
    const baseRate = DEFAULT_CONSUMPTION_RATES[resourceType] || 0;
    
    // Use the improved price effect calculation
    let priceEffect = calculatePriceEffect(price, avgPrice, resourceType);
    
    // Apply demand creation factor - additional demand from exceptional pricing
    const demandCreationFactor = calculateDemandCreationFactor(price, avgPrice, resourceType);
    
    // Calculate consumption with price effect and demand creation
    let consumption = baseRate * priceEffect * demandCreationFactor;
    
    // Log price and demand effects for debugging (only if detailed logging is enabled)
    if (enableSubstitutionLogging && demandCreationFactor !== 1.0) {
      console.log(`  Shop ${shopId.substring(0, 4)}... Price Effects:`);
      console.log(`    Price: ${price.toFixed(2)} 🪙 (${((price/avgPrice - 1) * 100).toFixed(1)}% from avg)`);
      console.log(`    Distribution Effect: ${priceEffect.toFixed(2)}x`);
      console.log(`    Demand Creation: ${demandCreationFactor.toFixed(2)}x`);
      console.log(`    Combined Effect: ${(priceEffect * demandCreationFactor).toFixed(2)}x`);
    }
    
    // Apply wealth effect
    consumption = applyWealthEffect(consumption, cityWealthScore, resourceType);
    
    // Calculate substitution effects
    const substitutionAmount = calculateSubstitutionAmount(resourceType, shops);
    const substitutionGain = calculateSubstitutionGains(resourceType, shops);
    
    // Apply substitution effects
    consumption = Math.max(0, consumption - substitutionAmount + substitutionGain);
    
    // Apply shop selection probability
    consumption *= probability;
    
    // Add randomness (±10%)
    const randomFactor = 0.9 + Math.random() * 0.2;
    consumption *= randomFactor;
    
    // Store result
    if (consumption > 0) {
      const roundedConsumption = Math.round(consumption * 10) / 10;
      result.set(shopId, roundedConsumption);
    }
  });
  
  return result;
}

// Helper function to calculate substitution amount for a resource
function calculateSubstitutionAmount(resourceType: ResourceType, shops: Shop[]): number {
  const potentialSubstitutes = RESOURCE_ELASTICITY_PAIRS
    .filter(pair => pair.resource1 === resourceType || pair.resource2 === resourceType)
    .map(pair => pair.resource1 === resourceType ? pair.resource2 : pair.resource1);
  
  return potentialSubstitutes.reduce((total: number, altType: string) => {
    const resourceAvgPrice = calculateAverageCityPrice(shops, resourceType);
    const alternativeAvgPrice = calculateAverageCityPrice(shops, altType as ResourceType);
    
    if (resourceAvgPrice > 0 && alternativeAvgPrice > 0) {
      if (willSubstituteResource(resourceType, altType as ResourceType, resourceAvgPrice, alternativeAvgPrice)) {
        const elasticity = RESOURCE_ELASTICITY_PAIRS.find(
          pair => (pair.resource1 === resourceType && pair.resource2 === altType) ||
                (pair.resource1 === altType && pair.resource2 === resourceType)
        )?.elasticity || 0;
        
        const actualRatio = resourceAvgPrice / alternativeAvgPrice;
        const referenceRatio = (RESOURCE_PRICE_RATIOS[resourceType] || 1) / 
                              (RESOURCE_PRICE_RATIOS[altType as ResourceType] || 1);
        const ratioDifference = actualRatio / referenceRatio;
        
        const baseRate = DEFAULT_CONSUMPTION_RATES[resourceType] || 0;
        return total + baseRate * Math.min(0.7, Math.max(0.3, elasticity) * 
                     Math.min(1.5, Math.max(1.0, ratioDifference - 1 + 0.5)));
      }
    }
    return total;
  }, 0);
}

// Helper function to calculate substitution gains for a resource
function calculateSubstitutionGains(resourceType: ResourceType, shops: Shop[]): number {
  const resourcesSubstitutingToThis = RESOURCE_ELASTICITY_PAIRS
    .filter(pair => pair.resource1 === resourceType || pair.resource2 === resourceType)
    .map(pair => pair.resource1 === resourceType ? pair.resource2 : pair.resource1);
  
  return resourcesSubstitutingToThis.reduce((total: number, otherType: string) => {
    const resourceAvgPrice = calculateAverageCityPrice(shops, resourceType);
    const otherAvgPrice = calculateAverageCityPrice(shops, otherType as ResourceType);
    
    if (resourceAvgPrice > 0 && otherAvgPrice > 0) {
      if (willSubstituteResource(otherType as ResourceType, resourceType, otherAvgPrice, resourceAvgPrice)) {
        const elasticity = RESOURCE_ELASTICITY_PAIRS.find(
          pair => (pair.resource1 === resourceType && pair.resource2 === otherType) ||
                (pair.resource1 === otherType && pair.resource2 === resourceType)
        )?.elasticity || 0;
        
        const actualRatio = otherAvgPrice / resourceAvgPrice;
        const referenceRatio = (RESOURCE_PRICE_RATIOS[otherType as ResourceType] || 1) / 
                              (RESOURCE_PRICE_RATIOS[resourceType] || 1);
        const ratioDifference = actualRatio / referenceRatio;
        
        const baseRate = DEFAULT_CONSUMPTION_RATES[otherType as ResourceType] || 0;
        return total + baseRate * Math.min(0.7, Math.max(0.3, elasticity) * 
                     Math.min(1.5, Math.max(1.0, ratioDifference - 1 + 0.5)));
      }
    }
    return total;
  }, 0);
}

/**
 * Calculate the substitution effect between two resources
 * 
 * @param primaryAvgPrice Average price of the primary resource
 * @param substituteAvgPrice Average price of the substitute resource
 * @param substitutionRatio How many units of the substitute equal one unit of primary
 * @param elasticity How sensitive consumers are to price differences
 * @returns The percentage of demand shifted to the substitute (0-1)
 */
export function calculateSubstitutionEffect(
  primaryAvgPrice: number,
  substituteAvgPrice: number,
  substitutionRatio: number,
  elasticity: number
): number {
  if (primaryAvgPrice <= 0 || substituteAvgPrice <= 0) return 0;

  // Calculate the effective price ratio considering substitution ratio
  // Normalize substitute price by the substitution ratio
  const normalizedSubstitutePrice = substituteAvgPrice / substitutionRatio;
  const priceRatio = normalizedSubstitutePrice / primaryAvgPrice;

  // Only substitute if the substitute is cheaper (after accounting for ratio)
  if (priceRatio >= 1) return 0;

  // Calculate the substitution effect using a custom formula
  // Higher elasticity means more aggressive substitution
  // The formula creates a sigmoid-like curve that accelerates as price difference increases
  const effect = Math.min(
    (1 - priceRatio) * elasticity,
    0.8 // Cap at 80% substitution to prevent total replacement
  );

  return Math.max(0, effect);
}

export const consumers = {
  calculatePriceEffect,
  calculateDemandCreationFactor,
  calculateSubstitutionEffect,
  simulateConsumption,
};

export default consumers;