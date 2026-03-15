# Roadmap: Roguelike Dungeon Crawler Engine

## Overview

Build a server-authoritative turn-based dungeon crawler engine from the data layer up. Phases follow the critical dependency chain: ECS + grid (pure TypeScript, no browser) → game loop + turns (still no browser) → PixiJS rendering → gameplay systems (playable local game) → server authority → React UI. Each phase delivers a coherent, testable capability. The engine/game boundary is enforced from the first commit.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: ECS Core & Data Foundation** - Entity-component-system, event bus, grid, entity composition pipeline, architecture enforcement (pure TypeScript + Vitest)
- [ ] **Phase 2: Game Loop & Player Control** - State machine, turn manager, input mapping, movement with collision (mostly pure TypeScript)
- [ ] **Phase 3: Rendering & Camera** - PixiJS tile rendering, camera viewport, FOV/fog of war, animations, sprite lifecycle (first browser/canvas work)
- [ ] **Phase 4: Combat, AI, Items & Dungeon Generation** - Damage resolution, enemy AI, item pickup, BSP dungeon generation (playable local game)
- [ ] **Phase 5: Server Authority** - Action pipeline, Next.js API validation, optimistic client, full-state-replace reconciliation
- [ ] **Phase 6: UI & Integration** - Zustand state bridge, React HUD, message log, menus, end-to-end tech demo

## Phase Details

### Phase 1: ECS Core & Data Foundation
**Goal**: Engine data backbone and entity composition pipeline work end-to-end with zero browser dependencies
**Depends on**: Nothing (first phase)
**Requirements**: ECS-01, ECS-02, ECS-03, ECS-04, ECS-05, ECS-06, ECS-07, ECS-08, ECS-09, ECS-10, EVT-01, EVT-02, EVT-03, GRID-01, GRID-02, GRID-03, GRID-04, ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):
  1. Developer can create entities from JSON templates via builder → registry → factory pipeline, with Zod validation rejecting malformed templates
  2. Developer can query entities by component composition (e.g., all entities with Position + Health) and get O(1) component lookups
  3. Developer can create a 2D grid with walkability queries, entity-at-position lookups, and multi-layer tile data
  4. Engine directory has zero imports from game, rendering, network, or UI — enforced by ESLint import/no-restricted-paths
**Plans**: 4

Plans:
- [ ] 01-01: Project Scaffolding & Architecture Enforcement (module structure, ESLint boundary rules, Vitest setup)
- [ ] 01-02: ECS Core & Event Bus (World, entity lifecycle, component CRUD, queries, typed EventBus with queued flush)
- [ ] 01-03: Grid & Game Layer (2D grid with spatial indexing, game components, game event types)
- [ ] 01-04: Entity Composition Pipeline (builder, registry, factory, JSON templates, Zod validation, mixin composition)

### Phase 2: Game Loop & Player Control
**Goal**: Turn-based game loop processes player actions and state transitions through a complete turn cycle
**Depends on**: Phase 1
**Requirements**: FSM-01, FSM-02, FSM-03, FSM-04, TURN-01, TURN-02, TURN-03, TURN-04, TURN-05, TURN-06, MOV-01, MOV-02, MOV-03, INP-01, INP-02, INP-03, ARCH-03
**Success Criteria** (what must be TRUE):
  1. Game state machine transitions through Loading → MainMenu → Playing → Paused → GameOver with only valid transitions allowed
  2. Turn manager processes a complete turn cycle: pre-turn → player action → enemy turns (deterministic order, dead skipped) → post-turn → await input
  3. Player moves in cardinal directions with grid collision checking; moving into an enemy tile triggers bump-to-attack detection
  4. Keyboard input maps to semantic actions, action map is rebindable, and browser default scrolling is suppressed
  5. game/setup.ts is the sole wiring point that bootstraps engine + game together
**Plans**: 4

Plans:
- [ ] 02-01: State Machine & Game States (generic FSM with enter/exit hooks + 5 game state definitions)
- [ ] 02-02: Turn Manager (turn phases, energy/speed scheduling, deterministic enemy ordering, input gating)
- [ ] 02-03: Input & Movement (keyboard → action mapping, cardinal movement, walkability + occupancy collision)
- [ ] 02-04: Game Bootstrap & Integration (setup.ts wiring, system registration and ordering, state-to-system binding)

### Phase 3: Rendering & Camera
**Goal**: PixiJS renders the game world with tile-based maps, entity sprites, camera tracking, FOV, and animations
**Depends on**: Phase 2
**Requirements**: RND-01, RND-02, RND-03, RND-04, RND-05, RND-06, RND-07, RND-08, RND-09, RND-10, RND-11, RND-12, RND-13, RND-14
**Success Criteria** (what must be TRUE):
  1. PixiJS Application mounts independently to a canvas element (not through React reconciler), with batched CompositeTilemap rendering and terrain → items → entities → effects layer ordering
  2. Camera viewport centers on the player entity with smooth lerp; only tiles within the viewport are submitted to the renderer
  3. FOV renders three visibility states (visible at full brightness, explored dimmed, hidden black) and entities are only visible when their tile is in the player's current FOV
  4. Entities animate smoothly between tiles (~100ms lerp), attacks show sprite shake/flash, and death triggers a fade-out animation
  5. Entity destruction triggers display object cleanup — removed from container, destroyed, deleted from the EntityId → DisplayObject tracking map
