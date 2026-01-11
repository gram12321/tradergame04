# Price Sensitivity Implementation Plan

## Current Status: INTEGRATED (Phase 3+)

The four economic concepts outlined in this plan have been integrated into the core engine via `City.ts`.

### 1. Inter-Retailer Price Sensitivity (STATUS: COMPLETE)
**Implemented in `City.processRetailDemand`**:
- Uses `INTER_RETAILER_SENSITIVITY` from `ResourceRegistry`.
- Formula: `demand_share = (avgPrice / retail_price)^sensitivity`.
- Includes per-retailer randomness (±5%) and demand shocks (5% chance).

### 2. Category-Based Budget Allocation (STATUS: PARTIAL/INTEGRATED)
**Implemented via Wealth and Population**:
- Base demand is scaled by `City.wealth` (0.8x to 1.5x).
- Total city demand is the starting point for all calculations.
- Below-average pricing creates "extra" demand (simulating budget allocation shifting to good deals).

### 3. Within-Category Substitution (STATUS: COMPLETE)
**Implemented via `CROSS_LEVEL_ELASTICITY`**:
- Bidirectional demand shifting between resources based on price deviations from `RESOURCE_PRICE_RATIOS`.
- If Bread is expensive relative to Flour, demand shifts from Bread to Flour.
- Net effect is balanced to maintain total city consumption logic.

### 4. Own-Price Elasticity (STATUS: INTEGRATED)
**Implemented via Demand Creation**:
- Retailers pricing below the city average create additional demand (market expansion).
- Dampened to minimum 5 retailers to prevent exploit in thin markets.
- Capped at 50% additional demand per retailer.

---

## Technical Framework (Integrated in `City.ts`)

### Layer 1: Base Demand Calculation
```typescript
baseDemand = population * consumptionRate * wealthMultiplier
```

### Layer 2: Substitution (Cross-Elasticity)
```typescript
shiftAmount = sourceDemand * deviation * elasticity * 0.5
// Shifts demand between related resources (e.g., Bread <-> Flour)
```

### Layer 3: Distribution & Competition
```typescript
weightedShare = (avgPrice / price)^sensitivity
// Distributes product demand among active retailers
```

---

