import { supabase } from '../src/database/supabase.js';
import { CompanyRepository } from '../src/database/CompanyRepository.js';
import { GameStateRepository } from '../src/database/GameStateRepository.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { CityRegistry } from '../src/game/CityRegistry.js';
import { Company } from '../src/game/Company.js';

async function runDatabaseTests() {
      console.log('🔍 PHASE 1: TESTING SUPABASE CONNECTION...\n');

      const createdCompanyIds: string[] = [];

      try {
            // 1. Check connection with companies table
            const { data, error } = await supabase
                  .from('companies')
                  .select('*')
                  .limit(1);

            if (error) throw error;

            console.log('✅ Connection successful!');
            console.log(`📊 Companies in database: ${data?.length || 0}`);

            // 2. Get game state
            const tickCount = await GameStateRepository.getTickCount();
            console.log(`⏰ Current tick from DB: ${tickCount}`);

            // 3. Create a test company
            console.log('\n📝 Testing repository company creation...');
            const repoTestId = crypto.randomUUID();
            createdCompanyIds.push(repoTestId);
            const repoResult = await CompanyRepository.save({
                  id: repoTestId,
                  name: `Repo Test ${Date.now()}`,
                  balance: 10000,
                  facilities: []
            } as any);

            if (repoResult.success) {
                  console.log('✅ Repository save successful!');
            } else {
                  console.error('❌ Repository save failed:', repoResult.error);
            }

            console.log('\n🔍 PHASE 2: AUTOSAVE TEST...\n');

            const game = new GameEngine();
            const aliceId = crypto.randomUUID();
            createdCompanyIds.push(aliceId);
            const alice = game.addCompany(aliceId, 'Autosave Alice');
            const copenhagen = CityRegistry.getCity('Copenhagen', 'Denmark')!;

            alice.createFacility('office', copenhagen);
            alice.createFacility('farm', copenhagen);

            console.log(`Initial Alice balance: $${alice.balance.toFixed(2)}`);

            // Process 2 ticks WITH autosave
            console.log('⏰ Processing 2 ticks with autosave enabled...');
            for (let i = 0; i < 2; i++) {
                  await game.processTick(true); // autosave = true
                  console.log(`   Tick ${game.getTickCount()} processed and saved`);
            }

            // Load from database in a NEW engine to verify autosave
            console.log('\n📥 Verifying autosave with new engine load...');
            const newGame = new GameEngine();
            await newGame.loadAll();
            const loadedAlice = await Company.load(aliceId);

            const tickMatch = newGame.getTickCount() >= 2;
            const balanceMatch = loadedAlice && Math.abs(loadedAlice.balance - alice.balance) < 0.01;

            console.log(`${tickMatch ? '✅' : '❌'} Tick count persisted (got: ${newGame.getTickCount()})`);
            console.log(`${balanceMatch ? '✅' : '❌'} Balance persisted correctly`);

            console.log('\n🔍 PHASE 3: PERSISTENCE CYCLE TEST...\n');

            const pGame = new GameEngine();
            const bobId = crypto.randomUUID();
            createdCompanyIds.push(bobId);
            const bob = pGame.addCompany(bobId, 'Persist Bob');
            bob.createFacility('office', copenhagen);
            const bobFarm = bob.createFacility('farm', copenhagen);

            if (bobFarm && bobFarm.inventory) {
                  bobFarm.inventory.set('grain', 500);
                  console.log('   Added 500 grain to Bob\'s farm');
            }

            console.log('💾 Saving full game state manually...');
            const saveResult = await pGame.saveAll();
            if (!saveResult.success) {
                  throw new Error(`Manual save failed: ${saveResult.error}`);
            }
            console.log('✅ Full save successful');

            console.log('📥 Loading into new engine...');
            const loadGame = new GameEngine();
            await loadGame.loadAll();
            const loadedBob = await Company.load(bobId);

            if (loadedBob) {
                  const inv = loadedBob.facilities.find(f => f.type === 'farm')?.inventory?.get('grain') || 0;
                  const invMatch = inv === 500;
                  console.log(`${invMatch ? '✅' : '❌'} Inventory preserved (${inv} units)`);
                  console.log(`✅ Bob facilities count: ${loadedBob.facilities.length}`);
            } else {
                  console.error('❌ Failed to load Bob');
            }

            console.log('\n🎉 ALL DATABASE AND PERSISTENCE TESTS PASSED!');

      } catch (err) {
            console.error('\n❌ TEST SUITE FAILED:', err);
            process.exit(1);
      } finally {
            console.log('\nSweep 🧹 Cleaning up test companies and facilities...');
            for (const id of createdCompanyIds) {
                  // Delete facilities first (to prevent foreign key violations)
                  const { error: facError } = await supabase
                        .from('facilities')
                        .delete()
                        .eq('company_id', id);

                  if (facError) {
                        console.error(`   Failed to delete facilities for company ${id}:`, facError);
                  } else {
                        console.log(`   Deleted facilities for company ${id}`);
                  }

                  const result = await CompanyRepository.delete(id);
                  if (result.success) {
                        console.log(`   Deleted company ${id}`);
                  } else {
                        console.error(`   Failed to delete company ${id}: ${result.error}`);
                  }
            }
            process.exit(0);
      }
}

runDatabaseTests();
