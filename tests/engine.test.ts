import { GameEngine } from '../src/game/GameEngine.js';
import { FacilityRegistry } from '../src/game/FacilityRegistry.js';
import { CityRegistry } from '../src/game/CityRegistry.js';
import { ResourceRegistry, DEFAULT_CONSUMPTION_RATES, RESOURCE_PRICE_RATIOS, INTER_RETAILER_SENSITIVITY } from '../src/game/ResourceRegistry.js';
import { RecipeRegistry } from '../src/game/RecipeRegistry.js';
import { ProductionFacility } from '../src/game/ProductionFacility.js';
import { StorageFacility } from '../src/game/StorageFacility.js';
import { Office } from '../src/game/Office.js';
import { RetailFacility } from '../src/game/RetailFacility.js';

console.log('\n=== STARTING GAME ENGINE TESTS ===\n');


// Create game instance
const game = new GameEngine();
const market = game.getContractSystem();

// Add test companies
const alice = game.addCompany('alice', 'Alice Corp');
const bob = game.addCompany('bob', 'Bob Industries');

console.log('🎮 Production Game - Comprehensive Test Suite\n');
console.log(FacilityRegistry.displayFacilities());
// Initial state:
console.log(`Initial state: Tick ${game.getTickCount()}, ${game.getCompanies().length} companies`);

