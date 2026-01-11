# GitHub Imports Solution - No Code Duplication! 🎉

## Overview

Your edge function now imports TypeScript code **directly from your GitHub repository**. This means:
- ✅ **Zero code duplication** - only one source of truth in `src/`
- ✅ **Automatic updates** - push to GitHub, and edge function uses latest code
- ✅ **Server-side game logic** - entire game runs 24/7 on Supabase
- ✅ **TypeScript development** - continue working in `src/` as normal

## How It Works

The edge function at `supabase/functions/game-tick/index.ts` imports your `GameEngine` directly from GitHub:

```typescript
const GITHUB_MAIN = "https://raw.githubusercontent.com/gram12321/tradergame04/main/src";
const GameEngineModule = await import(`${GITHUB_MAIN}/game/GameEngine.ts`);
```

Deno automatically:
1. Fetches `GameEngine.ts` from your GitHub repository
2. Follows all relative imports (e.g., `./Company.js`, `../database/GameStateRepository.js`)
3. Caches the modules for fast execution
4. Resolves `.js` extensions to `.ts` files on GitHub

## Important: File Extension Handling

Your source files use `.js` extensions in imports (for ESM/browser compatibility):
```typescript
import { Company } from './Company.js';
```

But GitHub serves `.ts` files. **Deno handles this automatically** when importing from URLs - it's smart enough to resolve `.js` → `.ts` for TypeScript files fetched from remote URLs.

## Setup Steps

### 1. Commit and Push Your Code

**Critical**: The edge function imports from your GitHub repository, so you need to push your latest code:

```bash
git add src/
git commit -m "Update game logic"
git push origin main
```

After pushing, Supabase edge function will use the latest code from GitHub!

### 2. Deploy the Edge Function

#### Option A: Via Supabase Dashboard (Recommended)
1. Go to **Edge Functions** in your Supabase dashboard
2. Edit the `game-tick` function
3. Copy the contents of `supabase/functions/game-tick/index.ts`
4. Paste and **Deploy**

#### Option B: Manual Upload
1. Copy `supabase/functions/game-tick/index.ts`
2. Create/update the function in Supabase dashboard
3. Ensure **JWT verification is DISABLED** (already done)

### 3. Set Environment Variables

The edge function needs these environment variables (should already be set):
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase

These are used by `src/database/supabase.ts` which detects Deno environment automatically.

## Development Workflow

### Your New Workflow (No More Duplication!)

1. **Develop in `src/`** - Work on your TypeScript files as normal
   ```bash
   # Edit src/game/Company.ts, src/game/ProductionFacility.ts, etc.
   ```

2. **Test locally** - Use your React app to test changes
   ```bash
   npm run dev
   ```

3. **Push to GitHub** - Commit and push when ready
   ```bash
   git add .
   git commit -m "Add new game feature"
   git push origin main
   ```

4. **Edge function updates automatically** - Next time the cron job runs, it uses your latest code!
   - Deno caches imports for ~24 hours
   - To force immediate update, redeploy the edge function (it will re-fetch)

### Force Immediate Update

If you need the edge function to use updated code immediately:

1. **Trigger cache refresh**:
   - Go to Supabase dashboard → Edge Functions → game-tick
   - Click "Deploy" (even without changes)
   - This clears Deno's cache and re-fetches from GitHub

2. **Or use cache-busting query param** (advanced):
   ```typescript
   // In index.ts, add version to import
   const version = Date.now(); // or commit SHA
   await import(`${GITHUB_MAIN}/game/GameEngine.ts?v=${version}`);
   ```

## Testing

### Test the Edge Function

1. **Manual Test** - Click "Server Tick" button in your app
2. **View Logs** - Check Supabase Edge Functions logs:
   ```
   📦 Using GitHub imports from: gram12321/tradergame04@main
   🔧 Initializing GameEngine...
   📥 Loading game state from database...
   ```

3. **Verify Automatic Ticks** - Check pg_cron execution:
   ```sql
   SELECT jobname, start_time, status, return_message
   FROM cron.job_run_details
   ORDER BY start_time DESC
   LIMIT 5;
   ```

## Troubleshooting

### "Failed to fetch module"
- **Cause**: Code not pushed to GitHub, or repository is private
- **Fix**: 
  ```bash
  git push origin main
  ```
  - Ensure repository is **public** (gram12321/tradergame04 is public ✓)

### "Cannot find module"
- **Cause**: Import path incorrect or file doesn't exist on GitHub
- **Fix**: Check the file exists at:
  `https://github.com/gram12321/tradergame04/blob/main/src/game/GameEngine.ts`

### "Relative import failed"
- **Cause**: Nested imports in your source files
- **Fix**: Deno should handle this automatically. If not:
  1. Check that all files are pushed to GitHub
  2. Verify import paths are correct (case-sensitive!)

### Edge function uses old code
- **Cause**: Deno's import cache (24-hour TTL)
- **Fix**: Redeploy the edge function to clear cache

### Import works locally but fails in edge function
- **Cause**: Environment variable differences (VITE_ prefix)
- **Fix**: The `src/database/supabase.ts` already handles this:
  ```typescript
  const getEnv = (name: string): string => {
    if (typeof Deno !== 'undefined') {
      return Deno.env.get(name) || Deno.env.get(name.replace('VITE_', '')) || '';
    }
    // Vite/Browser fallback...
  };
  ```

## Architecture Benefits

### ✅ What You Gain
- **Single source of truth** - All game logic in `src/`
- **Simple deployment** - Just push to GitHub
- **No build step** - Deno handles TypeScript natively
- **Version control** - Use git branches/tags for different versions
- **Easy rollback** - Change GitHub branch in import URL

### ⚠️ Trade-offs
- **GitHub dependency** - Edge function needs GitHub access (public repo)
- **Cache delay** - Updates take effect after cache refresh (~24h or manual redeploy)
- **Network latency** - First cold start fetches from GitHub (then cached)

### 🚀 Future Enhancements
- **Use commit SHA in imports** - Pin to specific version
  ```typescript
  const GITHUB_BASE = "https://raw.githubusercontent.com/gram12321/tradergame04/9c63d5b3/src";
  ```
- **Environment-based imports** - Use different branches for dev/prod
  ```typescript
  const branch = Deno.env.get('GITHUB_BRANCH') || 'main';
  const GITHUB_BASE = `https://raw.githubusercontent.com/gram12321/tradergame04/${branch}/src`;
  ```
- **Automatic deployment trigger** - Use GitHub Actions to redeploy edge function on push

## Current Status

✅ Edge function created with GitHub imports  
✅ Automatic hourly tick via pg_cron  
✅ Zero code duplication  
✅ Development continues in `src/` TypeScript files  

**Next Step**: Commit and push your current code, then deploy the updated edge function!

```bash
git add .
git commit -m "Implement GitHub imports for edge function - no code duplication"
git push origin main
```

Then redeploy `game-tick` in Supabase dashboard.
