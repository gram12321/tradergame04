import { GameEngine } from './game/GameEngine.js';
import { FacilityRegistry } from './game/FacilityRegistry.js';
import { CityRegistry } from './game/CityRegistry.js';

// Create game instance
const game = new GameEngine();

// Add test companies
const alice = game.addCompany('alice', 'Alice Corp');
const bob = game.addCompany('bob', 'Bob Industries');

console.log('🎮 Production Game - Starting Test Simulation\n');
console.log(FacilityRegistry.displayFacilities());
console.log('\nInitial state:');
console.log(game.getGameState());

// Get cities for testing
const copenhagen = CityRegistry.getCity('Copenhagen', 'Denmark')!;
const prague = CityRegistry.getCity('Prague', 'Czech Republic')!;

console.log('\n=== CITY & WAGE TESTING ===\n');
console.log('Cities available:');
console.log(`  ${copenhagen.toString()}`);
console.log(`  ${prague.toString()}`);
console.log('\nWage calculation: workers * 1€ * city.wealth');
console.log(`  Copenhagen (wealth 0.9): 3 workers = ${3 * 1.0 * 0.9}€/tick`);
console.log(`  Prague (wealth 0.3): 3 workers = ${3 * 1.0 * 0.3}€/tick`);

console.log('\n=== WORKER & SIZE TESTING ===\n');

// Test different facility sizes and worker requirements
console.log('Testing Warehouse worker scaling (multiplier: 1.0):');
for (let size = 1; size <= 5; size++) {
  const workers = Math.ceil(1.0 * Math.pow(size, 1.2));
  const output = Math.sqrt(size).toFixed(2);
  console.log(`  Size ${size}: ${workers} workers, ${output}x output`);
}

console.log('\nTesting Farm worker scaling (multiplier: 3.0):');
for (let size = 1; size <= 5; size++) {
  const workers = Math.ceil(3.0 * Math.pow(size, 1.2));
  const output = Math.sqrt(size).toFixed(2);
  console.log(`  Size ${size}: ${workers} workers, ${output}x output`);
}

console.log('\nTesting upgrade costs (Farm base cost: $1000):');
for (let size = 1; size <= 5; size++) {
  const upgradeCost = Math.ceil(1000 * Math.pow(size + 1, 2));
  console.log(`  Size ${size} → ${size + 1}: $${upgradeCost.toFixed(2)}`);
}

console.log('\n=== STARTING SIMULATION ===\n');