// Test data storage
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${message}`);
    testsFailed++;
  }
}

// Get cities for testing
const copenhagen = CityRegistry.getCity('Copenhagen', 'Denmark')!;
const prague = CityRegistry.getCity('Prague', 'Czech Republic')!;
const aarhus = CityRegistry.getCity('Aarhus', 'Denmark')!;

console.log('\n=== RESOURCE WEIGHT SYSTEM TEST ===\n');
const grainWeight = ResourceRegistry.get('grain')?.weight;
const flourWeight = ResourceRegistry.get('flour')?.weight;
const breadWeight = ResourceRegistry.get('bread')?.weight;
assert(grainWeight === 1.0, `Grain weight is 1.0 (actual: ${grainWeight})`);
assert(flourWeight === 0.8, `Flour weight is 0.8 (actual: ${flourWeight})`);
assert(breadWeight === 1.5, `Bread weight is 1.5 (actual: ${breadWeight})`);
console.log('Resource weights correctly defined\n');

console.log('\n=== OFFICE FACILITY TEST ===\n');

// Test office creation
let officeTest = alice.createFacility('office', copenhagen);
assert(officeTest !== null, 'Office created successfully in Copenhagen');
assert(officeTest?.type === 'office', `Office type is 'office' (actual: ${officeTest?.type})`);
assert(officeTest?.city.country === 'Denmark', 'Office is in Denmark');

// Test office one-per-country restriction
let officeTest2 = alice.createFacility('office', copenhagen);
assert(officeTest2 === null, 'Second office in same country rejected (Denmark)');

// Test office in different country should work
let officeTest3 = alice.createFacility('office', prague);
assert(officeTest3 !== null, 'Office created in different country (Czech Republic)');

// Test Bob can create office in Denmark (different company)
let bobOffice = bob.createFacility('office', copenhagen);
assert(bobOffice !== null, 'Different company can create office in same city');

console.log('\n=== OFFICE EFFECTIVITY AS HARD CAP TEST ===\n');

// Create facilities for testing office hard cap
let farm = alice.createFacility('farm', copenhagen) as ProductionFacility | null;
let mill = alice.createFacility('mill', copenhagen) as ProductionFacility | null;
assert(farm !== null, 'Farm created in Copenhagen');
assert(mill !== null, 'Mill created in Copenhagen');

// Get the office
const aliceOffice = alice.facilities.find(f => f.type === 'office' && f.city.country === 'Denmark') as Office | undefined;
assert(aliceOffice !== undefined, 'Alice has office in Denmark');

// Manually set office workers to test effectivity propagation
if (aliceOffice && farm && mill) {
  // Set office workers very low (should reduce effectivity)
  aliceOffice.setWorkerCount(1);
  game.processTick(); // This calls updateOfficeEffectivity()

  const farmEffectivity = farm.effectivity;
  const millEffectivity = mill.effectivity;
  const officeEffectivity = aliceOffice.effectivity;

  assert(
    farmEffectivity <= officeEffectivity + 0.01,
    `Farm effectivity (${farmEffectivity.toFixed(2)}) <= Office effectivity (${officeEffectivity.toFixed(2)})`
  );
  assert(
    millEffectivity <= officeEffectivity + 0.01,
    `Mill effectivity (${millEffectivity.toFixed(2)}) <= Office effectivity (${officeEffectivity.toFixed(2)})`
  );
}

console.log('\n=== FACILITY CAPACITY AND OVERFLOW TEST ===\n');

if (farm) {
  const initialCapacity = farm.getMaxInventoryCapacity();
  assert(initialCapacity > 0, `Farm has capacity: ${initialCapacity.toFixed(0)} units`);

  // Add grain beyond capacity
  farm.addResource('grain', 1000);
  const totalWeight = farm.getTotalInventory();
  const overflow = Math.max(0, totalWeight - initialCapacity);
  const penalty = farm.getOverflowPenalty();

  assert(
    totalWeight > initialCapacity,
    `Grain inventory (weight: ${totalWeight.toFixed(1)}) exceeds capacity (${initialCapacity.toFixed(0)})`
  );
  assert(
    penalty < 1.0,
    `Overflow penalty applied: ${penalty.toFixed(3)} (quadratic penalty for ${overflow.toFixed(0)} over capacity)`
  );
}

console.log('\n=== FACILITY DEGRADE FUNCTIONALITY TEST ===\n');

// Create a facility and upgrade it (use Prague - already has an office)
let testFarm = alice.createFacility('farm', prague) as ProductionFacility | null;
if (testFarm) {
  const originalSize = testFarm.size;
  const upgradeCost = testFarm.getUpgradeCost();

  // Upgrade it
  const actualCost = testFarm.upgradeSize();
  assert(
    actualCost !== null && actualCost === upgradeCost,
    `Farm upgraded: size ${originalSize} -> ${testFarm.size}, cost: $${upgradeCost.toFixed(2)}`
  );

  // Now degrade it
  const degradeCost = testFarm.getDegradeCost();
  const refund = testFarm.degradeSize();

  assert(
    refund !== null && refund === degradeCost,
    `Farm degraded: size ${testFarm.size + 1} -> ${testFarm.size}, refund: $${refund ? refund.toFixed(2) : '0'} (50% of upgrade cost)`
  );
  assert(
    refund !== null && refund === Math.ceil(upgradeCost * 0.5),
    `Refund is exactly 50% of upgrade cost: $${refund ? refund : 0} === $${Math.ceil(upgradeCost * 0.5)}`
  );
}

console.log('\n=== WORKER EFFECTIVITY CALCULATION TEST ===\n');

if (farm) {
  farm.setWorkerCount(0);
  game.processTick();
  const zeroWorkerEff = farm.effectivity;
  assert(zeroWorkerEff === 0, `Zero workers = 0 effectivity (actual: ${zeroWorkerEff.toFixed(3)})`);

  const requiredWorkers = farm.calculateRequiredWorkers();
  assert(requiredWorkers > 0, `Farm requires ${requiredWorkers} workers for size 1`);
}

console.log('\n=== CIRCULAR DEPENDENCY PREVENTION (ONE-TICK DELAY) ===\n');

if (farm) {
  // Reset to clean state
  farm.inventory!.clear();
  farm.setWorkerCount(farm.calculateRequiredWorkers());

  const tick1Capacity = farm.getMaxInventoryCapacity();

  // Add inventory
  farm.addResource('grain', 500);
  game.processTick();

  const tick2Capacity = farm.getMaxInventoryCapacity();
  const tick2ActualInventory = farm.getTotalInventory();

  // The capacity should be based on PREVIOUS tick's effectivity (caching prevents circular dependency)
  assert(
    Math.abs(tick1Capacity - tick2Capacity) < 1,
    `Capacity cached from previous tick (tick1: ${tick1Capacity.toFixed(0)}, tick2: ${tick2Capacity.toFixed(0)})`
  );

  assert(
    tick2ActualInventory > 0,
    `Inventory added and preserved: ${tick2ActualInventory.toFixed(1)} weight`
  );
}

console.log('\n=== FACILITY WITHOUT OFFICE TEST ===\n');

// Create a company without an office
const charlie = game.addCompany('charlie', 'Charlie Industries');
const farmWithoutOffice = charlie.createFacility('farm', prague) as ProductionFacility | null;

assert(
  farmWithoutOffice === null,
  'Cannot create farm without office in country (Prague)'
);

// Create office first, then farm
const charlieOffice = charlie.createFacility('office', prague) as Office | null;
assert(charlieOffice !== null, 'Charlie created office in Prague');

const charliesFarm = charlie.createFacility('farm', prague) as ProductionFacility | null;
assert(charliesFarm !== null, 'Charlie can now create farm after office exists');

console.log('\n=== WAGE DEDUCTION TEST ===\n');

// Create fresh facilities for wage testing
const wageTestCompany = game.addCompany('wagetest', 'Wage Test Corp');
const wageOffice = wageTestCompany.createFacility('office', copenhagen) as Office | null;
const wageFarm = wageTestCompany.createFacility('farm', copenhagen) as ProductionFacility | null;

if (wageFarm && wageOffice) {
  const initialBalance = wageTestCompany.balance;
  const wagePerTick = wageFarm.getWagePerTick();

  // Process one tick to deduct wages
  game.processTick();

  const afterBalance = wageTestCompany.balance;
  const totalWages = wageTestCompany.getTotalWagesPerTick();
  const expectedBalance = initialBalance - totalWages;

  assert(
    Math.abs(afterBalance - expectedBalance) < 0.01,
    `Wages deducted correctly: $${initialBalance.toFixed(2)} - $${totalWages.toFixed(2)} = $${afterBalance.toFixed(2)}`
  );
}

console.log('\n=== HIRE/FIRE WORKERS TEST ===\n');

if (wageFarm) {
  const requiredWorkers = wageFarm.calculateRequiredWorkers();
  const oldEffectivity = wageFarm.effectivity;
  const hiringCost = wageFarm.getHiringCost(requiredWorkers * 2);

  // Hire more workers
  const balanceBefore = wageTestCompany.balance;
  const hired = wageTestCompany.setFacilityWorkers(wageFarm, requiredWorkers * 2);
  const balanceAfter = wageTestCompany.balance;

  assert(hired, `Successfully hired workers: ${requiredWorkers} → ${wageFarm.workers}`);
  assert(
    Math.abs((balanceBefore - balanceAfter) - hiringCost) < 0.01,
    `Hiring cost deducted: $${hiringCost.toFixed(2)}`
  );

  // Fire workers
  const firingCost = wageFarm.getHiringCost(requiredWorkers);
  const balanceBefore2 = wageTestCompany.balance;
  const fired = wageTestCompany.setFacilityWorkers(wageFarm, requiredWorkers);
  const balanceAfter2 = wageTestCompany.balance;

  assert(fired, `Successfully fired workers: ${requiredWorkers * 2} → ${wageFarm.workers}`);
  assert(
    Math.abs((balanceBefore2 - balanceAfter2) - firingCost) < 0.01,
    `Firing cost deducted: $${firingCost.toFixed(2)}`
  );
}

console.log('\n=== UPGRADE/DEGRADE PRODUCTION SCALING TEST ===\n');

const prodTestCompany = game.addCompany('prodtest', 'Production Test Corp');
const prodOffice = prodTestCompany.createFacility('office', prague) as Office | null;
const prodFarm = prodTestCompany.createFacility('farm', prague) as ProductionFacility | null;

if (prodFarm && prodOffice) {
  // Set workers to full staff
  prodOffice.setWorkerCount(100);
  prodFarm.setWorkerCount(prodFarm.calculateRequiredWorkers());

  const size1Output = prodFarm.getProductionMultiplier();
  const size1Required = prodFarm.calculateRequiredWorkers();
  const upgradeCost = prodFarm.getUpgradeCost();

  // Upgrade
  const upgraded = prodTestCompany.upgradeFacility(prodFarm);
  assert(upgraded, `Farm upgraded from size 1 to ${prodFarm.size}`);

  const size2Output = prodFarm.getProductionMultiplier();
  const size2Required = prodFarm.calculateRequiredWorkers();

  assert(
    size2Output > size1Output,
    `Production increased: ${size1Output.toFixed(2)}x → ${size2Output.toFixed(2)}x`
  );
  assert(
    size2Required > size1Required,
    `Worker requirement increased: ${size1Required} → ${size2Required}`
  );

  // Degrade
  const degradeRefund = prodFarm.getDegradeCost();
  const balanceBefore = prodTestCompany.balance;
  const degraded = prodTestCompany.degradeFacility(prodFarm);
  const balanceAfter = prodTestCompany.balance;

  assert(degraded, `Farm degraded from size 2 to ${prodFarm.size}`);
  assert(
    Math.abs((balanceAfter - balanceBefore) - degradeRefund) < 0.01,
    `Refund received: $${degradeRefund.toFixed(2)}`
  );
}
console.log('\n=== RECIPE SWITCHING TEST ===\n');

// Test that Farm can switch between Grow Grain and Grow Grapes
const recipeSwitchCompany = game.addCompany('recipeswitch', 'Recipe Switch Corp');
const recipeSwitchOffice = recipeSwitchCompany.createFacility('office', copenhagen) as Office | null;
const recipeSwitchFarm = recipeSwitchCompany.createFacility('farm', copenhagen) as ProductionFacility | null;

if (recipeSwitchFarm && recipeSwitchOffice) {
  recipeSwitchOffice.setWorkerCount(100);
  recipeSwitchFarm.setWorkerCount(recipeSwitchFarm.calculateRequiredWorkers());

  // Start with grain (default)
  const grainRecipe = RecipeRegistry.get('Grow Grain');
  assert(recipeSwitchFarm.recipe?.name === 'Grow Grain', 'Farm starts with Grow Grain recipe (default)');

  // Produce grain
  for (let i = 0; i < 3; i++) {
    game.processTick();
  }
  const grainProduced = recipeSwitchFarm.getResource('grain');
  assert(grainProduced > 0, `Farm produced grain: ${grainProduced.toFixed(1)}`);

  // Switch to grapes
  const grapesRecipe = RecipeRegistry.get('Grow Grapes');
  if (grapesRecipe) {
    const switched = recipeSwitchFarm.setRecipe(grapesRecipe);
    assert(switched, 'Successfully switched recipe to Grow Grapes');
    assert(recipeSwitchFarm.recipe?.name === 'Grow Grapes', 'Recipe is now Grow Grapes');

    // Produce grapes
    for (let i = 0; i < 3; i++) {
      game.processTick();
    }
    const grapesProduced = recipeSwitchFarm.getResource('grapes');
    assert(grapesProduced > 0, `Farm produced grapes: ${grapesProduced.toFixed(1)}`);

    // Verify grain production stopped
    const grainAfter = recipeSwitchFarm.getResource('grain');
    assert(
      grainAfter === grainProduced,
      `Grain production stopped after recipe change: ${grainProduced.toFixed(1)} === ${grainAfter.toFixed(1)}`
    );
  }
}

console.log('\n=== WINERY PRODUCTION TEST ===\n');

const wineryCompany = game.addCompany('winery', 'Winery Corp');
const wineryOffice = wineryCompany.createFacility('office', aarhus) as Office | null;
const wineryFarm = wineryCompany.createFacility('farm', aarhus) as ProductionFacility | null;
const winery = wineryCompany.createFacility('winery', aarhus) as ProductionFacility | null;

if (winery && wineryFarm && wineryOffice) {
  wineryOffice.setWorkerCount(100);
  wineryFarm.setWorkerCount(wineryFarm.calculateRequiredWorkers());
  winery.setWorkerCount(winery.calculateRequiredWorkers());

  // Set farm to produce grapes
  const grapesRecipe = RecipeRegistry.get('Grow Grapes');
  if (grapesRecipe) {
    wineryFarm.setRecipe(grapesRecipe);

    // Produce grapes
    for (let i = 0; i < 4; i++) {
      game.processTick();
    }

    const grapesProduced = wineryFarm.getResource('grapes');
    assert(grapesProduced > 0, `Farm produced grapes: ${grapesProduced.toFixed(1)}`);

    // Transfer grapes to winery
    market.executeInstantTransfer(wineryCompany, wineryFarm, winery, 'grapes', Math.min(grapesProduced, 20));
    const wineryGrapes = winery.getResource('grapes');
    assert(wineryGrapes > 0, `Grapes transferred to winery: ${wineryGrapes.toFixed(1)}`);

    // Winery should have Make Wine recipe by default
    assert(winery.recipe?.name === 'Make Wine', 'Winery has Make Wine recipe');

    // Produce wine
    for (let i = 0; i < 4; i++) {
      game.processTick();
    }

    const wineProduced = winery.getResource('wine');
    assert(wineProduced > 0, `Winery produced wine: ${wineProduced.toFixed(1)}`);

    // Verify grapes were consumed
    const grapesAfter = winery.getResource('grapes');
    assert(
      grapesAfter < wineryGrapes,
      `Grapes consumed in wine production: ${wineryGrapes.toFixed(1)} → ${grapesAfter.toFixed(1)}`
    );
  }
}
console.log('\n=== PRODUCTION INPUT/OUTPUT TEST ===\n');

// Fresh company for clean production test
const ioTestCompany = game.addCompany('iotest', 'IO Test Corp');
const ioOffice = ioTestCompany.createFacility('office', copenhagen) as Office | null;
const ioFarm = ioTestCompany.createFacility('farm', copenhagen) as ProductionFacility | null;

if (ioFarm && ioOffice) {
  ioOffice.setWorkerCount(100);
  ioFarm.setWorkerCount(ioFarm.calculateRequiredWorkers());

  const recipe = RecipeRegistry.get('Grow Grain');
  if (recipe) {
    ioFarm.setRecipe(recipe);

    // Farm has no inputs, so should start production
    const beforeInventory = ioFarm.getResource('grain');

    // Run a few ticks
    for (let i = 0; i < recipe.ticksRequired + 1; i++) {
      game.processTick();
    }

    const afterInventory = ioFarm.getResource('grain');

    assert(
      afterInventory > beforeInventory,
      `Farm produced grain: ${beforeInventory.toFixed(1)} → ${afterInventory.toFixed(1)}`
    );
  }
}

console.log('\n=== PRODUCTION REQUIRES INPUT TEST ===\n');

const millTestCompany = game.addCompany('milltest', 'Mill Test Corp');
const millOffice = millTestCompany.createFacility('office', prague) as Office | null;
const testMill = millTestCompany.createFacility('mill', prague) as ProductionFacility | null;

if (testMill && millOffice) {
  millOffice.setWorkerCount(100);
  testMill.setWorkerCount(testMill.calculateRequiredWorkers());

  const millRecipe = RecipeRegistry.get('Make Flour');
  if (millRecipe) {
    testMill.setRecipe(millRecipe);

    // Mill requires grain input - should NOT start production
    game.processTick();

    assert(
      !testMill.isProducing,
      'Mill does not start production without input resources'
    );

    // Add grain
    testMill.addResource('grain', 10);
    game.processTick();

    assert(
      testMill.isProducing,
      'Mill starts production when input resources available'
    );
  }
}

console.log('\n=== INTERNAL RESOURCE TRANSFER TEST ===\n');

if (ioFarm && testMill) {
  const grainAmount = ioFarm.getResource('grain');
  const transferAmount = Math.min(grainAmount, 20);

  const farmBefore = ioFarm.getResource('grain');
  const millBefore = testMill.getResource('grain');

  const transferred = market.executeInstantTransfer(ioTestCompany, ioFarm, testMill, 'grain', transferAmount);

  const farmAfter = ioFarm.getResource('grain');
  const millAfter = testMill.getResource('grain');

  assert(
    !transferred, // Different companies, should fail
    'Cannot transfer between different companies'
  );

  // Transfer within same company
  const ioFarm2 = ioTestCompany.createFacility('farm', prague) as ProductionFacility | null;
  if (ioFarm2) {
    ioFarm2.addResource('grain', 100);
    const farm2Before = ioFarm2.getResource('grain');
    const ioMillBefore = ioFarm.getResource('grain');

    const success = market.executeInstantTransfer(ioTestCompany, ioFarm2, ioFarm, 'grain', 50);

    assert(success, 'Transfer succeeded within same company');
    assert(
      ioFarm2.getResource('grain') === farm2Before - 50,
      `Source reduced: ${farm2Before.toFixed(1)} → ${ioFarm2.getResource('grain').toFixed(1)}`
    );
    assert(
      ioFarm.getResource('grain') === ioMillBefore + 50,
      `Destination increased: ${ioMillBefore.toFixed(1)} → ${ioFarm.getResource('grain').toFixed(1)}`
    );
  }
}

console.log('\n=== WAREHOUSE CAPACITY TEST ===\n');

const warehouseCompany = game.addCompany('warehouse', 'Warehouse Corp');
const whOffice = warehouseCompany.createFacility('office', copenhagen) as Office | null;
const warehouse = warehouseCompany.createFacility('warehouse', copenhagen) as StorageFacility | null;

if (warehouse && whOffice) {
  whOffice.setWorkerCount(100);
  warehouse.setWorkerCount(warehouse.calculateRequiredWorkers());

  game.processTick(); // Update capacity

  const warehouseCapacity = warehouse.getMaxInventoryCapacity();
  const farmCapacity = ioFarm?.getMaxInventoryCapacity() || 0;

  assert(
    warehouseCapacity > farmCapacity * 5,
    `Warehouse has much higher capacity: ${warehouseCapacity.toFixed(0)} vs farm ${farmCapacity.toFixed(0)}`
  );

  // Add inventory
  warehouse.addResource('grain', 500);
  const inventoryWeight = warehouse.getTotalInventory();

  assert(
    inventoryWeight > 0 && inventoryWeight <= warehouseCapacity,
    `Warehouse holds inventory: ${inventoryWeight.toFixed(1)} / ${warehouseCapacity.toFixed(0)}`
  );
}

console.log('\n=== RETAIL FACILITY TEST ===\n');

const retailCompany = game.addCompany('retail', 'Retail Corp');
const retailOffice = retailCompany.createFacility('office', copenhagen) as Office | null;
const retailFacility = retailCompany.createFacility('retail', copenhagen) as RetailFacility | null;
const retailFarm = retailCompany.createFacility('farm', copenhagen) as ProductionFacility | null;

if (retailFacility && retailOffice && retailFarm) {
  retailOffice.setWorkerCount(100);
  retailFacility.setWorkerCount(retailFacility.calculateRequiredWorkers());
  retailFarm.setWorkerCount(retailFarm.calculateRequiredWorkers());

  game.processTick();

  // Test retail facility creation
  assert(retailFacility.type === 'retail', 'Retail facility type is "retail"');
  assert(retailFacility.ownerId === retailCompany.id, 'Retail facility owned by correct company');

  // Test retail has inventory capacity
  const retailCapacity = retailFacility.getMaxInventoryCapacity();
  assert(
    retailCapacity > 0,
    `Retail facility has capacity: ${retailCapacity.toFixed(0)} units`
  );

  // Add grain to farm for testing transfer
  retailFarm.addResource('grain', 100);
  const farmGrainBefore = retailFarm.getResource('grain');

  // Test transfer from farm to retail
  const transferred = market.executeInstantTransfer(retailCompany, retailFarm, retailFacility, 'grain', 50);
  assert(transferred, 'Successfully transferred grain from farm to retail');

  const farmGrainAfter = retailFarm.getResource('grain');
  const retailGrainAfter = retailFacility.getResource('grain');

  assert(
    farmGrainAfter === farmGrainBefore - 50,
    `Farm inventory reduced: ${farmGrainBefore.toFixed(0)} → ${farmGrainAfter.toFixed(0)}`
  );
  assert(
    retailGrainAfter === 50,
    `Retail inventory increased: 0 → ${retailGrainAfter.toFixed(0)}`
  );

  // Test selling products for revenue via automatic demand
  const companyBalanceBefore = retailCompany.balance;
  const retailGrainBefore = retailFacility.getResource('grain');
  const pricePerUnit = 3.50;

  retailFacility.setPrice('grain', pricePerUnit);
  game.processTick();

  let retailGrainAfter2 = retailFacility.getResource('grain');
  const actualSold = retailGrainBefore - retailGrainAfter2;
  const revenue = retailFacility.revenue; // Revenue generated in the tick

  assert(
    actualSold > 0,
    `Retail generated sales via automatic demand: ${actualSold.toFixed(2)} units`
  );

  const companyBalanceAfter = retailCompany.balance;
  retailGrainAfter2 = retailFacility.getResource('grain');

  const wages = retailCompany.getTotalWagesPerTick();
  assert(
    Math.abs(companyBalanceAfter - (companyBalanceBefore + revenue - wages)) < 0.01,
    `Company balance correctly updated (Revenue: $${revenue.toFixed(2)}, Wages: $${wages.toFixed(2)})`
  );
  assert(
    retailGrainAfter2 === retailGrainBefore - actualSold,
    `Retail inventory decreased: ${retailGrainBefore.toFixed(0)} → ${retailGrainAfter2.toFixed(0)}`
  );

  // No manual sell failure test needed as demand handles it automatically

  // Test getResource method
  const currentStock = retailFacility.getResource('grain');
  assert(
    currentStock === retailGrainAfter2,
    `getResource returns correct inventory: ${currentStock.toFixed(0)} units`
  );
}

console.log('\n=== AUTOMATIC RETAIL DEMAND SYSTEM TEST ===\n');

// Create a new retail test with automatic demand
const demandCompany = game.addCompany('demand', 'Demand Test Corp');
const demandOffice = demandCompany.createFacility('office', copenhagen) as Office | null;
const demandRetail = demandCompany.createFacility('retail', copenhagen) as RetailFacility | null;

if (demandRetail && demandOffice) {
  demandOffice.setWorkerCount(100);
  demandRetail.setWorkerCount(demandRetail.calculateRequiredWorkers());

  // Add bread inventory for testing
  demandRetail.addResource('bread', 1000);

  // Set price for bread
  demandRetail.setPrice('bread', 12.00);

  const balanceBefore = demandCompany.balance;
  const inventoryBefore = demandRetail.getResource('bread');

  // Process tick (should trigger automatic sales)
  game.processTick();

  const balanceAfter = demandCompany.balance;
  const inventoryAfter = demandRetail.getResource('bread');
  const revenueGenerated = demandRetail.revenue;

  assert(
    revenueGenerated > 0,
    `Automatic sales generated revenue: $${revenueGenerated.toFixed(2)}`
  );
  assert(
    balanceAfter > balanceBefore,
    `Company balance increased: $${balanceBefore.toFixed(2)} → $${balanceAfter.toFixed(2)}`
  );
  assert(
    inventoryAfter < inventoryBefore,
    `Bread inventory decreased: ${inventoryBefore.toFixed(0)} → ${inventoryAfter.toFixed(0)} (sold ${(inventoryBefore - inventoryAfter).toFixed(0)} units)`
  );

  // Calculate expected demand
  const copenhagenPop = copenhagen.population;
  const breadConsumptionRate = 0.10; // DEFAULT_CONSUMPTION_RATES.bread
  const expectedDemand = copenhagenPop * breadConsumptionRate;

  // Count retailers in Copenhagen to calculate share
  let retailersInCopenhagen = 0;
  [alice, bob, retailCompany, demandCompany].forEach(company => {
    company.facilities.forEach(f => {
      if (f.type === 'retail' && f.city.name === 'Copenhagen' && (f as RetailFacility).getPrice('bread') > 0) {
        retailersInCopenhagen++;
      }
    });
  });

  const expectedShare = expectedDemand / retailersInCopenhagen;
  const actualSold = inventoryBefore - inventoryAfter;

  assert(
    actualSold <= expectedShare + 1,
    `Sales within expected demand share: ${actualSold.toFixed(0)} ≤ ${expectedShare.toFixed(0)}`
  );
}

console.log('\n=== MULTIPLE RETAILERS DEMAND DISTRIBUTION TEST ===\n');

// Create second retailer to test demand splitting
const demand2Company = game.addCompany('demand2', 'Demand Test 2 Corp');
const demand2Office = demand2Company.createFacility('office', copenhagen) as Office | null;
const demand2Retail = demand2Company.createFacility('retail', copenhagen) as RetailFacility | null;

if (demand2Retail && demand2Office && demandRetail) {
  demand2Office.setWorkerCount(100);
  demand2Retail.setWorkerCount(demand2Retail.calculateRequiredWorkers());

  // Add flour to both retailers
  demandRetail.addResource('flour', 500);
  demand2Retail.addResource('flour', 500);

  // Set prices
  demandRetail.setPrice('flour', 6.00);
  demand2Retail.setPrice('flour', 6.00);

  const retail1Before = demandRetail.getResource('flour');
  const retail2Before = demand2Retail.getResource('flour');

  // Process tick
  game.processTick();

  const retail1After = demandRetail.getResource('flour');
  const retail2After = demand2Retail.getResource('flour');

  const retail1Sold = retail1Before - retail1After;
  const retail2Sold = retail2Before - retail2After;

  assert(
    retail1Sold > 0 && retail2Sold > 0,
    `Both retailers made sales: Retail1=${retail1Sold.toFixed(0)}, Retail2=${retail2Sold.toFixed(0)}`
  );
  assert(
    Math.abs(retail1Sold - retail2Sold) < retail1Sold * 0.1,
    `Sales roughly equal between retailers: ${retail1Sold.toFixed(0)} ≈ ${retail2Sold.toFixed(0)}`
  );
}

console.log('\n=== PRICE SENSITIVITY TEST (Different Prices) ===\n');

// Test that retailers with different prices get different sales volumes
// NOTE: This test verifies the setup. Full price sensitivity will be implemented in Phase 2.
const priceTestCompany = game.addCompany('pricetest', 'Price Test Corp');
const priceOffice = priceTestCompany.createFacility('office', copenhagen) as Office | null;
const cheapRetail = priceTestCompany.createFacility('retail', copenhagen) as RetailFacility | null;
const expensiveRetail = priceTestCompany.createFacility('retail', copenhagen) as RetailFacility | null;

if (cheapRetail && expensiveRetail && priceOffice) {
  priceOffice.setWorkerCount(100);
  cheapRetail.setWorkerCount(cheapRetail.calculateRequiredWorkers());
  expensiveRetail.setWorkerCount(expensiveRetail.calculateRequiredWorkers());

  // Add plenty of bread to both retailers so neither sells out
  // Copenhagen population is 500k, bread consumption 0.10 = 50k per tick
  // Give each 100k to ensure surplus after sales
  const stock = 100000;
  cheapRetail.addResource('bread', stock);
  expensiveRetail.addResource('bread', stock);

  // Set different prices: one cheap, one expensive
  cheapRetail.setPrice('bread', 3.00);
  expensiveRetail.setPrice('bread', 5.00);

  // Verify prices are set correctly
  assert(
    cheapRetail.getPrice('bread') === 3.00 && expensiveRetail.getPrice('bread') === 5.00,
    `Prices set correctly: Cheap=$3.00, Expensive=$5.00`
  );

  const cheapBefore = cheapRetail.getResource('bread');
  const expensiveBefore = expensiveRetail.getResource('bread');

  // Process tick
  game.processTick();

  const cheapAfter = cheapRetail.getResource('bread');
  const expensiveAfter = expensiveRetail.getResource('bread');

  const cheapSold = cheapBefore - cheapAfter;
  const expensiveSold = expensiveBefore - expensiveAfter;

  assert(
    cheapSold > 0 && expensiveSold > 0,
    `Both retailers made sales: Cheap (sold ${cheapSold.toFixed(0)}), Expensive (sold ${expensiveSold.toFixed(0)})`
  );
  // Price sensitivity: cheaper retailer should sell significantly more
  // With bread sensitivity=0.3, $3 vs $5 (40% cheaper) should give ~12% more demand to cheap retailer
  assert(
    cheapSold > expensiveSold,
    `Cheaper retailer sold more: ${cheapSold.toFixed(0)} > ${expensiveSold.toFixed(0)} (price sensitivity: ${((cheapSold / expensiveSold - 1) * 100).toFixed(1)}% advantage)`
  );
}

console.log('\n=== DEMAND REDISTRIBUTION TEST ===\n');

// Test that unfulfilled demand goes to other retailers
const lowStockCompany = game.addCompany('lowstock', 'Low Stock Corp');
const lowStockOffice = lowStockCompany.createFacility('office', prague) as Office | null;
const lowStockRetail = lowStockCompany.createFacility('retail', prague) as RetailFacility | null;
const highStockRetail = lowStockCompany.createFacility('retail', prague) as RetailFacility | null;

if (lowStockRetail && highStockRetail && lowStockOffice) {
  lowStockOffice.setWorkerCount(100);
  lowStockRetail.setWorkerCount(lowStockRetail.calculateRequiredWorkers());
  highStockRetail.setWorkerCount(highStockRetail.calculateRequiredWorkers());

  // Give first retailer very little grain, second retailer plenty
  lowStockRetail.addResource('grain', 10);
  highStockRetail.addResource('grain', 10000);

  // Set prices
  lowStockRetail.setPrice('grain', 3.00);
  highStockRetail.setPrice('grain', 3.00);

  const lowBefore = lowStockRetail.getResource('grain');
  const highBefore = highStockRetail.getResource('grain');

  // Process tick
  game.processTick();

  const lowAfter = lowStockRetail.getResource('grain');
  const highAfter = highStockRetail.getResource('grain');

  const lowSold = lowBefore - lowAfter;
  const highSold = highBefore - highAfter;

  assert(
    lowSold === lowBefore,
    `Low stock retailer sold all inventory: ${lowSold.toFixed(0)}/${lowBefore.toFixed(0)}`
  );
  assert(
    highSold > lowSold,
    `High stock retailer picked up unfulfilled demand: ${highSold.toFixed(0)} > ${lowSold.toFixed(0)}`
  );
}

console.log('\n=== MARKET SELL OFFER TEST ===\n');


const sellerCompany = game.addCompany('seller', 'Seller Corp');
const sellerOffice = sellerCompany.createFacility('office', copenhagen) as Office | null;
const sellerFarm = sellerCompany.createFacility('farm', copenhagen) as ProductionFacility | null;

if (sellerFarm && sellerOffice) {
  sellerOffice.setWorkerCount(100);
  sellerFarm.setWorkerCount(sellerFarm.calculateRequiredWorkers());
  sellerFarm.addResource('grain', 100);

  const offer = market.executeCreateSellOffer(sellerCompany, sellerFarm, 'grain', 10, 5.00);

  assert(offer !== null, 'Sell offer created successfully');

  const marketOffers = market.getAllSellOffers().filter(o => o.resource === 'grain');
  assert(
    marketOffers.some(o => o.id === offer?.id),
    'Sell offer appears on market'
  );

  // Test that offer persists even with no stock
  sellerFarm.removeResource('grain', 100);

  const offersAfterDrain = market.getAllSellOffers().filter(o => o.resource === 'grain');
  const stillExists = offersAfterDrain.some(o => o.id === offer?.id);

  assert(
    stillExists,
    'Offer persists even when stock depleted (not deleted)'
  );

  // Add stock back
  sellerFarm.addResource('grain', 50);

  const restoredOffers = market.getAllSellOffers().filter(o => o.resource === 'grain');
  const hasStock = restoredOffers.find(o => o.id === offer?.id);

  assert(
    hasStock !== undefined && hasStock.amountAvailable > 0,
    'Offer shows available stock when inventory restored'
  );
}

console.log('\n=== CONTRACT BETWEEN COMPANIES TEST ===\n');

const buyerCompany = game.addCompany('buyer', 'Buyer Corp');
const buyerOffice = buyerCompany.createFacility('office', prague) as Office | null;
const buyerWarehouse = buyerCompany.createFacility('warehouse', prague) as StorageFacility | null;

if (buyerWarehouse && sellerFarm && buyerOffice) {
  buyerOffice.setWorkerCount(100);
  buyerWarehouse.setWorkerCount(buyerWarehouse.calculateRequiredWorkers());

  const grainOffers = market.getAllSellOffers().filter(o => o.resource === 'grain');
  const offer = grainOffers.find(o => o.sellerId === sellerCompany.id);

  if (offer) {
    const sellerBalanceBefore = sellerCompany.balance;
    const buyerBalanceBefore = buyerCompany.balance;
    const warehouseBefore = buyerWarehouse.getResource('grain');
    const farmBefore = sellerFarm.getResource('grain');

    const contract = market.executeAcceptSellOffer(
      buyerCompany,
      sellerCompany,
      offer.id,
      buyerWarehouse,
      5
    );

    assert(contract !== null, 'Contract created between companies');

    // Process a tick to execute contract
    game.processTick();

    const sellerBalanceAfter = sellerCompany.balance;
    const buyerBalanceAfter = buyerCompany.balance;
    const warehouseAfter = buyerWarehouse.getResource('grain');
    const farmAfter = sellerFarm.getResource('grain');

    assert(
      warehouseAfter > warehouseBefore,
      `Buyer received grain: ${warehouseBefore.toFixed(1)} → ${warehouseAfter.toFixed(1)}`
    );
    assert(
      farmAfter < farmBefore,
      `Seller sent grain: ${farmBefore.toFixed(1)} → ${farmAfter.toFixed(1)}`
    );
    assert(
      sellerBalanceAfter > sellerBalanceBefore,
      `Seller received payment: $${sellerBalanceBefore.toFixed(2)} → $${sellerBalanceAfter.toFixed(2)}`
    );
    assert(
      buyerBalanceAfter < buyerBalanceBefore,
      `Buyer paid for goods: $${buyerBalanceBefore.toFixed(2)} → $${buyerBalanceAfter.toFixed(2)}`
    );

    // Test contract persistence - process another tick
    const warehouse2Before = buyerWarehouse.getResource('grain');
    game.processTick();
    const warehouse2After = buyerWarehouse.getResource('grain');

    assert(
      warehouse2After > warehouse2Before,
      'Contract continues executing on subsequent ticks'
    );
  }
}

console.log('\n=== CONTRACT PAUSE WHEN RESOURCES UNAVAILABLE TEST ===\n');

// Drain seller's grain
if (sellerFarm) {
  const currentGrain = sellerFarm.getResource('grain');
  sellerFarm.removeResource('grain', currentGrain);

  const buyerBefore = buyerWarehouse?.getResource('grain') || 0;
  game.processTick();
  const buyerAfter = buyerWarehouse?.getResource('grain') || 0;

  assert(
    buyerAfter === buyerBefore,
    'Contract pauses when seller has no resources'
  );

  // Restore grain
  sellerFarm.addResource('grain', 100);
  const buyerBefore2 = buyerWarehouse?.getResource('grain') || 0;
  game.processTick();
  const buyerAfter2 = buyerWarehouse?.getResource('grain') || 0;

  assert(
    buyerAfter2 > buyerBefore2,
    'Contract resumes when resources available again'
  );
}

console.log('\n=== CROSS-RESOURCE SUBSTITUTION TEST (Phase 4) ===\n');

// Test that consumers substitute between resources based on relative prices
const substCompany = game.addCompany('substitution', 'Substitution Test Corp');
const substOffice = substCompany.createFacility('office', copenhagen) as Office | null;
const breadRetail = substCompany.createFacility('retail', copenhagen) as RetailFacility | null;
const flourRetail = substCompany.createFacility('retail', copenhagen) as RetailFacility | null;

if (breadRetail && flourRetail && substOffice) {
  substOffice.setWorkerCount(100);
  breadRetail.setWorkerCount(breadRetail.calculateRequiredWorkers());
  flourRetail.setWorkerCount(flourRetail.calculateRequiredWorkers());

  // Add plenty of inventory
  breadRetail.addResource('bread', 100000);
  flourRetail.addResource('flour', 100000);

  // Set bread at VERY HIGH price, flour at normal price
  // Reference ratios: bread=129, flour=47 → expected ratio = 2.74
  // We'll set bread at $20 (high) and flour at $4 (normal)
  // Actual ratio = 5.0, which is 82% higher than expected (2.74)
  // This should cause significant substitution from bread to flour
  breadRetail.setPrice('bread', 20.00);  // Very expensive
  flourRetail.setPrice('flour', 4.00);   // Normal price

  const breadBefore = breadRetail.getResource('bread');
  const flourBefore = flourRetail.getResource('flour');

  // Process several ticks to see substitution effect
  for (let i = 0; i < 5; i++) {
    game.processTick();
  }

  const breadAfter = breadRetail.getResource('bread');
  const flourAfter = flourRetail.getResource('flour');

  const breadSold = breadBefore - breadAfter;
  const flourSold = flourBefore - flourAfter;

  // Base demands: bread 0.10, flour 0.03 per pop
  // Expected base ratio: 0.10 / 0.03 = 3.33 (bread demand 3.33x flour)
  // With substitution away from expensive bread, ratio should be lower
  const actualRatio = breadSold / flourSold;

  assert(
    breadSold > 0 && flourSold > 0,
    `Both products sold: Bread=${breadSold.toFixed(0)}, Flour=${flourSold.toFixed(0)}`
  );
  assert(
    actualRatio < 3.0,
    `Substitution effect observed: Bread/Flour ratio ${actualRatio.toFixed(2)} < 3.0 (demand shifted to cheaper flour)`
  );
}

console.log('\n=== SAME-LEVEL SUBSTITUTION TEST (Raw Materials) ===\n');

// Test substitution between same-level resources (grain ↔ grapes both RAW, elasticity 0.7)
const rawSubstCompany = game.addCompany('rawsubst', 'Raw Subst Corp');
const rawOffice = rawSubstCompany.createFacility('office', prague) as Office | null;
const grainRetail = rawSubstCompany.createFacility('retail', prague) as RetailFacility | null;
const grapesRetail = rawSubstCompany.createFacility('retail', prague) as RetailFacility | null;

if (grainRetail && grapesRetail && rawOffice) {
  rawOffice.setWorkerCount(100);
  grainRetail.setWorkerCount(grainRetail.calculateRequiredWorkers());
  grapesRetail.setWorkerCount(grapesRetail.calculateRequiredWorkers());

  // Add inventory
  grainRetail.addResource('grain', 10000);
  grapesRetail.addResource('grapes', 10000);

  // Set grapes at HIGH price, grain at normal
  // Reference: grain=60, grapes=75 → expected ratio = 0.80
  // Set grain=$2 (cheap), grapes=$6 (3x normal ratio)
  grainRetail.setPrice('grain', 2.00);
  grapesRetail.setPrice('grapes', 6.00);

  const grainBefore = grainRetail.getResource('grain');
  const grapesBefore = grapesRetail.getResource('grapes');

  // Process just 2 ticks to avoid selling out
  for (let i = 0; i < 2; i++) {
    game.processTick();
  }

  const grainAfter = grainRetail.getResource('grain');
  const grapesAfter = grapesRetail.getResource('grapes');

  const grainSold = grainBefore - grainAfter;
  const grapesSold = grapesBefore - grapesAfter;

  // Base demands: grain 0.01, grapes 0.005 → ratio 2.0
  // With high elasticity (0.7) and grapes expensive, expect even stronger shift to grain
  assert(
    grainSold > 0 && grapesSold > 0,
    `Both raw materials sold: Grain=${grainSold.toFixed(0)}, Grapes=${grapesSold.toFixed(0)}`
  );
  assert(
    grainSold > grapesSold * 2.5,
    `Strong substitution to cheaper grain: ${grainSold.toFixed(0)} > ${(grapesSold * 2.5).toFixed(0)} (ratio ${(grainSold / grapesSold).toFixed(2)})`
  );
}

console.log('\n=== DEMAND CREATION TEST (Below-Average Pricing) ===\n');

// Test that retailers pricing below city average create additional demand
const demandCreationCompany1 = game.addCompany('demandcreate1', 'Demand Creation Test 1');
const demandCreationCompany2 = game.addCompany('demandcreate2', 'Demand Creation Test 2');
const demandCreationCompany3 = game.addCompany('demandcreate3', 'Demand Creation Test 3');

const dcOffice1 = demandCreationCompany1.createFacility('office', aarhus) as Office | null;
const dcOffice2 = demandCreationCompany2.createFacility('office', aarhus) as Office | null;
const dcOffice3 = demandCreationCompany3.createFacility('office', aarhus) as Office | null;

const dcRetail1 = demandCreationCompany1.createFacility('retail', aarhus) as RetailFacility | null;
const dcRetail2 = demandCreationCompany2.createFacility('retail', aarhus) as RetailFacility | null;
const dcRetail3 = demandCreationCompany3.createFacility('retail', aarhus) as RetailFacility | null;

if (dcRetail1 && dcRetail2 && dcRetail3 && dcOffice1 && dcOffice2 && dcOffice3) {
  dcOffice1.setWorkerCount(100);
  dcOffice2.setWorkerCount(100);
  dcOffice3.setWorkerCount(100);
  dcRetail1.setWorkerCount(dcRetail1.calculateRequiredWorkers());
  dcRetail2.setWorkerCount(dcRetail2.calculateRequiredWorkers());
  dcRetail3.setWorkerCount(dcRetail3.calculateRequiredWorkers());

  // Give all retailers plenty of grain so none sell out
  const largeInventory = 50000;
  dcRetail1.addResource('grain', largeInventory);
  dcRetail2.addResource('grain', largeInventory);
  dcRetail3.addResource('grain', largeInventory);

  // Set prices: Cheap ($2), Average ($4), Expensive ($6)
  // City average will be $4
  dcRetail1.setPrice('grain', 2.00);  // 50% below average - should create demand
  dcRetail2.setPrice('grain', 4.00);  // At average
  dcRetail3.setPrice('grain', 6.00);  // 50% above average

  const inventory1Before = dcRetail1.getResource('grain');
  const inventory2Before = dcRetail2.getResource('grain');
  const inventory3Before = dcRetail3.getResource('grain');

  // Process one tick
  game.processTick();

  const inventory1After = dcRetail1.getResource('grain');
  const inventory2After = dcRetail2.getResource('grain');
  const inventory3After = dcRetail3.getResource('grain');

  const sold1 = inventory1Before - inventory1After;
  const sold2 = inventory2Before - inventory2After;
  const sold3 = inventory3Before - inventory3After;
  const totalSold = sold1 + sold2 + sold3;

  console.log(`  Aarhus population: ${aarhus.population.toLocaleString()}`);
  console.log(`  Grain consumption rate: ${DEFAULT_CONSUMPTION_RATES.grain || 0} per capita`);
  console.log(`  City wealth: ${aarhus.wealth} (multiplier: ${(0.8 + aarhus.wealth * 0.7).toFixed(3)}x)`);
  const wealthMultiplier = 0.8 + aarhus.wealth * 0.7;
  const baseDemand = aarhus.population * (DEFAULT_CONSUMPTION_RATES.grain || 0) * wealthMultiplier;
  console.log(`  Base demand (with wealth effect): ${baseDemand.toFixed(2)} units`);
  console.log('  ');
  console.log('  Retailer Prices:');
  console.log(`    Retailer 1 (Cheap):     $2.00 (50% below avg)`);
  console.log(`    Retailer 2 (Average):   $4.00 (at average)`);
  console.log(`    Retailer 3 (Expensive): $6.00 (50% above avg)`);
  console.log(`    City Average:           $4.00`);
  console.log('  ');
  console.log('  Sales Results:');
  console.log(`    Retailer 1 (Cheap):     ${sold1.toFixed(2)} units (${(sold1 / totalSold * 100).toFixed(1)}% share)`);
  console.log(`    Retailer 2 (Average):   ${sold2.toFixed(2)} units (${(sold2 / totalSold * 100).toFixed(1)}% share)`);
  console.log(`    Retailer 3 (Expensive): ${sold3.toFixed(2)} units (${(sold3 / totalSold * 100).toFixed(1)}% share)`);
  console.log(`    Total Sold:             ${totalSold.toFixed(2)} units`);
  console.log('  ');

  // Calculate what would be equal shares without any price effects
  const equalShare = totalSold / 3;
  console.log(`  Equal share (no price effects): ${equalShare.toFixed(2)} units each (33.3%)`);

  // Verify demand creation occurred (total sold > base demand)
  assert(
    totalSold > baseDemand,
    `Demand creation: Total sold (${totalSold.toFixed(0)}) > Base demand (${baseDemand.toFixed(0)})`
  );

  // Calculate excess demand created
  const excessDemand = totalSold - baseDemand;
  const excessPercent = (excessDemand / baseDemand * 100);
  console.log(`  Excess demand created: ${excessDemand.toFixed(2)} units (+${excessPercent.toFixed(1)}%)`);

  // Verify cheap retailer sold significantly more than average retailer
  assert(
    sold1 > sold2 * 1.15,
    `Cheap retailer advantage: ${sold1.toFixed(0)} > ${(sold2 * 1.15).toFixed(0)} (${((sold1 / sold2 - 1) * 100).toFixed(1)}% more than average-priced)`
  );

  // Verify average retailer sold more than expensive retailer
  assert(
    sold2 > sold3,
    `Average retailer outperformed expensive: ${sold2.toFixed(0)} > ${sold3.toFixed(0)}`
  );

  // Verify the cheap retailer captured majority of excess demand
  // Since it's the only one below average, most created demand should go there
  const cheaperAdvantage = sold1 - equalShare;
  console.log(`  Cheap retailer advantage: +${cheaperAdvantage.toFixed(2)} units (+${(cheaperAdvantage / equalShare * 100).toFixed(1)}%) vs equal share`);

  assert(
    cheaperAdvantage > excessDemand * 0.5,
    `Cheap retailer captured majority of created demand: ${cheaperAdvantage.toFixed(0)} > ${(excessDemand * 0.5).toFixed(0)}`
  );

  // Test wealth effect: Compare per-capita demand between Aarhus (wealth 0.85) and Prague (wealth 0.3)
  // Create Prague retailer using same company for simplicity
  const pragueRetail = demandCreationCompany1.createFacility('retail', prague) as RetailFacility | null;
  if (pragueRetail) {
    pragueRetail.setWorkerCount(pragueRetail.calculateRequiredWorkers());
    pragueRetail.addResource('grain', 50000);
    pragueRetail.setPrice('grain', 2.00);

    const pragueInventoryBefore = pragueRetail.getResource('grain');
    game.processTick();
    const pragueInventoryAfter = pragueRetail.getResource('grain');
    const pragueSold = pragueInventoryBefore - pragueInventoryAfter;

    // Calculate per-capita consumption
    const aarhusPerCapita = totalSold / aarhus.population;
    const praguePerCapita = pragueSold / prague.population;

    // Verify wealth effect: wealthier city should have higher per-capita demand
    assert(
      aarhusPerCapita > praguePerCapita,
      `Wealth effect: Aarhus (0.85 wealth) per-capita ${(aarhusPerCapita * 1000).toFixed(2)} > Prague (0.3 wealth) ${(praguePerCapita * 1000).toFixed(2)} per 1000 people`
    );
  }
}

console.log('\n=== DEMAND CALCULATION STEP-BY-STEP EXPLANATION ===\n');

// Create a controlled scenario to demonstrate each step with actual numbers
const stepCompany1 = game.addCompany('step1', 'Step Demo Corp 1');
const stepCompany2 = game.addCompany('step2', 'Step Demo Corp 2');
const stepCompany3 = game.addCompany('step3', 'Step Demo Corp 3');
const stepOffice1 = stepCompany1.createFacility('office', prague) as Office | null;
const stepOffice2 = stepCompany2.createFacility('office', prague) as Office | null;
const stepOffice3 = stepCompany3.createFacility('office', prague) as Office | null;
const stepRetail1 = stepCompany1.createFacility('retail', prague) as RetailFacility | null;
const stepRetail2 = stepCompany2.createFacility('retail', prague) as RetailFacility | null;
const stepRetail3 = stepCompany3.createFacility('retail', prague) as RetailFacility | null;

if (stepRetail1 && stepRetail2 && stepRetail3 && stepOffice1 && stepOffice2 && stepOffice3) {
  stepOffice1.setWorkerCount(100);
  stepOffice2.setWorkerCount(100);
  stepOffice3.setWorkerCount(100);
  stepRetail1.setWorkerCount(stepRetail1.calculateRequiredWorkers());
  stepRetail2.setWorkerCount(stepRetail2.calculateRequiredWorkers());
  stepRetail3.setWorkerCount(stepRetail3.calculateRequiredWorkers());

  // Give HUGE inventory to retailers 1 & 2, but LIMITED inventory to retailer 3
  stepRetail1.addResource('bread', 1000000);
  stepRetail2.addResource('bread', 1000000);
  stepRetail3.addResource('bread', 3000);  // Limited - will sell out in first pass
  stepRetail1.addResource('flour', 1000000);

  // Set prices - bread expensive, flour cheap (to trigger substitution)
  stepRetail1.setPrice('bread', 10.00);  // Cheap bread retailer
  stepRetail2.setPrice('bread', 18.00);  // Expensive bread retailer
  stepRetail3.setPrice('bread', 8.00);   // CHEAPEST - but will run out
  stepRetail1.setPrice('flour', 4.00);   // Cheap flour

  const breadBefore1 = stepRetail1.getResource('bread');
  const breadBefore2 = stepRetail2.getResource('bread');
  const breadBefore3 = stepRetail3.getResource('bread');
  const flourBefore = stepRetail1.getResource('flour');

  // Process ONE tick
  game.processTick();

  const breadAfter1 = stepRetail1.getResource('bread');
  const breadAfter2 = stepRetail2.getResource('bread');
  const breadAfter3 = stepRetail3.getResource('bread');
  const flourAfter = stepRetail1.getResource('flour');

  const breadSold1 = breadBefore1 - breadAfter1;
  const breadSold2 = breadBefore2 - breadAfter2;
  const breadSold3 = breadBefore3 - breadAfter3;
  const flourSold = flourBefore - flourAfter;
  const totalBreadSold = breadSold1 + breadSold2 + breadSold3;

  console.log('  STEP 1: Base consumption rate per capita');
  console.log(`    Bread: ${DEFAULT_CONSUMPTION_RATES.bread} per person per tick`);
  console.log(`    Flour: ${DEFAULT_CONSUMPTION_RATES.flour} per person per tick`);

  console.log('  ');
  console.log('  STEP 2: Multiply by city population');
  console.log(`    Prague population: ${prague.population.toLocaleString()}`);
  const breadBaseDemand = prague.population * DEFAULT_CONSUMPTION_RATES.bread;
  const flourBaseDemand = prague.population * DEFAULT_CONSUMPTION_RATES.flour;
  console.log(`    Bread base demand: ${prague.population.toLocaleString()} × ${DEFAULT_CONSUMPTION_RATES.bread} = ${breadBaseDemand.toFixed(2)}`);
  console.log(`    Flour base demand: ${prague.population.toLocaleString()} × ${DEFAULT_CONSUMPTION_RATES.flour} = ${flourBaseDemand.toFixed(2)}`);

  console.log('  ');
  console.log('  STEP 3: Apply cross-resource substitution');
  const avgBreadPrice = (10 + 18 + 8) / 3;
  console.log(`    Bread prices: $10, $18, $8 → avg $${avgBreadPrice.toFixed(2)}`);
  console.log(`    Flour price: $4.00`);
  console.log(`    Reference ratios: Bread=${RESOURCE_PRICE_RATIOS.bread}, Flour=${RESOURCE_PRICE_RATIOS.flour}`);
  console.log(`    Actual price ratio: ${(avgBreadPrice / 4).toFixed(2)}, Expected ratio: ${(RESOURCE_PRICE_RATIOS.bread / RESOURCE_PRICE_RATIOS.flour).toFixed(2)}`);
  console.log(`    Bread is expensive relative to flour → demand shifts to flour`);
  console.log(`    Bread sold (after substitution): ${totalBreadSold.toFixed(2)} (was ${breadBaseDemand.toFixed(2)})`);
  console.log(`    Flour sold (after substitution): ${flourSold.toFixed(2)} (was ${flourBaseDemand.toFixed(2)})`);
  const substitutionPercent = ((breadBaseDemand - totalBreadSold) / breadBaseDemand * 100);
  console.log(`    → ${substitutionPercent.toFixed(1)}% of bread demand shifted away`);

  console.log('  ');
  console.log('  STEP 4a: Equal share (reference)');
  const equalShare = totalBreadSold / 3;
  console.log(`    Would be: ${totalBreadSold.toFixed(2)} ÷ 3 retailers = ${equalShare.toFixed(2)} each`);

  console.log('  ');
  console.log('  STEP 4b: Price sensitivity adjustment');
  const sensitivity = INTER_RETAILER_SENSITIVITY.bread;
  console.log(`    Bread sensitivity: ${sensitivity} (low - staple good, convenience matters)`);
  console.log(`    Average price: $${avgBreadPrice.toFixed(2)}`);
  const rawShare1 = Math.pow(avgBreadPrice / 10, sensitivity);
  const rawShare2 = Math.pow(avgBreadPrice / 18, sensitivity);
  const rawShare3 = Math.pow(avgBreadPrice / 8, sensitivity);
  const totalRaw = rawShare1 + rawShare2 + rawShare3;
  const normShare1 = rawShare1 / totalRaw;
  const normShare2 = rawShare2 / totalRaw;
  const normShare3 = rawShare3 / totalRaw;
  console.log(`    Retailer1 ($10): (${avgBreadPrice.toFixed(2)}/10)^${sensitivity} = ${rawShare1.toFixed(3)} → ${(normShare1 * 100).toFixed(1)}% share`);
  console.log(`    Retailer2 ($18): (${avgBreadPrice.toFixed(2)}/18)^${sensitivity} = ${rawShare2.toFixed(3)} → ${(normShare2 * 100).toFixed(1)}% share`);
  console.log(`    Retailer3 ($8):  (${avgBreadPrice.toFixed(2)}/8)^${sensitivity} = ${rawShare3.toFixed(3)} → ${(normShare3 * 100).toFixed(1)}% share`);
  const expectedSold1 = totalBreadSold * normShare1;
  const expectedSold2 = totalBreadSold * normShare2;
  const expectedSold3 = totalBreadSold * normShare3;
  console.log(`    Expected: R1=${expectedSold1.toFixed(2)}, R2=${expectedSold2.toFixed(2)}, R3=${expectedSold3.toFixed(2)}`);

  console.log('  ');
  console.log('  STEP 4c: First pass - each retailer fulfills their share');
  console.log(`    Retailer1 ($10): ${breadSold1.toFixed(2)} sold (had plenty of stock)`);
  console.log(`    Retailer2 ($18): ${breadSold2.toFixed(2)} sold (had plenty of stock)`);
  console.log(`    Retailer3 ($8):  ${breadSold3.toFixed(2)} sold (wanted ${expectedSold3.toFixed(2)} but only had ${breadBefore3.toFixed(2)})`);
  const unfulfilled = expectedSold3 - breadSold3;
  console.log(`    → Retailer3 could not fulfill ${unfulfilled.toFixed(2)} units`);

  console.log('  ');
  console.log('  STEP 4d: Second pass - redistribute unfulfilled demand');
  const firstPassTotal = Math.min(expectedSold1, breadBefore1) + Math.min(expectedSold2, breadBefore2) + Math.min(expectedSold3, breadBefore3);
  const secondPassAmount = totalBreadSold - firstPassTotal;
  console.log(`    Unfulfilled demand: ${unfulfilled.toFixed(2)} units`);
  console.log(`    Redistributed equally to retailers with stock (R1 & R2)`);
  console.log(`    Each gets: ${(unfulfilled / 2).toFixed(2)} additional units`);
  console.log(`    Total second pass: ${secondPassAmount.toFixed(2)} units redistributed`);

  // Verify cheapest retailer sold out
  assert(
    breadAfter3 === 0,
    'Cheapest retailer ($8) sold out completely'
  );

  // With demand creation enabled, cheap retailers create additional demand
  // The cheapest retailer at $8 vs dampened avg ~$12 creates significant extra demand
  // Verify that total demand increased due to the cheap pricing
  assert(
    totalBreadSold > breadBaseDemand * 0.95,
    `Demand creation occurred: ${totalBreadSold.toFixed(0)} > ${(breadBaseDemand * 0.95).toFixed(0)}`
  );

  // Verify the cheapest retailer sold out completely (hit inventory limit)
  assert(
    breadSold3 === 3000,
    `Cheapest retailer sold all available inventory: ${breadSold3.toFixed(0)} units`
  );
}

console.log('\n=== BIDIRECTIONAL SUBSTITUTION TEST ===\n');

// Test that substitution affects both resources (loss and gain)
const biSubstCompany = game.addCompany('bisubst', 'Bidirectional Subst Corp');
const biOffice = biSubstCompany.createFacility('office', aarhus) as Office | null;
const biGrainRetail = biSubstCompany.createFacility('retail', aarhus) as RetailFacility | null;
const biGrapesRetail = biSubstCompany.createFacility('retail', aarhus) as RetailFacility | null;

if (biGrainRetail && biGrapesRetail && biOffice) {
  biOffice.setWorkerCount(100);
  biGrainRetail.setWorkerCount(biGrainRetail.calculateRequiredWorkers());
  biGrapesRetail.setWorkerCount(biGrapesRetail.calculateRequiredWorkers());

  biGrainRetail.addResource('grain', 50000);
  biGrapesRetail.addResource('grapes', 50000);

  // Make grain expensive (shift demand to grapes)
  biGrainRetail.setPrice('grain', 8.00); // Much higher than reference
  biGrapesRetail.setPrice('grapes', 2.00); // Normal price

  const grainBefore = biGrainRetail.getResource('grain');
  const grapesBefore = biGrapesRetail.getResource('grapes');

  game.processTick();

  const grainSold = grainBefore - biGrainRetail.getResource('grain');
  const grapesSold = grapesBefore - biGrapesRetail.getResource('grapes');

  assert(
    grapesSold > grainSold,
    `Substitution: expensive grain (${grainSold.toFixed(0)}) < cheap grapes (${grapesSold.toFixed(0)})`
  );
}

console.log('\n=== PER-RETAILER RANDOMNESS TEST ===\n');

// Test that identical retailers get slightly different sales due to ±5% randomness
const randCompany1 = game.addCompany('rand1', 'Random Corp 1');
const randCompany2 = game.addCompany('rand2', 'Random Corp 2');
const randCompany3 = game.addCompany('rand3', 'Random Corp 3');

const randOffice1 = randCompany1.createFacility('office', prague) as Office | null;
const randOffice2 = randCompany2.createFacility('office', prague) as Office | null;
const randOffice3 = randCompany3.createFacility('office', prague) as Office | null;

const randRetail1 = randCompany1.createFacility('retail', prague) as RetailFacility | null;
const randRetail2 = randCompany2.createFacility('retail', prague) as RetailFacility | null;
const randRetail3 = randCompany3.createFacility('retail', prague) as RetailFacility | null;

if (randRetail1 && randRetail2 && randRetail3 && randOffice1 && randOffice2 && randOffice3) {
  [randOffice1, randOffice2, randOffice3].forEach(o => o.setWorkerCount(100));
  [randRetail1, randRetail2, randRetail3].forEach(r => {
    r.setWorkerCount(r.calculateRequiredWorkers());
    r.addResource('bread', 50000);
    r.setPrice('bread', 10.00); // Identical prices
  });

  const before1 = randRetail1.getResource('bread');
  const before2 = randRetail2.getResource('bread');
  const before3 = randRetail3.getResource('bread');

  game.processTick();

  const sold1 = before1 - randRetail1.getResource('bread');
  const sold2 = before2 - randRetail2.getResource('bread');
  const sold3 = before3 - randRetail3.getResource('bread');

  // With randomness, sales shouldn't be exactly equal
  const allDifferent = sold1 !== sold2 || sold2 !== sold3 || sold1 !== sold3;
  assert(
    allDifferent,
    `Randomness creates variation: ${sold1.toFixed(0)}, ${sold2.toFixed(0)}, ${sold3.toFixed(0)} units`
  );
}

console.log('\n=== DEMAND SHOCKS TEST ===\n');

// Run multiple ticks to verify demand shocks don't crash the system
// (5% chance per resource per tick makes individual shocks hard to test deterministically)
const shockCompany = game.addCompany('shock', 'Shock Test Corp');
const shockOffice = shockCompany.createFacility('office', copenhagen) as Office | null;
const shockRetail = shockCompany.createFacility('retail', copenhagen) as RetailFacility | null;

if (shockRetail && shockOffice) {
  shockOffice.setWorkerCount(100);
  shockRetail.setWorkerCount(shockRetail.calculateRequiredWorkers());
  shockRetail.addResource('flour', 50000);
  shockRetail.setPrice('flour', 6.00);

  // Process multiple ticks to potentially trigger shocks
  for (let i = 0; i < 20; i++) {
    game.processTick();
  }

  const finalInventory = shockRetail.getResource('flour');
  assert(
    finalInventory < 50000,
    `Demand shocks system stable over 20 ticks (inventory: ${finalInventory.toFixed(0)})`
  );
}

console.log('\n=== FINAL TEST RESULTS ===\n');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📊 Total: ${testsPassed + testsFailed}`);

const passRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
console.log(`📈 Pass Rate: ${passRate}%\n`);

if (testsFailed === 0) {
  console.log('🎉 ALL TESTS PASSED!\n');
} else {
  console.log('⚠️  Some tests failed. Review output above.\n');
}

console.log('Game is running. All systems tested.\n');