# Stack Research: Nirmata Runner v2.0

## Existing Stack (DO NOT re-research)

- TypeScript + Next.js (API routes for server authority)
- PixiJS (tile-based rendering, CompositeTilemap, camera, FOV, animations)
- React + Zustand (UI layer, state bridge)
- Custom ECS (entity-component-system with JSON templates, event bus)
- rot-js (A* pathfinding, Alea PRNG)
- Vitest (testing)
- Zod (schema validation)

## Stack Additions Needed for v2.0

### 1. Status Effect / Buff System Engine

**Need:** Neural Heat, Kernel Panic effects, Augment triggers, and enemy debuffs (HUD glitch, input lag, firmware lock) all require a generic status effect system.

**Recommendation:** Build in-house using ECS components. No library needed.
- `StatusEffect` component with `type`, `duration`, `magnitude`, `source`
- `StatusEffectSystem` processes effects each turn (tick, expire, apply)
- **Confidence:** High — status effects are pure data transforms on existing components

### 2. State Persistence Layer

**Need:** Stash, Vault, Blueprint library, currency balances, and Shell configurations must persist between runs and across the weekly cycle.

**Recommendation:** Start with server-side JSON/file storage via Next.js API routes. Migrate to a database only when scaling requires it.
- `/api/stash` — CRUD for player inventory
- `/api/blueprints` — Blueprint library management
- `/api/economy` — Currency transactions
- **Confidence:** High — Next.js API routes already handle game state; extend the pattern

### 3. Seeded Weekly/Daily Run Generation

**Need:** Global seeds for Weekly and Daily challenges that produce identical dungeons for all players.

**Recommendation:** Extend existing rot-js Alea PRNG seeding.
- Weekly seed derived from ISO week number + year
- Daily seed derived from ISO date string
- Neural Simulation seeds from `Date.now()` or player-chosen
- **Confidence:** High — already using seeded generation

### 4. Leaderboard Storage

**Need:** Daily/Weekly leaderboard for competitive scoring.

**Recommendation:** Server-side storage via Next.js API routes. Simple sorted arrays initially.
- Score = depth reached + enemies killed + loot extracted (weighted)
- **Confidence:** Medium — scoring formula needs playtesting

### 5. Timer/Scheduler for Weekly Reset

**Need:** Automated weekly blueprint purge and seed rotation.

**Recommendation:** Server-side cron job or Next.js middleware that checks timestamps.
- On Monday 00:00 UTC: rotate seed, deprecate blueprints to "Legacy Code"
- Client polls `/api/season` for current week metadata
- **Confidence:** Medium — exact reset behavior needs design iteration

### 6. Enhanced Visual Effects

**Need:** Glitch shaders, screen-tearing, HUD jitter, color inversion, dead pixel trails.

**Recommendation:** PixiJS filters + custom fragment shaders.
- `@pixi/filter-glitch` — for glitch displacement effects
- `@pixi/filter-crt` — CRT scanline overlay
- Custom `KernelPanicFilter` — heat-responsive visual corruption
- CSS animations for HUD-level effects (jitter, flicker)
- **Confidence:** Medium — PixiJS filter pipeline is well-documented but custom shaders need testing

### What NOT to Add

| Technology | Why NOT |
|-----------|---------|
| SQLite/PostgreSQL | Premature for v2.0; JSON persistence is sufficient for single-player |
| WebSocket/real-time networking | Game is turn-based with HTTP request/response; no need for persistent connections |
| Physics engine (matter.js, planck.js) | Turn-based grid movement; physics is irrelevant |
| State machine library (xstate) | Custom FSM already works; adding xstate adds complexity for no gain |
| Animation library (gsap, anime.js) | PixiJS ticker + tweens already handle animation; adding another library creates conflicts |
| Canvas UI library | React + Zustand already handle UI; don't mix canvas UI with React |

---
*Research completed: 2026-03-29*