// Simulate game ticks
let tickInterval = setInterval(() => {
  const tick = game.getTickCount();
  
  // Alice takes actions at specific ticks (BEFORE processing)
  if (tick === 0) {
    console.log('\n💼 Alice Corp creates a Farm (size 1) in Copenhagen...');
    const farm = alice.createFacility('farm', copenhagen);
    if (farm) {
      console.log(`✅ Farm created: Size ${farm.size}, Workers ${farm.workers}, Output ${farm.getProductionMultiplier().toFixed(2)}x, Effectivity ${farm.effectivity.toFixed(2)}`);
      console.log(`   Location: ${farm.city.name}, ${farm.city.country}`);
      console.log(`   Wage: ${farm.getWagePerTick().toFixed(2)}€/tick (${farm.workers} workers * 1€ * ${farm.city.wealth} wealth)`);
      console.log(`   Upgrade cost to size 2: $${farm.getUpgradeCost().toFixed(2)}`);
    }
  }
  
  if (tick === 3) {
    console.log('\n💼 Alice Corp creates a Mill in Prague...');
    const mill = alice.createFacility('mill', prague);
    if (mill) {
      console.log(`✅ Mill created: Size ${mill.size}, Workers ${mill.workers}, Output ${mill.getProductionMultiplier().toFixed(2)}x, Effectivity ${mill.effectivity.toFixed(2)}`);
      console.log(`   Location: ${mill.city.name}, ${mill.city.country}`);
      console.log(`   Wage: ${mill.getWagePerTick().toFixed(2)}€/tick (${mill.workers} workers * 1€ * ${mill.city.wealth} wealth)`);
    }
  }
  
  if (tick === 5) {
    console.log('\n🔧 Alice upgrades the Farm...');
    const farm = alice.facilities[0];
    const oldSize = farm.size;
    const oldWorkers = farm.workers;
    const oldEffectivity = farm.effectivity;
    const cost = farm.getUpgradeCost();
    const success = alice.upgradeFacility(farm);
    if (success) {
      console.log(`✅ Farm upgraded! Size ${oldSize}→${farm.size}, Workers ${oldWorkers}→${farm.workers}, Output ${Math.sqrt(oldSize).toFixed(2)}x→${farm.getProductionMultiplier().toFixed(2)}x`);
      console.log(`   Effectivity: ${oldEffectivity.toFixed(2)}→${farm.effectivity.toFixed(2)}`);
      console.log(`   Cost: $${cost.toFixed(2)}, Balance: $${alice.balance.toFixed(2)}`);
      console.log(`   Next upgrade cost: $${farm.getUpgradeCost().toFixed(2)}`);
    } else {
      console.log(`❌ Upgrade failed!`);
    }
  }
  
  if (tick === 8) {
    console.log('\n🔧 Alice upgrades the Farm again...');
    const farm = alice.facilities[0];
    const oldSize = farm.size;
    const oldWorkers = farm.workers;
    const oldEffectivity = farm.effectivity;
    const cost = farm.getUpgradeCost();
    const success = alice.upgradeFacility(farm);
    if (success) {
      console.log(`✅ Farm upgraded! Size ${oldSize}→${farm.size}, Workers ${oldWorkers}→${farm.workers}, Output ${Math.sqrt(oldSize).toFixed(2)}x→${farm.getProductionMultiplier().toFixed(2)}x`);
      console.log(`   Effectivity: ${oldEffectivity.toFixed(2)}→${farm.effectivity.toFixed(2)}`);
      console.log(`   Cost: $${cost.toFixed(2)}, Balance: $${alice.balance.toFixed(2)}`);
    }
  }
  
  if (tick === 10) {
    console.log('\n💼 Alice Corp creates a Bakery in Copenhagen...');
    const bakery = alice.createFacility('bakery', copenhagen);
    if (bakery) {
      console.log(`✅ Bakery created: Size ${bakery.size}, Workers ${bakery.workers}, Output ${bakery.getProductionMultiplier().toFixed(2)}x, Effectivity ${bakery.effectivity.toFixed(2)}`);
      console.log(`   Location: ${bakery.city.name}, Wage: ${bakery.getWagePerTick().toFixed(2)}€/tick`);
    }
  }
  
  // Transfer grain from farm to mill at tick 13
  if (tick === 13 && alice.facilities.length >= 2) {
    const farm = alice.facilities[0];
    const mill = alice.facilities[1];
    const grainAmount = farm.getResource('grain');
    if (grainAmount > 0) {
      console.log(`\n🚚 Transferring ${grainAmount.toFixed(1)} grain from Farm to Mill...`);
      alice.transferResource(farm, mill, 'grain', grainAmount);
    }
  }
  
  // Transfer flour from mill to bakery at tick 18
  if (tick === 18 && alice.facilities.length >= 3) {
    const mill = alice.facilities[1];
    const bakery = alice.facilities[2];
    const flourAmount = mill.getResource('flour');
    if (flourAmount > 0) {
      console.log(`\n🚚 Transferring ${flourAmount.toFixed(1)} flour from Mill to Bakery...`);
      alice.transferResource(mill, bakery, 'flour', flourAmount);
    }
  }
  
  // Create sell offers on the market at tick 21
  if (tick === 21) {
    const market = game.getMarket();
    console.log('\n💰 Alice Corp creating sell offers on the market...');
    
    // Create sell offer for grain from the farm
    const farm = alice.facilities[0];
    if (farm && farm.getResource('grain') > 0) {
      const grainOffer = alice.createSellOffer(market, farm, 'grain', 5, 2.50);
      if (grainOffer) {
        console.log(`✅ Created sell offer: 5 grain/tick @ $2.50/unit`);
      }
    }
    
    // Create sell offer for bread from the bakery
    const bakery = alice.facilities[2];
    if (bakery && bakery.getResource('bread') > 0) {
      const breadOffer = alice.createSellOffer(market, bakery, 'bread', 2, 10.00);
      if (breadOffer) {
        console.log(`✅ Created sell offer: 2 bread/tick @ $10.00/unit`);
      }
    }
  }
  
  // Bob creates a warehouse at tick 22
  if (tick === 22) {
    console.log('\n💼 Bob Industries creates a Warehouse in Prague...');
    const warehouse = bob.createFacility('warehouse', prague);
    if (warehouse) {
      console.log(`✅ Warehouse created: Size ${warehouse.size}, Workers ${warehouse.workers} (baseline), Effectivity ${warehouse.effectivity.toFixed(2)}`);
      console.log(`   Location: ${warehouse.city.name}, Wage: ${warehouse.getWagePerTick().toFixed(2)}€/tick`);
    }
  }
  
  // Display market at tick 23
  if (tick === 23) {
    const market = game.getMarket();
    console.log(market.displayMarket());
  }
  
  // Bob creates a contract to buy bread from Alice at tick 25
  if (tick === 25 && bob.facilities.length > 0) {
    const market = game.getMarket();
    const breadOffers = market.getSellOffersByResource('bread');
    
    if (breadOffers.length > 0) {
      const offer = breadOffers[0];
      const warehouse = bob.facilities[0];
      
      console.log(`\n🛒 Bob Industries creating contract to buy bread from ${offer.sellerName}...`);
      console.log(`   Offer: ${offer.amountAvailable} bread/tick available @ $${offer.pricePerUnit.toFixed(2)}/unit`);
      console.log(`   Bob's balance before: $${bob.balance.toFixed(2)}`);
      
      const contract = bob.acceptSellOffer(market, alice, offer.id, warehouse, 2, game.getTickCount());
      
      if (contract) {
        console.log(`✅ Contract created!`);
        console.log(`   Contract: ${contract.amountPerTick} bread/tick @ $${contract.pricePerUnit.toFixed(2)}/unit = $${contract.totalPrice.toFixed(2)}/tick`);
        console.log(`   Contract will execute starting next tick`);
      } else {
        console.log(`❌ Contract creation failed!`);
      }
    }
  }
  
  // Process the tick
  game.processTick();
  
  console.log(game.getGameState());
  
  // Stop after 30 ticks
  if (tick >= 30) {
    clearInterval(tickInterval);
    console.log('\n✅ Simulation complete!');
    
    // Display final market state
    const market = game.getMarket();
    console.log(market.displayMarket());
    
    // Display final facility stats
    console.log('\n=== FINAL FACILITY STATS ===\n');
    alice.facilities.forEach((facility, i) => {
      console.log(`${facility.name}:`);
      console.log(`  Location: ${facility.city.name}, ${facility.city.country}`);
      console.log(`  Size: ${facility.size} | Workers: ${facility.workers} | Output: ${facility.getProductionMultiplier().toFixed(2)}x | Effectivity: ${facility.effectivity.toFixed(2)}`);
      console.log(`  Wage: ${facility.getWagePerTick().toFixed(2)}€/tick`);
      if (i < alice.facilities.length - 1) console.log('');
    });
    
    console.log(`\nTotal wages per tick: ${alice.getTotalWagesPerTick().toFixed(2)}€`);
    console.log(`Final balance: $${alice.balance.toFixed(2)}`);
    
    console.log('\nGame is running. You can now iterate on mechanics.\n');
  }
}, 1000); // 1 second per tick
