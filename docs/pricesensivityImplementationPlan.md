# Price Sensitivity & Demand Logic Documentation

## Status: FULLY IMPLEMENTED

This document describes the current implementation of economic logic within the game engine (`City.ts` and `ResourceRegistry.ts`).

---

### 1. Resource Classification (Refine Levels)
Resources are categorized by their processing level. This hierarchy is primarily used to determine **Substitution behavior** (see below).

*   **RAW**: Unprocessed farm output (e.g., `Grain`, `Grapes`, `Sugar`).
*   **INTERMEDIATE**: Simply processed goods (e.g., `Flour`).
*   **FINISHED**: Consumer-ready goods (e.g., `Bread`, `Wine`, `Cake`).

*Usage*: Consumers are more likely to substitute goods within the same level (e.g., swapping `Bread` for `Wine`) than across levels (staking `Bread` for `Grain`). This is controlled by the `CROSS_LEVEL_ELASTICITY` matrix.

### 2. Wealth Modification
Wealth directly impacts the **total volume** of goods consumed by a city, but it does not currently change the *mix* of goods.

*   **Implementation**: A global multiplier is applied to the base demand of **all** resources in a city.
    *   Multiplier Range: `0.8x` (Poor) to `1.5x` (Rich).
    *   Formula: `0.8 + (City.wealth * 0.7)`.
*   **Note on "Luxury" Logic**: In previous game iterations, individual agents would prioritize necessities (Bread) over luxuries (Wine) when money was tight. **This is NOT currently implemented.** In the current system, a poor city simply buys 20% less Bread *and* 20% less Wine than a standard city.

### 3. Price-Based Demand Expansion (Market Expansion)
The system **DOES** implement a mechanism where artificially low prices generate *new* demand (e.g., customers buying more than they need because it's a "steal").

*   **Implementation**:
    *   The engine calculates a "dampened average price" (prevents exploitation in markets with few sellers).
    *   If a retailer prices specifically **below** this average, they generate extra demand for themselves.
    *   **Cap**: This is capped at +50% additional demand per retailer to prevent infinite consumption loops.

### 4. Substitution (Cross-Elasticity)
Consumers will shift their budget between different products if price ratios get out of whack.

*   **Logic**: The game knows the "fair" price ratio between goods (e.g., Wine should be ~4x the price of Flour).
*   **Behavior**:
    *   If `Bread` becomes 2x more expensive than normal relative to `Flour`, consumers reduce Bread consumption and buy Flour instead.
    *   This is bidirectional and weighted by the **Refine Level** (Level 1). It is easier to switch between Finished goods than from Finished to Raw.

### 5. Inter-Retailer Competition
Once total demand for a specific resource (e.g., Bread) is calculated, it is distributed among the shops selling it.

*   **Logic**: `Share = (AveragePrice / YourPrice) ^ Sensitivity`
*   **Sensitivity**: Defined per resource.
    *   High Sensitivity (e.g., Wine): Customers aggressively flock to the cheapest seller.
    *   Low Sensitivity (e.g., Bread): Customers are more loyal/lazy; price differences matter less.

---

## Detailed Calculation Algorithm (from `City.ts`)

The `processRetailDemand()` function executes the following steps each tick:

1.  **Step 1: Calculate Base Demand**
    *   `Demand = Population * ConsumptionRate`
    *   Multiply by currently wealth factor (0.8x - 1.5x).

2.  **Step 2: Cross-Resource Substitution (Bidirectional)**
    *   Compare price ratios of all pairs of resources.
    *   If the price deviation > 2%, shift demand.
    *   Logs both *losses* (to substitutes) and *gains* (from other resources).
    *   Net effect is applied to balance demand.

3.  **Step 3: Demand Creation (Market Expansion)**
    *   Retailers pricing below city average create additional demand.
    *   **Anti-Gaming**: Dampened logic ensures a minimum of 5 retailers are used for "average" calculation to prevent exploiting thin markets. Only one retailer per company counts.

4.  **Step 4: Demand Shocks**
    *   5% chance per resource per tick.
    *   Randomly affects one retailer with ±15% demand shock.
    *   Loss/gain is distributed to other retailers.

5.  **Step 5: Distribution & Sales**
    *   **Phase A**: Calculate "Fair" Share.
    *   **Phase B**: Adjust share by price sensitivity: `(avgPrice / price)^sensitivity`.
        *   Apply ±5% randomness.
    *   **Phase C (First Pass)**: Each retailer sells up to their calculated share.
    *   **Phase D (Second Pass)**: Any Unfulfilled demand (because a shop ran out of stock) is redistributed to remaining shops with inventory.
