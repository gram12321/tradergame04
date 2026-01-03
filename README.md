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

Currently in **Phase 1**: Pure game mechanics development.

- Focus on game balance and mechanics
- Test via console output
- No infrastructure dependencies
- Iterate quickly

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
