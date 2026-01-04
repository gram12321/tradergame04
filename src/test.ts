import { GameEngine } from './game/GameEngine.js';
import { FacilityRegistry } from './game/FacilityRegistry.js';
import { CityRegistry } from './game/CityRegistry.js';
import { ResourceRegistry } from './game/ResourceRegistry.js';
import { RecipeRegistry } from './game/RecipeRegistry.js';

// Create game instance
const game = new GameEngine();

// Add test companies
const alice = game.addCompany('alice', 'Alice Corp');
const bob = game.addCompany('bob', 'Bob Industries');

console.log('🎮 Production Game - Comprehensive Test Suite\n');
console.log(FacilityRegistry.displayFacilities());
console.log('\nInitial state:');
console.log(game.getGameState());

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
let farm = alice.createFacility('farm', copenhagen);
let mill = alice.createFacility('mill', copenhagen);
assert(farm !== null, 'Farm created in Copenhagen');
assert(mill !== null, 'Mill created in Copenhagen');

// Get the office
const aliceOffice = alice.facilities.find(f => f.type === 'office' && f.city.country === 'Denmark');
assert(aliceOffice !== null, 'Alice has office in Denmark');

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
let testFarm = alice.createFacility('farm', prague);
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
  farm.inventory.clear();
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
const farmWithoutOffice = charlie.createFacility('farm', prague);

assert(
  farmWithoutOffice === null,
  'Cannot create farm without office in country (Prague)'
);

// Create office first, then farm
const charlieOffice = charlie.createFacility('office', prague);
assert(charlieOffice !== null, 'Charlie created office in Prague');

const charliesFarm = charlie.createFacility('farm', prague);
assert(charliesFarm !== null, 'Charlie can now create farm after office exists');

console.log('\n=== WAGE DEDUCTION TEST ===\n');

// Create fresh facilities for wage testing
const wageTestCompany = game.addCompany('wagetest', 'Wage Test Corp');
const wageOffice = wageTestCompany.createFacility('office', copenhagen);
const wageFarm = wageTestCompany.createFacility('farm', copenhagen);

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
const prodOffice = prodTestCompany.createFacility('office', prague);
const prodFarm = prodTestCompany.createFacility('farm', prague);

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

console.log('\n=== PRODUCTION INPUT/OUTPUT TEST ===\n');

// Fresh company for clean production test
const ioTestCompany = game.addCompany('iotest', 'IO Test Corp');
const ioOffice = ioTestCompany.createFacility('office', copenhagen);
const ioFarm = ioTestCompany.createFacility('farm', copenhagen);

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
const millOffice = millTestCompany.createFacility('office', prague);
const testMill = millTestCompany.createFacility('mill', prague);

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
  
  const transferred = ioTestCompany.transferResource(ioFarm, testMill, 'grain', transferAmount);
  
  const farmAfter = ioFarm.getResource('grain');
  const millAfter = testMill.getResource('grain');
  
  assert(
    !transferred, // Different companies, should fail
    'Cannot transfer between different companies'
  );
  
  // Transfer within same company
  const ioFarm2 = ioTestCompany.createFacility('farm', prague);
  if (ioFarm2) {
    ioFarm2.addResource('grain', 100);
    const farm2Before = ioFarm2.getResource('grain');
    const ioMillBefore = ioFarm.getResource('grain');
    
    const success = ioTestCompany.transferResource(ioFarm2, ioFarm, 'grain', 50);
    
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
const whOffice = warehouseCompany.createFacility('office', copenhagen);
const warehouse = warehouseCompany.createFacility('warehouse', copenhagen);

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

console.log('\n=== MARKET SELL OFFER TEST ===\n');

const market = game.getMarket();
const sellerCompany = game.addCompany('seller', 'Seller Corp');
const sellerOffice = sellerCompany.createFacility('office', copenhagen);
const sellerFarm = sellerCompany.createFacility('farm', copenhagen);

if (sellerFarm && sellerOffice) {
  sellerOffice.setWorkerCount(100);
  sellerFarm.setWorkerCount(sellerFarm.calculateRequiredWorkers());
  sellerFarm.addResource('grain', 100);
  
  const offer = sellerCompany.createSellOffer(market, sellerFarm, 'grain', 10, 5.00);
  
  assert(offer !== null, 'Sell offer created successfully');
  
  const marketOffers = market.getSellOffersByResource('grain');
  assert(
    marketOffers.some(o => o.id === offer?.id),
    'Sell offer appears on market'
  );
  
  // Test that offer persists even with no stock
  sellerFarm.removeResource('grain', 100);
  
  const offersAfterDrain = market.getSellOffersByResource('grain');
  const stillExists = offersAfterDrain.some(o => o.id === offer?.id);
  
  assert(
    stillExists,
    'Offer persists even when stock depleted (not deleted)'
  );
  
  // Add stock back
  sellerFarm.addResource('grain', 50);
  
  const restoredOffers = market.getSellOffersByResource('grain');
  const hasStock = restoredOffers.find(o => o.id === offer?.id);
  
  assert(
    hasStock !== undefined && hasStock.amountAvailable > 0,
    'Offer shows available stock when inventory restored'
  );
}

console.log('\n=== CONTRACT BETWEEN COMPANIES TEST ===\n');

const buyerCompany = game.addCompany('buyer', 'Buyer Corp');
const buyerOffice = buyerCompany.createFacility('office', prague);
const buyerWarehouse = buyerCompany.createFacility('warehouse', prague);

if (buyerWarehouse && sellerFarm && buyerOffice) {
  buyerOffice.setWorkerCount(100);
  buyerWarehouse.setWorkerCount(buyerWarehouse.calculateRequiredWorkers());
  
  const grainOffers = market.getSellOffersByResource('grain');
  const offer = grainOffers.find(o => o.sellerId === sellerCompany.id);
  
  if (offer) {
    const sellerBalanceBefore = sellerCompany.balance;
    const buyerBalanceBefore = buyerCompany.balance;
    const warehouseBefore = buyerWarehouse.getResource('grain');
    const farmBefore = sellerFarm.getResource('grain');
    
    const contract = buyerCompany.acceptSellOffer(
      market,
      sellerCompany,
      offer.id,
      buyerWarehouse,
      5,
      game.getTickCount()
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
