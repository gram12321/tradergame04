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
  
  // Create sell offers on the market at tick 18
  if (tick === 18) {
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
  
  // Bob creates a contract to buy bread from Alice at tick 22
  if (tick === 22 && bob.facilities.length > 0) {
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
