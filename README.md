# Trading Game 04

A multiplayer trading/clicker game with server-side game logic.

## Quick Start

```bash
# Install dependencies
npm install

# Run development mode (auto-reloads on file changes)
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

## Project Structure

```
src/
  game/
    Player.ts        - Player state and trading actions
    Market.ts        - Market price simulation
    GameEngine.ts    - Core game loop and tick processing
  test.ts            - Test simulation runner
```

## Development

Currently in **Phase 2**: Database Persistence with Supabase.

- Game state persists across browser refreshes
- Autosave on each tick
- Supabase PostgreSQL database backend

### Important: Browser vs Node.js

The project uses different Supabase clients for browser and Node.js:
- **Browser**: Uses Supabase CDN (loaded in index.html), with manual override in `dist/database/supabase.js`
- **Node.js**: Uses npm package via TypeScript compilation

After running `npm run build`, you must manually ensure `dist/database/supabase.js` uses the browser client:
```javascript
export const supabase = window.supabaseClient;
```

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the full roadmap.

## Game Mechanics (Current)

- Players start with 1000 gold
- Can buy/sell stocks at market price
- Market price fluctuates each tick
- Passive income from gold and stocks
- Game ticks happen every second in test mode

## Next Steps

Iterate on:
- Balance passive income rates
- Add more trading mechanics
- Implement upgrades/multipliers
- Add player interactions
