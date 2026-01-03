# Trading Game Development Plan

## Core Philosophy
Keep game logic pure and infrastructure-agnostic. Build mechanics first, add infrastructure later.

## Phase 1: Pure Game Logic (NOW)
**Goal:** Develop core game mechanics with zero overhead

**Setup:**
- Plain TypeScript classes
- No database, no UI, no state management
- Test via console output
- Run locally with `npm run dev`

**Files:**
```
src/
  game/
    Player.ts        # Player state & actions
    Market.ts        # Trading/market mechanics
    GameEngine.ts    # Core game loop & tick logic
  test.ts            # Console-based testing
```

**Key Principle:** All game logic is pure TypeScript. No external dependencies.

---

## Phase 2: Add Persistence (LATER)
**Goal:** Save/load game state without rewriting logic

**Changes:**
- Add data layer (load/save methods to classes)
- Connect to Supabase PostgreSQL
- Game logic remains unchanged
- Still runs locally for testing


## Phase 3: Global Tick System (LATER)
**Goal:** Game runs continuously for all players

**Architecture:**
1. Deploy game logic as Supabase Edge Function
2. Set up pg_cron to trigger Edge Function every minute

**Edge Function (supabase/functions/process-tick/index.ts):**
```typescript
import { GameEngine } from '../../../src/game/GameEngine.ts';

Deno.serve(async (req) => {
  const engine = new GameEngine();
  await engine.loadAllPlayers();
  engine.processTick();
  await engine.saveAllPlayers();
  
  return new Response(JSON.stringify({ success: true }));
});
```

**pg_cron Setup:**
```sql
SELECT cron.schedule(
  'global-game-tick',
  '* * * * *',  -- Every minute (adjust as needed)
  $$ 
    SELECT net.http_post(
      'https://YOUR_PROJECT.functions.supabase.co/process-tick',
      '{}'::jsonb,
      headers := '{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
    )
  $$
);
```

---

## Phase 4: Add React Frontend (FAR FUTURE)
**Goal:** Visual interface for players

**Architecture:**
- React/TypeScript/Tailwind/shadcn/ui
- Frontend displays state only
- Player actions call Supabase Edge Functions
- Game logic stays on server

**Example Flow:**
1. Player clicks "Buy Stock"
2. React calls Edge Function `buy-stock`
3. Edge Function uses existing `Player.buyStock()` method
4. Returns updated state to frontend

**Key Principle:** Frontend never runs game logic, only displays and sends commands.

---

## Key Advantages of This Approach

✅ **No rewrites** - Game logic written once, used everywhere  
✅ **Fast iteration** - Change mechanics instantly, no deploy needed  
✅ **Infrastructure-agnostic** - Logic works in any environment  
✅ **Testable** - Pure functions, easy to test  
✅ **Multiplayer-ready** - Server-authoritative from day one  

---

## Technical Notes


### Game Tick Frequency
- Start with 1 minute intervals
- Adjust based on game design (could be 30s, 5 min, etc.)
- pg_cron supports any cron schedule

---

## Current Status
**Phase 1** - Setting up pure TypeScript game logic environment
