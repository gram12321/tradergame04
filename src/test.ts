import { GameEngine } from './game/GameEngine.js';
import { FacilityRegistry } from './game/FacilityRegistry.js';

// Create game instance
const game = new GameEngine();

// Add test companies
const alice = game.addCompany('alice', 'Alice Corp');
const bob = game.addCompany('bob', 'Bob Industries');

console.log('🎮 Production Game - Starting Test Simulation\n');
console.log(FacilityRegistry.displayFacilities());
console.log('\nInitial state:');
console.log(game.getGameState());

// Simulate game ticks
let tickInterval = setInterval(() => {
  const tick = game.getTickCount();
  
  // Alice takes actions at specific ticks (BEFORE processing)
  if (tick === 0) {
    console.log('\n💼 Alice Corp creates a Farm...');
    const farm = alice.createFacility('farm');
    if (farm) {
      console.log('✅ Farm created with default recipe (will start producing next tick)');
    }
  }
  
  if (tick === 3) {
    console.log('\n💼 Alice Corp creates a Mill...');
    const mill = alice.createFacility('mill');
    if (mill) {
      console.log('✅ Mill created with default recipe');
    }
  }
  
  if (tick === 6) {
    console.log('\n💼 Alice Corp creates a Bakery...');
    const bakery = alice.createFacility('bakery');
    if (bakery) {
      console.log('✅ Bakery created with default recipe');
    }
  }
  
  // Transfer grain from farm to mill at tick 10
  if (tick === 10 && alice.facilities.length >= 2) {
    const farm = alice.facilities[0];
    const mill = alice.facilities[1];
    const grainAmount = farm.getResource('grain');
    if (grainAmount > 0) {
      console.log(`\n🚚 Transferring ${grainAmount} grain from Farm to Mill...`);
      alice.transferResource(farm, mill, 'grain', grainAmount);
    }
  }
  
  // Transfer flour from mill to bakery at tick 15
  if (tick === 15 && alice.facilities.length >= 3) {
    const mill = alice.facilities[1];
    const bakery = alice.facilities[2];
    const flourAmount = mill.getResource('flour');
    if (flourAmount > 0) {
      console.log(`\n🚚 Transferring ${flourAmount} flour from Mill to Bakery...`);
      alice.transferResource(mill, bakery, 'flour', flourAmount);
    }
  }
  
  // List resources on the market at tick 18
  if (tick === 18) {
    const market = game.getMarket();
    console.log('\n💰 Alice Corp listing resources on the market...');
    
    // List some grain from the farm
    const farm = alice.facilities[0];
    if (farm && farm.getResource('grain') > 0) {
      const grainListing = alice.listResourceOnMarket(market, farm, 'grain', 5, 2.50);
      if (grainListing) {
        console.log(`✅ Listed 5 grain @ $2.50/unit (Total: $${grainListing.totalPrice.toFixed(2)})`);
      }
    }
    
    // List some bread from the bakery
    const bakery = alice.facilities[2];
    if (bakery && bakery.getResource('bread') > 0) {
      const breadListing = alice.listResourceOnMarket(market, bakery, 'bread', 2, 10.00);
      if (breadListing) {
        console.log(`✅ Listed 2 bread @ $10.00/unit (Total: $${breadListing.totalPrice.toFixed(2)})`);
      }
    }
  }
  
  // Bob creates a warehouse at tick 19
  if (tick === 19) {
    console.log('\n💼 Bob Industries creates a Warehouse...');
    const warehouse = bob.createFacility('warehouse');
    if (warehouse) {
      console.log('✅ Warehouse created (storage only, no production)');
    }
  }
  
  // Display market at tick 20
  if (tick === 20) {
    const market = game.getMarket();
    console.log(market.displayMarket());
  }
  
  // Bob buys bread from Alice at tick 22
  if (tick === 22 && bob.facilities.length > 0) {
    const market = game.getMarket();
    const breadListings = market.getListingsByResource('bread');
    
    if (breadListings.length > 0) {
      const listing = breadListings[0];
      const warehouse = bob.facilities[0];
      
      console.log(`\n🛒 Bob Industries purchasing bread from ${listing.sellerName}...`);
      console.log(`   Listing: ${listing.amount} bread @ $${listing.pricePerUnit.toFixed(2)}/unit = $${listing.totalPrice.toFixed(2)}`);
      console.log(`   Bob's balance before: $${bob.balance.toFixed(2)}`);
      
      const success = bob.purchaseFromMarket(market, alice, listing.id, warehouse);
      
      if (success) {
        console.log(`✅ Purchase successful!`);
        console.log(`   Bob's balance after: $${bob.balance.toFixed(2)}`);
        console.log(`   Alice's balance after: $${alice.balance.toFixed(2)}`);
        console.log(`   Bread in warehouse: ${warehouse.getResource('bread')}`);
      } else {
        console.log(`❌ Purchase failed!`);
      }
    }
  }
  
  // Process the tick
  game.processTick();
  
  console.log(game.getGameState());
  
  // Stop after 25 ticks
  if (tick >= 25) {
    clearInterval(tickInterval);
    console.log('\n✅ Simulation complete!');
    
    // Display final market state
    const market = game.getMarket();
    console.log(market.displayMarket());
    
    console.log('\nGame is running. You can now iterate on mechanics.\n');
  }
}, 1000); // 1 second per tick