**Plans**: 4 plans

Plans:
- [ ] 03-01: PixiJS Application & Tile Rendering (independent canvas mount, CompositeTilemap, layer ordering, tilemap built once)
- [ ] 03-02: Camera & Viewport (player-centered camera, viewport culling, smooth camera lerp)
- [ ] 03-03: FOV & Visibility Rendering (visible/explored/hidden states, entity visibility gating)
- [ ] 03-04: Animations & Sprite Lifecycle (movement tweens, attack/death animations, EntityId→DisplayObject map, cleanup on destroy)

### Phase 4: Combat, AI, Items & Dungeon Generation
**Goal**: Game is locally playable — player explores a generated dungeon, fights enemies, picks up items
**Depends on**: Phase 3
**Requirements**: CMB-01, CMB-02, CMB-03, CMB-04, AI-01, AI-02, AI-03, AI-04, ITEM-01, ITEM-02, ITEM-03, GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07
**Success Criteria** (what must be TRUE):
  1. Player can bump-attack enemies with damage resolved as attacker.attack − defender.defense (minimum 1); health tracks current/max HP
  2. Enemy death triggers grid removal, entity destruction, ENTITY_DIED event, and optional loot drop
  3. Enemies transition between idle → chasing → attacking based on FOV awareness, pathfind toward player via A*, and bump-attack when adjacent
  4. Items are entities on the grid; player picks them up by walking over, and immediate-effect items apply on pickup (e.g., health potion heals)
  5. BSP tree generates seed-reproducible dungeons with rooms (min 3×3), corridors, doors, flood-fill-validated connectivity, and placed player spawn, enemies, and items
**Plans**: 4

Plans:
- [ ] 04-01: Combat System (attack vs defense damage calc, health component, death handling, loot drops)
- [ ] 04-02: AI System (behavior states, FOV-aware chasing, rot-js A* pathfinding, bump-attack)
- [ ] 04-03: Item System (item entities on grid, walk-over pickup, immediate-effect application)
- [ ] 04-04: Dungeon Generation (BSP algorithm, rooms/corridors/doors, seeded RNG, flood fill validation, entity placement, configurable params)

### Phase 5: Server Authority
**Goal**: All player actions are validated server-side with optimistic client updates and full-state-replace reconciliation
**Depends on**: Phase 4
**Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, SRV-06, SRV-07, SRV-08, ARCH-04
**Success Criteria** (what must be TRUE):
  1. Client sends action intents via HTTP POST to Next.js API route; server validates all player actions (move, attack, pickup) against authoritative game state
  2. Server processes enemy turns during the player action request and returns a full authoritative state snapshot
  3. Client applies optimistic visual updates (sprite position only) before server responds, then replaces full state with server snapshot on response
  4. Irreversible side effects (death, messages, inventory changes) wait for server confirmation — never applied optimistically
  5. Action pipeline is a pure function: same code runs locally (client-side) and on the server (API route), with shared types in shared/ directory
**Plans**: 3

Plans:
- [ ] 05-01: Action Pipeline & Shared Types (pure function pipeline, shared/ directory, Zod schemas for payloads and snapshots)
- [ ] 05-02: Server Validation & API Route (Next.js POST handler, authoritative state, server-side enemy processing)
- [ ] 05-03: Optimistic Client & Reconciliation (predicted sprite updates, full-state-replace on response, deferred irreversible effects)

### Phase 6: UI & Integration
**Goal**: React UI layer presents game state reactively; complete tech demo is playable end-to-end
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Engine systems write to zustand stores via vanilla API — no React hooks in engine code; React components read and re-render reactively
  2. HUD displays player health and stats; scrollable message log shows combat events, pickups, and system messages
  3. Main menu screen starts a new game; game over screen shows on player death with a restart option
  4. Complete 60-second tech demo is playable end-to-end: player spawns in a generated dungeon, explores with FOV, fights enemies, picks up items, server validates every action
**Plans**: TBD

Plans:
- [ ] 06-01: Zustand State Bridge (vanilla stores for player, messages, game state; engine-side writes)
- [ ] 06-02: HUD & Message Log (health/stats display, scrollable combat log, reactive updates)
- [ ] 06-03: Menus & Tech Demo Polish (main menu, game over screen, end-to-end integration testing)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. ECS Core & Data Foundation | 0/4 | Not started | - |
| 2. Game Loop & Player Control | 0/4 | Not started | - |
| 3. Rendering & Camera | 0/4 | Not started | - |
| 4. Combat, AI, Items & Dungeon Generation | 0/4 | Not started | - |
| 5. Server Authority | 0/3 | Not started | - |
| 6. UI & Integration | 0/3 | Not started | - |

---
*Roadmap created: 2026-03-13*
*Last updated: 2026-03-13*
