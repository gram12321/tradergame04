# Price Sensitivity Implementation Plan

## User's Original Request

### Inter-Retailer Competition (Currently Equal Distribution)
Not really implemented yet though. For now we just distribute equally, not taking notice of price. This needs a Formula for how quickly consumers will shift from Retail X to Retail Y as price difference raises. 

**Example**: For some product 10€ vs 8€ might cause a 20% difference (20% increase in price → 20% shift of consumers). For some other products it might be harder to shift. People will not go across city each day to buy bread, but may quickly shift from travel agency with a higher price.

### Price Elasticity of Demand
Here I want to point to an established microeconomic rule: **People WILL use their money**. If all retailers raise price for cars people don't just stop using their money, they buy cycles instead. 

So maybe this needs a two-way approach:
1. Each product has an **Elasticity of Demand** → How dramatically it will fall when price increases
2. Each product (or product category) needs an **"elasticity pair"** → If Bread becomes very expensive, consumers will buy more rice - not more cars. IE swaps essentials for essentials, not essentials for luxury.

### Essentiality / Income Priority
A bit of the same as above. If people skip low essential jewelry, they don't stop using money, they divert them to something else. 

**Not sure about the floor concept**:
- Low essentials: consumers might shift out for essentials (if money is short all income will go to bread, nothing to jewelry)
- High essentials: consumers will shift to replacement products (shift from bread to flour - bake themselves)

---

## Analysis & Solution Framework

### Core Principle: Money Doesn't Disappear, It Reallocates

We need to track WHERE consumer spending goes when prices change, not just that it decreases.

---

## Four Separate Economic Concepts

### 1. Inter-Retailer Price Sensitivity (Same Product, Same City)
**What it captures**: How aggressively consumers shop between retailers for the SAME product

**Levels**:
- **High (2.5)**: Travel packages, online goods - consumers compare every retailer
- **Medium (1.0)**: Electronics, furniture - some comparison shopping  
- **Low (0.3)**: Bread, milk - convenience/location dominates, minor price differences ignored

**Current Implementation**: Equal split (sensitivity = 0)

**Formula Needed**:
```
demand_share[retailX] = (avgPrice / retailX_price)^sensitivity
// Normalize so shares sum to 1
```

**Example**: Bread sensitivity=0.3, RetailX=$10, RetailY=$8
```
shareX = (9/10)^0.3 = 0.97
shareY = (9/8)^0.3 = 1.04
// Normalized: X gets 48%, Y gets 52% (only slight advantage despite 20% cheaper)
```

---

### 2. Category-Based Budget Allocation (Essentiality as Priority)
**What it captures**: When budget is tight, which CATEGORIES get money first?

**Not a floor** - it's an **allocation order**:

```typescript
enum ConsumerPriority {
  ESSENTIAL = 1,    // Food staples, medicine - allocated first
  NORMAL = 2,       // Clothing, furniture - allocated second  
  LUXURY = 3        // Jewelry, yachts - only if budget remains
}
```

**Mechanism**:
1. Calculate total city consumer budget: `population × income_per_capita`
2. Allocate to ESSENTIAL categories first (up to their demand)
3. Remaining budget → NORMAL categories
4. Remaining budget → LUXURY categories

If budget is tight, luxury demand drops to **zero** (but money goes elsewhere, not disappears)

---

### 3. Within-Category Substitution (Cross-Price Elasticity)
**What it captures**: When bread gets expensive, consumers buy rice instead (within same category)

```typescript
substitutionGroups = {
  'staple-foods': ['bread', 'flour', 'rice', 'potatoes'],
  'luxury-goods': ['jewelry', 'art', 'yachts'],
  'transport': ['cars', 'bicycles', 'public-transit']
}

crossElasticityMatrix = {
  'bread→rice': 0.8,   // If bread +10% price, rice demand +8%
  'bread→flour': 0.6,  // If bread +10% price, flour demand +6%
}
```

**Budget stays in category**, just shifts between products based on relative prices.

---

### 4. Own-Price Elasticity (Within-Category Demand Response)
**What it captures**: When bread price rises, how much does TOTAL staple-food spending change?

This is actually **category-level elasticity**, not product-level:
- **Staple foods**: Very inelastic (0.1) - people need to eat
- **Luxury goods**: Very elastic (2.5) - people defer/skip entirely

**Formula**:
```
category_demand = base_demand × (base_price / actual_price)^elasticity
```

Then distribute within category based on relative prices (substitution).

---

## Three-Layer System

### Layer 1: City Budget Allocation Across Categories
```
1. Calculate city budget = population × income
2. Allocate by priority:
   - ESSENTIAL categories: up to full demand
   - NORMAL categories: remaining budget
   - LUXURY categories: remaining budget
```

### Layer 2: Within-Category Substitution
```
1. Category has budget allocation
2. Distribute across products based on:
   - Base consumption rates
   - Relative prices (cheaper products get more)
   - Cross-elasticity coefficients
```

### Layer 3: Inter-Retailer Competition
```
1. Product has total demand in city
2. Distribute across retailers based on:
   - Relative prices
   - Inter-retailer sensitivity coefficient
```

---

## Phased Implementation Plan

### Phase 1 (Current): Equal Inter-Retailer Split ✓
- Demand splits equally among all retailers in city
- No price consideration

### Phase 2 (Next): Inter-Retailer Price Competition
- Add `INTER_RETAILER_SENSITIVITY` per resource
- Implement price-based demand redistribution within same product
- Retailers with lower prices get more customers

### Phase 3 (Later): Category System
- Define categories with priorities (Essential, Normal, Luxury)
- Add city income/budget tracking
- Implement category-level budget allocation

### Phase 4 (Future): Substitution
- Define substitution groups
- Implement cross-elasticity matrix
- Within-category demand shifting based on relative prices

---

## Simplified Naming Convention

1. **`priceCompetitiveness`**: Inter-retailer sensitivity (bread=0.3, electronics=1.5)
2. **`categoryPriority`**: Essential=1, Normal=2, Luxury=3
3. **`substitutionGroup`**: 'staple-foods', 'luxury-goods', etc.
4. **`categoryElasticity`**: How category spending responds to avg price (0.1-2.5)

---

## Key Insight

**Money always goes somewhere**. The floor concept is wrong - instead, it's about reallocation priorities and substitution patterns.

When consumers reduce spending on one good, they increase spending on:
- Cheaper retailers (same product)
- Substitute products (same category)
- Different categories (based on priority/budget constraints)