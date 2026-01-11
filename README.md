# Trading Game 04

A multiplayer trading engine with complex economic simulation and server-ready logic.


## Project Structure

```
src/
  game/
    Company.ts       - Company management (finances, facilities)
    FacilityBase.ts  - Shared logic for Production, Storage, Retail, Office
    City.ts          - Economic demand, population, wealth, and price sensitivity
    ContractSystem.ts- Market trades, sell offers, and internal logistics
    Registry/        - Centralized definitions (Resources, Recipes, Cities, etc.)
  database/          - Repositories for Supabase PostgreSQL persistence
  components/        - React UI components
```

## Development Status

Currently in **Transition to Phase 3**:
- Core engine is fully persistent via Supabase.
- Advanced retail economy with price sensitivity and cross-resource substitution.
- React frontend dashboard for live play and testing.

### Technology Stack
- **Core**: TypeScript (logic-first)
- **DB**: Supabase (PostgreSQL)
- **UI**: React 18 + Vanilla CSS
- **Test**: Custom TS test suite

## Next Steps

- Finalize server-side tick heartbeat.
- Multiplayer interaction features.
