# Adding New Resources Guide

## Price Index Calculation

```
Price Index = ((Input Costs) + (Wage × Ticks × Workers)) / Output Quantity
```

Base wage = 1.0, multiply result by 100 for index.

**Examples:**
- **Grain**: (0 + 1×2×3) / 10 = 0.6 → **Index: 60**
- **Flour**: (2×0.6 + 1×1×3.5) / 10 = 0.47 → **Index: 47**  
- **Bread**: (20×0.47 + 1×1×3.5) / 1 = 12.9 → **Index: 129**
- **Grapes**: (0 + 1×2×3) / 8 = 0.75 → **Index: 75**
- **Wine**: (5×0.75 + 1×2×3) / 1 = 9.75 → **Index: 98**

## Consumption Rates

**Rule: Finished > Intermediate > Raw**

- Finished goods: 0.08 - 0.15 per pop/tick
- Intermediate: 0.02 - 0.05 per pop/tick
- Raw materials: 0.005 - 0.02 per pop/tick

Current: `grain: 0.01, flour: 0.03, bread: 0.10, grapes: 0.005, wine: 0.08`

## Multiple Recipes Per Facility

Facilities can support multiple recipes for dynamic production. Example:

**Farm:**
- **Grow Grain**: No inputs → 10 grain (2 ticks)
- **Grow Grapes**: No inputs → 8 grapes (2 ticks)

Configure in `FacilityRegistry.ts`:
```typescript
allowedRecipes: ['Grow Grain', 'Grow Grapes'],
defaultRecipe: 'Grow Grain'
```

Use the "Change Recipe" UI button to switch between recipes in-game.

## Adding a Resource

1. Define recipe in `RecipeRegistry.ts`
2. Calculate price index using formula above
3. Set consumption rate (finished > intermediate > raw)
4. Register in `ResourceRegistry.ts`:
   - Add resource definition
   - Add to `RESOURCE_PRICE_RATIOS`
   - Add to `DEFAULT_CONSUMPTION_RATES`
5. Update `FacilityRegistry.ts` if needed
6. Test production and pricing
