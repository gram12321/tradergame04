# Edge Function Deployment Guide

## Overview

The `game-tick` edge function runs the game loop server-side, processing all game logic for all players every tick.

## Why No Code Duplication?

Instead of copying all game classes to the edge function, we implement the game logic directly using SQL operations. This approach:

- ✅ Eliminates code duplication
- ✅ Easier to maintain (one source of truth)
- ✅ Better performance (direct SQL queries)
- ✅ Works with manual deployment (no CLI needed)

## Deployment via Supabase Dashboard

### Step 1: Navigate to Edge Functions

1. Go to your Supabase project dashboard
2. Click on "Edge Functions" in the left sidebar
3. Click "Create a new function" or select the existing `game-tick` function

### Step 2: Deploy the Function

#### Option A: Direct Copy-Paste

1. Open `supabase/functions/game-tick/index.ts`
2. Copy the entire contents
3. In the Supabase dashboard, paste the code into the function editor
4. Click "Deploy"

#### Option B: Upload Files (if available)

1. Click "Deploy new version"
2. Upload `supabase/functions/game-tick/index.ts`
3. Upload `supabase/functions/deno.json` as the import map
4. Click "Deploy"

### Step 3: Configure Environment Variables

The edge function requires two environment variables:

1. In your Supabase dashboard, go to **Settings → Edge Functions**
2. Add the following secrets:

```bash
SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### Where to find these values:

- **SUPABASE_URL**: Settings → API → Project URL
- **SUPABASE_SERVICE_ROLE_KEY**: Settings → API → Project API keys → service_role key

⚠️ **Important**: Use the `service_role` key (not the `anon` key) as the edge function needs admin privileges to update game state.

### Step 4: Disable JWT Verification

Since this function is called by authenticated users but needs to process all game data:

1. In the function settings, find "JWT Verification"
2. Disable it (or ensure the function is called with proper authorization headers)

Alternatively, modify the client-side invocation to include auth headers.

## Testing the Function

### Via Supabase Dashboard

1. Go to Edge Functions → game-tick
2. Click "Invoke" or "Test"
3. You should see a response like:

```json
{
  "success": true,
  "message": "Tick 123 processed successfully",
  "tick": {
    "previous": 122,
    "current": 123
  },
  "stats": {
    "companies": 2,
    "facilities": 5,
    "routes": 3,
    "updated": 2,
    "duration": "45ms"
  }
}
```

### Via Your App

The app already has the invocation code in `src/App.tsx`:

```typescript
const { data, error } = await supabase.functions.invoke('game-tick')
```

Click the "Process Server Tick" button in the admin menu to test.

## Monitoring

### View Logs

1. Go to Edge Functions → game-tick
2. Click on "Logs" tab
3. You'll see console output from each invocation

### Common Errors

#### "Missing environment variables"

**Solution**: Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Edge Function secrets

#### "Failed to fetch game state"

**Solution**: Ensure the `game_state` table exists with proper schema:
- Columns: `id`, `tick_count`, `created_at`, `updated_at`
- Must have a row with `id='global'`

```sql
INSERT INTO game_state (id, tick_count, created_at, updated_at)
VALUES ('global', 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

#### "Companies/Facilities error"

**Solution**: Check that your database tables match the expected schema

## Future Enhancements

### Automated Scheduling

To run ticks automatically (e.g., every hour):

1. Use Supabase's pg_cron extension:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule tick every hour
SELECT cron.schedule(
  'game-tick-hourly',
  '0 * * * *',  -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://<your-project>.supabase.co/functions/v1/game-tick',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  );
  $$
);
```

2. Or use GitHub Actions to call the function periodically

### Implement Full Game Logic

Currently, the edge function has placeholder logic. To implement full game logic:

1. Expand the production facility processing to:
   - Check input inventory
   - Consume inputs according to recipes
   - Produce outputs
   - Update facility storage

2. Implement retail facility sales:
   - Calculate demand
   - Process sales
   - Update company cash
   - Deplete inventory

3. Execute trade routes:
   - Transfer resources between facilities
   - Update both source and destination inventories

See `src/game/GameEngine.ts` for reference implementation.

## Architecture Notes

### Why Direct SQL Instead of Game Classes?

**Pros:**
- No code duplication
- Better performance (batch operations)
- Easier to deploy (no complex bundling)
- Platform-native (works great with Supabase)

**Cons:**
- Game logic exists in two places (client classes + server SQL)
- Need to keep them in sync

**Future Alternative:**
- Bundle game classes with esbuild/deno bundle
- Deploy as single file
- Requires more complex deployment process

For now, the SQL approach is most practical given the constraint of no Supabase CLI.
