import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("🎮 Game Tick Edge Function initialized");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Supabase dashboard.');
    }

    console.log('✓ Environment variables loaded');
    
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // ======================
    // 1. GET CURRENT TICK
    // ======================
    const { data: gameState, error: fetchError } = await supabase
      .from('game_state')
      .select('tick_count')
      .eq('id', 'global')
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch game state: ${fetchError.message}`);
    }

    const currentTick = gameState?.tick_count || 0;
    const newTick = currentTick + 1;
    console.log(`📊 Current tick: ${currentTick} → ${newTick}`);

    // ======================
    // 2. FETCH GAME DATA
    // ======================
    const [companiesResult, facilitiesResult, routesResult] = await Promise.all([
      supabase.from('companies').select('*'),
      supabase.from('facilities').select('*'),
      supabase.from('trade_routes').select('*')
    ]);

    if (companiesResult.error) throw new Error(`Companies: ${companiesResult.error.message}`);
    if (facilitiesResult.error) throw new Error(`Facilities: ${facilitiesResult.error.message}`);
    if (routesResult.error) throw new Error(`Routes: ${routesResult.error.message}`);

    const companies = companiesResult.data || [];
    const facilities = facilitiesResult.data || [];
    const routes = routesResult.data || [];

    console.log(`✓ Loaded: ${companies.length} companies, ${facilities.length} facilities, ${routes.length} routes`);

    // ======================
    // 3. PROCESS GAME LOGIC
    // ======================
    const updates = {
      facilities: [] as any[],
      companies: [] as any[],
      routes: [] as any[]
    };

    // Process each facility based on type
    for (const facility of facilities) {
      const facilityData = facility.data || {};
      
      if (facility.type === 'production') {
        // Process production facilities
        if (facilityData.recipe) {
          // Check if facility has required inputs
          const canProduce = true; // TODO: Check input inventory
          
          if (canProduce) {
            // Deduct inputs and add outputs
            // For now, just mark it as processed
            facilityData.lastProduction = new Date().toISOString();
            updates.facilities.push({
              ...facility,
              data: facilityData
            });
          }
        }
      } else if (facility.type === 'retail') {
        // Process retail facilities
        // TODO: Process sales
        facilityData.lastSale = new Date().toISOString();
        updates.facilities.push({
          ...facility,
          data: facilityData
        });
      }
      // Storage facilities don't need processing
    }

    // Process trade routes
    for (const route of routes) {
      if (route.active) {
        // TODO: Execute trade route transfers
        console.log(`Processing route: ${route.id}`);
      }
    }

    console.log(`✓ Processed ${updates.facilities.length} facility updates`);

    // ======================
    // 4. SAVE UPDATES
    // ======================
    
    // Update facilities in batch
    if (updates.facilities.length > 0) {
      const { error: updateError } = await supabase
        .from('facilities')
        .upsert(updates.facilities);
      
      if (updateError) {
        console.error('Failed to update facilities:', updateError);
      }
    }

    // Update tick count
    const { error: tickError } = await supabase
      .from('game_state')
      .upsert({
        id: 'global',
        tick_count: newTick,
        updated_at: new Date().toISOString()
      });

    if (tickError) {
      throw new Error(`Failed to update tick: ${tickError.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Tick ${newTick} completed in ${duration}ms`);

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
          facilities: facilities.length,
          routes: routes.length,
          updated: updates.facilities.length,
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
