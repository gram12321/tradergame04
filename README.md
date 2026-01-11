# Trading Game 04

A multiplayer trading engine with complex economic simulation running 24/7 on the server.

## Project Architecture

- **`src/game/`** - Core game logic (single source of truth)
- **`src/database/`** - Supabase persistence layer
- **`src/components/`** - React UI
- **`supabase/functions/game-tick/`** - Edge function for server-side ticks

## Key Features

- ✅ Server-side game logic (24/7 automated gameplay)
- ✅ Real-time persistence via Supabase PostgreSQL
- ✅ Automatic hourly ticks via pg_cron
- ✅ Advanced retail economy with price sensitivity
- ✅ Multi-player support with inter-company contracts

## Technology Stack

- **Core**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **UI**: React 18 + Vite
- **Server**: Supabase Edge Functions (Deno)

## Development

```bash
# Install dependencies
npm install

# Run local dev server
npm run dev

# Deploy edge function (after changes)
# Push to GitHub, then redeploy via Supabase dashboard
```

### Technology Stack
- **Core**: TypeScript (logic-first)
- **DB**: Supabase (PostgreSQL)
- **UI**: React 18 + Vanilla CSS
- **Test**: Custom TS test suite

The edge function imports game logic directly from GitHub, ensuring:
- Zero code duplication
- Single source of truth in `src/`
- Automatic updates when pushed to GitHub

See `docs/DEVELOPMENT_PLAN.md` for detailed architecture and roadmap.
