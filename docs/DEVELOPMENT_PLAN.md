# Trading Game Development Plan

## Core Philosophy
Keep game logic pure and infrastructure-agnostic. Build mechanics first, add infrastructure later.

## Phase 1: Pure Game Logic (COMPLETE)
**Goal:** Develop core game mechanics with zero overhead

- Plain TypeScript classes for Company, Facility, Resource, Recipe, City.
- Logic environment tested with `engine.test.ts`.

## Phase 2: Add Persistence (COMPLETE)
**Goal:** Save/load game state without rewriting logic

- Added `CompanyRepository`, `FacilityRepository`, `GameRepository`, etc.
- Multi-tenancy support (multiple companies in one database).
- Connected to Supabase PostgreSQL.
- Autosave on each tick.

---

## Phase 3: Global Tick System (COMPLETE)
**Goal:** Game runs continuously for all players, 24/7 server-side execution

**Status:**
- ✅ Edge function imports code directly from GitHub (zero duplication!)
- ✅ Full game logic runs server-side using TypeScript from `src/`
- ✅ Automatic hourly tick via pg_cron
- ✅ No build step or bundling required
- ✅ Development continues in `src/` - just push to GitHub
- See `docs/GITHUB_IMPORTS_SOLUTION.md` for complete documentation
- See `GITHUB_IMPORTS_QUICKSTART.md` for deployment steps

**How it works:**
- Edge function imports TypeScript directly from your public GitHub repo
- Deno resolves all dependencies automatically
- Push code to GitHub → edge function uses latest code (after cache refresh)
- Single source of truth: all game logic stays in `src/`

---

## Phase 4: React Frontend (IN PROGRESS)
**Goal:** Visual interface for players

**Status:**
- `src/App.tsx` provides a full React dashboard.
- Includes Company management, Market display, and Admin tools.
- Real-time updates and manual/auto-tick controls.

---

## Key Advantages of This Approach

✅ **No rewrites** - Game logic written once, used everywhere  
✅ **Fast iteration** - Change mechanics instantly, no deploy needed  
✅ **Infrastructure-agnostic** - Logic works in any environment  
✅ **Testable** - Pure functions, easy to test  
✅ **Multiplayer-ready** - Server-authoritative from day one  

---

## Technical Notes

### Game Tick Frequency
- Current: User-driven (manual or periodic timer).
- Future: Server-side heartbeat (1-hour intervals).

---

## Current Status
**Phase 2 & 4** - Persistence implemented and UI is in active development.
