# 🚀 Edge Function Deployment - Quick Start

## 1. Copy the Function Code

📁 Open: `supabase/functions/game-tick/index.ts`
📋 Copy the entire file content

## 2. Deploy to Supabase

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project: **Tradergame04**
3. Click **Edge Functions** in the left sidebar
4. Find or create function named: `game-tick`
5. Paste the code from step 1
6. Click **Deploy**

## 3. Set Environment Variables

Go to **Settings → Edge Functions → Secrets**

Add these two secrets:

```
Name: SUPABASE_URL
Value: [Your Project URL from Settings → API]

Name: SUPABASE_SERVICE_ROLE_KEY  
Value: [Your service_role key from Settings → API]
```

## 4. Test It

### Option A: Dashboard
1. Go to Edge Functions → game-tick
2. Click "Invoke Function"
3. Should see: `{ "success": true, "message": "Tick X processed..." }`

### Option B: Your App
1. Run your app: `npm run dev`
2. Open the Admin Menu
3. Click "Process Server Tick"
4. Check the logs for success message

## 5. Verify

Check the logs in Supabase:
- Edge Functions → game-tick → Logs
- Should see: "✅ Tick X completed in Xms"

## Troubleshooting

### ❌ "Missing environment variables"
→ Go back to step 3, ensure both variables are set

### ❌ "Failed to fetch game state"  
→ Make sure your `game_state` table exists with proper schema:
```sql
-- game_state table should have:
-- id (text), tick_count (integer), created_at (timestamp), updated_at (timestamp)
INSERT INTO game_state (id, tick_count, created_at, updated_at)
VALUES ('global', 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

### ❌ Function not found
→ Make sure the function name is exactly `game-tick` (with hyphen)

### ❌ "Access denied" / Permission errors
→ Make sure you're using `SUPABASE_SERVICE_ROLE_KEY` (not anon key)

## Files Structure

```
supabase/functions/
├── game-tick/
│   └── index.ts          ← Single file to deploy
├── deno.json             ← Config (may need to upload too)
└── _shared/              ← Not needed (cors inline)
```

## What Changed from Previous Implementation?

- ❌ Removed: 25+ duplicated files
- ❌ Removed: Build script
- ✅ Added: Single self-contained edge function
- ✅ Added: Direct SQL implementation

## Need More Info?

- Full guide: `docs/EDGE_FUNCTION_DEPLOYMENT.md`
- Solution details: `docs/PHASE3_SOLUTION_SUMMARY.md`
- Development plan: `docs/DEVELOPMENT_PLAN.md`
