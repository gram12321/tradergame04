# Supabase Edge Functions

## game-tick Function

**Purpose**: Processes global game ticks server-side for 24/7 automated gameplay.

**Architecture**: Imports TypeScript code directly from GitHub repository.

```typescript
// Edge function imports from GitHub
const GITHUB_MAIN = "https://raw.githubusercontent.com/gram12321/tradergame04/main/src";
import { GameEngine } from `${GITHUB_MAIN}/game/GameEngine.ts`;
```

### Deployment

1. **Update game logic** in `src/game/` or `src/database/`
2. **Commit and push** to GitHub main branch
3. **Redeploy edge function** via Supabase dashboard (updates import cache)

### Configuration

- **JWT Verification**: Disabled (allows pg_cron invocation)
- **Environment Variables**: Auto-provided by Supabase
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Automatic Execution

Runs hourly via pg_cron:
- **Schedule**: `0 * * * *` (every hour at minute 0)
- **Timeout**: 30 seconds
- **Invocation**: Via `net.http_post`

### Manual Testing

Use "Server Tick" button in the app or SQL:

```sql
SELECT net.http_post(
  url := 'https://[project-ref].supabase.co/functions/v1/game-tick',
  body := '{}',
  headers := '{"Content-Type": "application/json"}'::jsonb
);
```

## Benefits

✅ Zero code duplication  
✅ Single source of truth in `src/`  
✅ Automatic updates from GitHub  
✅ Full TypeScript game logic on server  
✅ 24/7 gameplay for all players
