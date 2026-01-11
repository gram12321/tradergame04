# GitHub Imports - Quick Deployment Guide

## ✅ Status: Ready to Deploy!

Your edge function now uses **GitHub imports** - no code duplication! 

## 🚀 Deployment Steps (3 minutes)

### Step 1: Commit and Push to GitHub ⚡

```bash
# Add all changes
git add .

# Commit with clear message
git commit -m "Implement GitHub imports for edge function - zero code duplication"

# Push to GitHub main branch
git push origin main
```

**Why?** The edge function imports your code from GitHub, so it needs to be pushed first.

### Step 2: Deploy Edge Function to Supabase 📤

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard/project/[your-project-id]
   - Navigate to **Edge Functions** section

2. **Update game-tick function**
   - Click on `game-tick` function
   - Click **Edit** button
   - **Copy** the contents of `supabase/functions/game-tick/index.ts`
   - **Paste** into the editor
   - Click **Deploy**

3. **Verify deployment**
   - Check logs show: `📦 Using GitHub imports from: gram12321/tradergame04@main`
   - Test by clicking "Server Tick" in your app

### Step 3: Test ✅

1. **Manual test**: Click "Server Tick" button in your app
2. **Check logs**: Supabase dashboard → Edge Functions → game-tick → Logs
3. **Verify automatic tick**: Wait for next hour (0 minutes past) or check cron logs:

```sql
SELECT jobname, start_time, status, return_message
FROM cron.job_run_details
WHERE jobname = 'game-tick-hourly'
ORDER BY start_time DESC
LIMIT 3;
```

## 📋 What Changed

| Before | After |
|--------|-------|
| Duplicated code in `supabase/functions/game-tick/game/` | ❌ Deleted |
| Duplicated code in `supabase/functions/game-tick/database/` | ❌ Deleted |
| Edge function imports from local files | ✅ Imports from GitHub |
| Manual code sync required | ✅ Auto-updates from main branch |

## 🎯 New Development Workflow

1. **Edit** `src/` TypeScript files (game logic, facilities, etc.)
2. **Test** locally with React app (`npm run dev`)
3. **Commit** and push to GitHub
4. **Done!** Edge function uses updated code (after cache refresh or redeploy)

## 🔧 Key Files

- `supabase/functions/game-tick/index.ts` - Edge function (imports from GitHub)
- `docs/GITHUB_IMPORTS_SOLUTION.md` - Comprehensive documentation
- All game logic stays in `src/game/` and `src/database/`

## 🚨 Important Notes

✅ **Repository is public** - GitHub imports work  
✅ **JWT verification disabled** - pg_cron can invoke function  
✅ **Hourly cron job active** - Automatic ticks every hour  
✅ **Environment variables set** - SUPABASE_URL and SERVICE_ROLE_KEY  

## 🆘 Troubleshooting

**Edge function fails with "module not found"**
- Solution: Ensure code is pushed to GitHub (`git push origin main`)

**Edge function uses old code**
- Solution: Redeploy the function to clear Deno's cache

**Import errors in logs**
- Solution: Check file exists on GitHub at expected path

## 📚 More Info

See `docs/GITHUB_IMPORTS_SOLUTION.md` for complete documentation.

---

**Ready?** Run the commands above and you're done! 🎉
