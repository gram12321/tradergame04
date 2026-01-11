import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================
// GITHUB IMPORTS - NO CODE DUPLICATION! 🎉
// ============================================
// Import TypeScript directly from your GitHub repository
// Deno will automatically follow all relative imports in the files
const GITHUB_MAIN = "https://raw.githubusercontent.com/gram12321/tradergame04/main/src";

// Import game engine from GitHub - Deno will resolve all nested imports automatically!
const GameEngineModule = await import(`${GITHUB_MAIN}/game/GameEngine.ts`);
const GameEngine = GameEngineModule.GameEngine;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("🎮 Game Tick Edge Function initialized");
console.log("📦 Using GitHub imports from: gram12321/tradergame04@main");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ======================
    // 1. INITIALIZE ENGINE
    // ======================
    console.log('🔧 Initializing GameEngine...');
    const engine = new GameEngine();

    // ======================
    // 2. LOAD GAME STATE
    // ======================
    console.log('📥 Loading game state from database...');
    const loadResult = await engine.loadAll();
    
    if (!loadResult.success) {
      throw new Error(`Failed to load game state: ${loadResult.error}`);
    }

    const currentTick = engine.getTickCount();
    console.log(`📊 Current tick: ${currentTick} → ${currentTick + 1}`);

    // ======================
    // 3. PROCESS GAME TICK
    // ======================
    console.log('⚙️ Processing game tick...');
    const tickResult = await engine.tick();
    
    if (!tickResult.success) {
      throw new Error(`Tick processing failed: ${tickResult.error}`);
    }

    // ======================
    // 4. SAVE GAME STATE
    // ======================
    console.log('💾 Saving game state to database...');
    const saveResult = await engine.saveAll();
    
    if (!saveResult.success) {
      throw new Error(`Failed to save game state: ${saveResult.error}`);
    }

    const newTick = engine.getTickCount();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Tick ${newTick} completed in ${duration}ms`);

    // Get stats
    const companies = engine.getCompanies();
    const totalFacilities = companies.reduce((sum, c) => sum + c.getFacilityCount(), 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tick ${newTick} processed successfully`,
        tick: {
          previous: currentTick,
          current: newTick
        },
        stats: {
          companies: companies.length,
          facilities: totalFacilities,
          duration: `${duration}ms`
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error: any) {
    console.error('❌ Tick processing failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
