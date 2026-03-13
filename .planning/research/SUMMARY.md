# Research Summary

**Domain:** Web-based 2D Roguelike Dungeon Crawler Engine
**Synthesized:** 2026-03-13
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Stack Summary

**Core (pre-decided):** PixiJS v8.17 + React 19 + TypeScript 5.9 + Next.js 16

**Key supporting libraries:**
- **@pixi/tilemap v5.0.2** — batched GPU tile rendering (mandatory, don't use individual sprites)
- **zustand v5.0.11** — UI state bridge; vanilla API enables engine-side writes without React hooks
- **rot-js v2.2.1** — cherry-pick FOV (recursive shadowcasting), RNG (seeded Alea PRNG), pathfinding (A*/Dijkstra); skip its display and map gen
- **zod v3.x** — runtime validation for JSON entity schemas and server action payloads
- **vitest v4.1** — test engine logic (ECS, generation, turns, state machine); don't test PixiJS rendering

**Do NOT use:** Phaser (conflicts with custom ECS), bitECS/miniplex (conflicts with JSON composability), @pixi/react for game rendering (ECS must own scene graph), Redux/MobX (overkill for UI reflection layer), WebSockets (HTTP sufficient for turn-based single-player)

## Feature Summary

**16 table stakes systems** across 5 domains:
1. **Core Infrastructure:** ECS core, entity composition pipeline, event bus, game state machine
2. **Gameplay Loop:** Turn manager, grid/tilemap data, dungeon gen (BSP), movement, input
3. **Rendering:** Tile rendering + camera, FOV/fog of war
4. **Combat/AI:** Basic combat (bump-to-attack), basic AI (chase + attack), item pickup
5. **Network/UI:** Server-authoritative pipeline, optimistic client + reconciliation, UI state bridge + HUD

**3 recommended differentiators for v1:** Message log (LOW complexity, HIGH UX), animation/tweens (MEDIUM, transforms feel), energy/speed system (MEDIUM, tactical depth)

**18 anti-features explicitly excluded:** Audio, save/load, multiplayer, advanced procgen (WFC), mobile, character classes, skill trees, quests, dialogue, crafting, item modifiers, multi-floor, meta-progression, modding API, replay, accessibility, i18n, tutorial

## Architecture Summary

**Four-layer architecture** (downward-only dependencies):
- **Platform:** PixiJS, React, Next.js, rot-js, browser APIs
- **Engine:** ECS, state machine, turn manager, event bus, entity builder/registry/factory, generation interface, action pipeline, grid
- **Game:** Components, systems, JSON entity templates, BSP algorithm, action validators, game states
- **Presentation:** PixiJS renderer (canvas) + React UI (DOM overlay)

**Engine/game boundary:** Engine knows nothing about goblins, health, or dungeons. Game implements engine interfaces. `game/setup.ts` is the sole wiring point. Enforce with ESLint import restrictions.

**Client-server flow:** Action intent → optimistic client apply → POST to Next.js → server validates → returns full state snapshot → client replaces state. Full-state-replace for v1 (state is ~10-50KB/turn).

**ECS storage:** `Map<string, Map<EntityId, Component>>` — O(1) lookup, trivially debuggable, optimized for developer ergonomics over cache coherence (irrelevant at <200 entities/turn).

## Critical Pitfalls

1. **ECS over-engineering** — Timebox to 2 days. Start with Map-of-Maps. Build 3 real systems before refactoring API.
2. **Rendering through React** — PixiJS Application mounts independently. ECS render systems own the scene graph. React is DOM overlay only.
3. **Server before local game works** — Build Phases 1-5 client-side. Action pipeline is a pure function locally. Move validation to server in Phase 6.
4. **PixiJS display object leaks** — Strict `Map<EntityId, DisplayObject>` tracking. Subscribe to `ENTITY_DESTROYED` event. Destroy sprites explicitly.
5. **Leaky engine/game boundary** — ESLint `import/no-restricted-paths` from day 1. Engine never imports from game/.
6. **State machine explosion** — Keep top-level FSM to 5 states. Sub-phases are flags on the turn manager, not new states.
7. **Optimistic reconciliation edge cases** — Use full-state-replace for v1. Only visual sprite positions are optimistic. State commits wait for server confirmation.

## Build Order

Critical path dependency chain:
1. ECS core + grid + entity composition (zero rendering, pure TypeScript + Vitest)
2. Game state machine + turn manager + input + movement + event bus
3. Tile rendering + camera + FOV (first browser/canvas work)
4. Combat + AI + item pickup + dungeon generation (playable local game)
5. Server-authoritative pipeline + optimistic client + reconciliation
6. UI state bridge + HUD + message log (React layer)

**Key insight:** Phases 1-2 need zero browser dependencies. Pure TypeScript + Vitest enables fast iteration on the hardest problems (ECS, game loop) before canvas/rendering complexity is introduced.

---
*Research synthesis for: Roguelike Dungeon Crawler Engine*
*Synthesized: 2026-03-13*
