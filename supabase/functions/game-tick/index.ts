import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================
// GITHUB IMPORTS - NO CODE DUPLICATION! 🎉
// ============================================
const GITHUB_MAIN = "https://raw.githubusercontent.com/gram12321/tradergame04/main/src";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("🎮 Game Tick Edge Function initialized");
console.log("📦 Will import from GitHub on first request");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Import game engine from GitHub on each request
    console.log('📦 Importing GameEngine from GitHub...');
    const { GameEngine } = await import(`${GITHUB_MAIN}/game/GameEngine.ts`);
    console.log('✓ GameEngine imported successfully');

    console.log('🔧 Initializing GameEngine...');
    const engine = new GameEngine();

    console.log('📥 Loading game state from database...');
    const loadResult = await engine.loadAll();
    
    if (!loadResult.success) {
      throw new Error(`Failed to load game state: ${loadResult.error}`);
    }

    const currentTick = engine.getTickCount();
    console.log(`📊 Current tick: ${currentTick} → ${currentTick + 1}`);

    console.log('⚙️ Processing game tick...');
    const tickResult = await engine.tick();
    
    if (!tickResult.success) {
      throw new Error(`Tick processing failed: ${tickResult.error}`);
    }

    console.log('💾 Saving game state to database...');
    const saveResult = await engine.saveAll();
    
    if (!saveResult.success) {
      throw new Error(`Failed to save game state: ${saveResult.error}`);
    }

    const newTick = engine.getTickCount();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Tick ${newTick} completed in ${duration}ms`);

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
    console.error('Error stack:', error.stack);
    console.error('Error cause:', error.cause);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack,
        cause: error.cause?.toString(),
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
