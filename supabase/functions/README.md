# Supabase Edge Functions

This directory contains Supabase Edge Functions (Deno-based serverless functions).

## 📁 Structure

```
supabase/functions/
├── _shared/           # Shared utilities (CORS headers, etc.)
├── deno.json          # Deno configuration and import maps
└── game-tick/         # Global tick processor
    └── index.ts       # Main edge function
```

## 🎮 game-tick Function

**Purpose**: Process global game ticks server-side (24/7 automated gameplay)

**Architecture**: Uses **GitHub imports** to load game logic directly from the repository
- No code duplication
- Single source of truth in `src/`
- Automatic updates when code is pushed to GitHub

**Import Pattern**:
```typescript
const GITHUB_MAIN = "https://raw.githubusercontent.com/gram12321/tradergame04/main/src";
const GameEngineModule = await import(`${GITHUB_MAIN}/game/GameEngine.ts`);
```

Deno automatically:
- Fetches TypeScript files from GitHub
- Resolves all relative imports (Company, Facilities, Repositories, etc.)
- Caches modules for fast execution
- Handles `.js` → `.ts` extension mapping

## 🚀 Deployment

See `GITHUB_IMPORTS_QUICKSTART.md` in the root for deployment instructions.

**Quick steps**:
1. Push code to GitHub: `git push origin main`
2. Deploy via Supabase dashboard
3. Edge function uses latest code from GitHub

## ⚙️ Configuration

**Environment Variables** (auto-provided by Supabase):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

**Invocation**:
- Manual: Via app's "Server Tick" button
- Automatic: pg_cron runs hourly at minute 0

## 🔧 Development Workflow

1. Edit game logic in `src/game/` or `src/database/`
2. Test locally with React app
3. Commit and push to GitHub
4. Edge function automatically uses updated code (after cache refresh or redeploy)

**No code sync or bundling required!**

## 📚 Documentation

- `docs/GITHUB_IMPORTS_SOLUTION.md` - Complete technical documentation
- `GITHUB_IMPORTS_QUICKSTART.md` - Quick deployment guide
- `docs/DEVELOPMENT_PLAN.md` - Overall project architecture

## ⚠️ Important Notes

- Repository must be **public** for GitHub imports to work (✓ gram12321/tradergame04 is public)
- Deno caches imports for ~24 hours (redeploy to force refresh)
- JWT verification must be **disabled** for pg_cron invocation (✓ already disabled)
