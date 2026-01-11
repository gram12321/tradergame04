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

## Phase 3: Global Tick System (IN PROGRESS)
**Goal:** Game runs continuously for all players

**Status:**
- Game logic is ready for server-side execution.
- Edge functions are planned for a centralized tick system to replace client-side ticking.

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
