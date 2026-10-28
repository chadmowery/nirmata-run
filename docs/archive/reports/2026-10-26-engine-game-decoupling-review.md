# Nirmata Runner: Engine Architecture Review & Decoupling Report

**Date:** October 26, 2026  
**Branch:** `docs/engine-review`  
**Status:** Complete Architectural Audit & Migration Specification  
**Target Systems:** `src/engine/`, `src/game/`, `src/shared/`, `src/rendering/`, `src/app/`  

---

## Executive Summary

An architectural audit of **Nirmata Runner** was conducted to evaluate the separation of concerns between the underlying game engine (`src/engine/`) and the specific game implementation (`src/game/`, `src/shared/`, `src/rendering/`). 

### Core Architectural Mandate
According to the project design brief and guidelines (`GEMINI.md`, `docs/ENGINE_GUIDELINES.md`, and `AGENTS.md`):
1. **Engine Layer (`src/engine/`)**: Must represent a pure, reusable, domain-agnostic turn-based 2D grid ECS engine. It must contain zero game rules, zero game data, and zero dependencies on game components or entities.
2. **Shared Layer (`src/shared/`)**: Holds authoritative schemas, components, serialization routines, delta generators, and action pipelines shared between client and server.
3. **Game Layer (`src/game/`)**: Encapsulates Nirmata Runner's specific mechanics (Neural Heat, Stability, Firmware/Augment/Software customization, Shell archetypes, procedural dungeon generation, AI archetypes, turn resolution).
4. **Event Tier Hierarchy (`AGENTS.md`)**:
   - **`EngineEvents`** (`src/engine/events/types.ts`): ECS lifecycle & structural plumbing.
   - **`GameplayEvents`** (`src/shared/events/types.ts`): Authoritative action/result signals shared between client and server pipeline.
   - **`GameEvents`** (`src/game/events/types.ts`): Client-only, UI-bound, or rendering-specific signals.

### Current System Health
- **Unit & Integration Tests:** 98 test files, 560 tests passing (`npm test`).
- **TypeScript Typecheck:** 0 errors across all source files (`npm run typecheck`).
- **Production Next.js Build:** Successful production compilation across all 34 static and dynamic routes (`npm run build`).

### Critical Audit Findings
While the project exhibits high test coverage and strict Intent-based ECS patterns inside `src/game/`, **the engine layer (`src/engine/`) has suffered significant architectural contamination from the game layer**. 
Specifically:
1. **`TurnManager` (`src/engine/turn/turn-manager.ts`)** directly imports and mutates `@shared/components` (`Actor`, `Energy`, `Health`, `Acting`), hardcodes player identification (`actor.isPlayer`), checks health (`health.isAlive`), and hardcodes Nirmata Runner's 5-phase action sequence.
2. **`World` (`src/engine/ecs/world.ts`)** hardcodes a query for the string component key `'children'` in `destroyEntity()`.
3. **`EntityBuilder` (`src/engine/entity/builder.ts`)** hardcodes string keys for `'parent'`, `'children'`, and `'templateId'`.
4. **`Grid` (`src/engine/grid/grid.ts` & `types.ts`)** imports `SerializedTile` from `@shared/types`, differentiates `items: Set<EntityId>` from `entities: Set<EntityId>` (a game domain distinction), and hardcodes terrain attributes (`'floor'`, `'wall'`, `walkable`, `transparent`).
5. **`SessionManager` (`src/engine/session/SessionManager.ts`)** hardcodes `playerId: number` into its `WorldState` container.
6. **`EventBus` (`src/engine/events/event-bus.ts`)** hardcodes string literals for lifecycle events and inspects browser globals (`(window as any).DEBUG_EVENTS`).
7. **`eslint.config.js`** enforces import boundaries preventing `@engine` from importing `@game`, but fails to prevent `@engine` from importing `@shared`, creating a loophole through which game components infiltrated the engine.
8. **`GameplayEvents` (`src/shared/events/types.ts`)** contains rendering and UI events (`APPLY_WORLD_FILTER`, `TARGETING_CURSOR_MOVED`) that belong in `GameEvents` (`src/game/events/types.ts`).

---

## 1. Full Accounting of Engine Features (`src/engine/`)

The engine layer currently houses 9 core modules:

| Subsystem | File Location | Intended Engine Role | Current Status / Leakage |
| :--- | :--- | :--- | :--- |
| **ECS World** | `src/engine/ecs/world.ts` | Entity allocation, component stores, queries, phase execution, state serialization | **Leak:** Hardcodes string key `'children'` in `destroyEntity` to recursively delete child entities. |
| **ECS Types & Defs** | `src/engine/ecs/types.ts` | `EntityId`, `ComponentDef<T>`, `defineComponent`, `Phase` enum | **Coupled:** Fixed `Phase` enum reflects Nirmata Runner's combat turn phases (`GATHER_INTENT`, `ACTION`, `REACTION`, `CLEANUP`). |
| **Event Bus** | `src/engine/events/event-bus.ts` | Type-safe queued event bus with depth-limited flush and wildcard listeners | **Leak:** Hardcodes lifecycle event strings and checks `window.DEBUG_EVENTS`. |
| **Engine Events** | `src/engine/events/types.ts` | ECS lifecycle events (`ENTITY_CREATED`, `ENTITY_DESTROYED`, `COMPONENT_ADDED`, `COMPONENT_REMOVED`, `TURN_START`, `TURN_END`) | **Clean:** Pure ECS lifecycle contracts. |
| **2D Spatial Grid** | `src/engine/grid/grid.ts` | 1D-backed 2D grid, coordinate translation, spatial entity index, serialization | **Leak:** Imports `SerializedTile` from `@shared/types`. Has dedicated `items: Set<EntityId>` vs `entities: Set<EntityId>`. |
| **Grid Types** | `src/engine/grid/types.ts` | `Tile` definition, `GridConfig`, default tile generator | **Leak:** Hardcodes `terrain: 'floor'`, `walkable`, `transparent`, and `items` layer. |
| **Entity Composition** | `src/engine/entity/builder.ts`, `registry.ts`, `factory.ts` | Raw template storage, recursive mixin resolution, override merging, schema validation | **Leak:** `builder.ts` hardcodes lookups for `'parent'`, `'children'`, and `'templateId'`. |
| **Turn Orchestration** | `src/engine/turn/turn-manager.ts` | Energy-based actor turn sequencing, priority scheduling, phase dispatch | **CRITICAL LEAK:** Directly imports `@shared/components`, manages `Actor.isPlayer`, `Health.isAlive`, `Energy`, `Acting`. |
| **State Machine** | `src/engine/state-machine/state-machine.ts` | Finite state machine with transition tables and context hooks | **Clean:** Fully generic domain-agnostic implementation. |
| **Procgen Algorithms** | `src/engine/generation/bsp.ts`, `flood-fill.ts` | Binary space partitioning room generation, flood fill connectivity analysis | **Clean:** Pure mathematical/spatial algorithms, though misplaced if engine is purely ECS runtime. |
| **Session Manager** | `src/engine/session/SessionManager.ts` | In-memory session container for multi-session server authority | **Leak:** `WorldState` hardcodes `playerId: number`. |
| **Engine Utilities** | `src/engine/utils/logger.ts`, `event-context.ts` | Structured tagged logger, event origin tracking (`client`, `server`, `ui`) | **Clean:** Utility plumbing. |

---

## 2. Full Accounting of Game Features (`src/game/` & `src/shared/`)

The game implementation is divided across `src/game/` (systems, states, UI bridges, shells, input) and `src/shared/` (schemas, components, authoritative pipeline, vault, economy).

### 2.1 Gameplay Systems (`src/game/systems/`)
A total of **28 distinct gameplay systems** execute across registered turn phases:

1. **Movement System (`movement.ts`)** — *Phase: ACTION*: Evaluates `MoveIntent`, validates grid terrain and `BlocksMovement`, handles bump-attack conversion into `AttackIntent`, stamps `MovedThisTurn`, emits `ENTITY_MOVED`.
2. **Combat System (`combat.ts`)** — *Phase: REACTION*: Resolves `AttackIntent` and `DamageIntent`, calculates armor mitigation from `Defense`, deducts `Health`, applies `Dying` component on fatal damage, stamps `DealtDamageThisTurn`, emits `DAMAGE_DEALT` and `ENTITY_DIED`.
3. **AI Behavior System (`ai.ts`)** — *Phase: GATHER_INTENT*: Controls hostile entities (`AIState`, `Hostile`). Implements Melee Hunter, Ranged Kiter, Swarm/Packer, Retreat/Coward, and Patrol behaviors via ROT.js Dijkstra/A* pathfinding.
4. **Neural Heat System (`heat.ts`)** — *Phase: PRE_TURN & ACTION*: Manages Heat resource accumulation, base and stability-scaled heat dissipation in `PRE_TURN`, heat tiers (`NORMAL`, `WARMING`, `OVERHEATING`, `CRITICAL`), and `VentIntent` resolution.
5. **Stability & Degradation System (`stability.ts`)** — *Phase: PRE_TURN*: Manages player Neural Stability (100% decaying per floor and turn bleed), triggers degraded status, glitching, and DoT damage.
6. **Augment System (`augment.ts`, `augment-util.ts`)** — *Phase: REACTION*: Resolves passive augment synergies slotted in `AugmentSlots` (Vampiric heal on kill, Auto-loader, Bleed proc, Thorns, Kinetic Link), emits `AUGMENT_FLASH`.
7. **Firmware System (`firmware.ts`)** — *Phase: ACTION*: Resolves active character abilities (Ghost Pulse, Phase Shift, Neural Spike, Buffer Overflow, Basic Strike, Displacement Venting) from `FirmwareIntent`, validates cooldowns, ranges, and heat costs.
8. **Software Executables System (`software.ts`, `software-effects.ts`)** — *Phase: ACTION & REACTION*: Manages consumable/executable software in `SoftwareSlots` or `RunInventory`, processes `BurnSoftwareIntent` for emergency buffs or permanent infusions.
9. **Equipment System (`equipment.ts`)** — *Phase: ACTION*: Manages weapon and armor equipping/unequipping (`EquipIntent`, `UnequipIntent`), applies stat modifiers (`EquipmentDef`) to damage, range, and defense.
10. **Item Pickup System (`item-pickup.ts`)** — *Phase: REACTION*: Triggers when entities with `MovedThisTurn` step onto items. Deposits currency into `Wallet` and gear/software into `RunInventory`. Emits `ITEM_PICKED_UP`, `CURRENCY_PICKED_UP`.
11. **Floor Progression System (`floor-manager.ts`)** — *Phase: CLEANUP*: Processes `DescentIntent` on staircases or anchors, generates new floor depths, moves player, clears old floor entities, emits `FLOOR_TRANSITION`.
12. **Stability Anchor & Extraction System (`anchor-interaction.ts`)** — *Phase: REACTION*: Provides the core risk/reward extraction dilemma: secure extracted loot or pay stability to descend deeper. Processes `ExtractionIntent`.
13. **Dead Zone System (`dead-zone.ts`)** — *Phase: POST_TURN*: Environmental hazard creeping across map edges or advancing on turn count, dealing corruption damage to enclosed entities.
14. **Tile Corruption System (`tile-corruption.ts`)** — *Phase: POST_TURN*: Spreads dynamic corruption across grid tiles, creating hazardous terrain.
15. **Pack Coordinator System (`pack-coordinator.ts`)** — *Phase: GATHER_INTENT*: Coordinates pack enemies sharing `PackMember`, synchronizing target focus and surrounding maneuvers.
16. **Kernel Panic System (`kernel-panic.ts`)** — *Phase: ACTION / REACTION*: Critical failure mechanics when Heat exceeds 100% or Stability hits 0, rolling for system lockups, equipment frying, or lethal BSOD.
17. **Reward Drop System (`reward-drop.ts`)** — *Phase: CLEANUP*: Generates scrap, blueprint, software, and gear drops for `Dying` entities with `LootTable` using deterministic PRNG.
18. **Gravedigger System (`gravedigger.ts`)** — *Phase: CLEANUP (Final)*: Authoritative entity destruction system (`The Death Protocol`). Purges `Dying` entities from `Grid` tile sets and calls `world.destroyEntity()`.
19. **Run Ender System (`run-ender.ts`)** — *Phase: CLEANUP*: Detects player death or successful extraction, computes run statistics (`RunEndedStats`), applies death pity, persists profile data, transitions game state.
20. **Run Mode Configuration (`run-mode-config.ts`)**: Configures gameplay modifiers for Neural Simulation, Daily Challenge, and Weekly One-Shot modes.
21. **Shell Stats System (`shell-stats.ts`)** — *Phase: PRE_TURN*: Recalculates entity base stats from equipped Shell archetype on `ShellUpdateTag`.
22. **Shop Rotation System (`shop-rotation.ts`)**: Generates seed-deterministic vendor inventory tiers (v0 common through v3 legendary).
23. **Tag Cleanup System (`tag-cleanup.ts`)** — *Phase: POST_TURN*: Clears transient single-tick tags (`MovedThisTurn`, `DealtDamageThisTurn`, `FirmwareActivatedThisTurn`, `FloorTransitioned`).
24. **Teleportation System (`teleport.ts`)** — *Phase: ACTION*: Displaces entities across valid grid floor tiles (e.g., Null-Pointer enemies, Phase Shift).
25. **Status Effects System (`status-effects.ts`)** — *Phase: PRE_TURN & ACTION*: Manages buff/debuff stacks (Stun, Bleed, Burn, Shield, EMP, Corrupt), decrements durations in `PRE_TURN`, applies DoT damage.
26. **Vault Manager (`vault-manager.ts`, `src/shared/vault.ts`)**: Manages persistent cross-run storage, deposit/withdrawal, selling items for Flux/Scrap, and overflow discarding.
27. **Weekly Reset System (`weekly-reset.ts`)**: Evaluates weekly leaderboard rotation, archives leaderboards, generates public seeds, resets one-shot run attempts.
28. **System Registration (`registration.ts`)**: Central coordinator registering all core gameplay systems to their respective `Phase` inside `World`.

### 2.2 Shell Customization Architecture (`src/game/shells/`)
- **Archetypes:** Vanguard, Striker, Recon, Titan, Specialist.
- **Port Configurations:** Hardware port capacities for Firmware (active skills), Augments (passives), and Software (executables/infusions).
- **Client & Server Registries:** Separate client-side predictive cache and server-side authoritative shell repository.

### 2.3 Dungeon Generation & Spawning (`src/game/generation/`)
- **Dungeon Generator (`dungeon-generator.ts`)**: Combines BSP room carving, corridor routing, corridor smoothing, and door placement with ROT.js RNG.
- **Entity Placement (`entity-placement.ts`)**: Places player spawn, staircase, stability anchor, enemies, loot, and dead zones based on `depth-config.json` and `loot-distribution.json`.

### 2.4 Input & Targeting (`src/game/input/`)
- **Input Manager (`input-manager.ts`)**: Keybindings for directional movement, wait, vent, firmware triggers, inventory, and dev terminal.
- **Targeting System (`targeting.ts`)**: Interactive cursor, line-of-sight checks, range circles, and AOE footprint visualization.

### 2.5 Authoritative Pipeline & Reconciliation (`src/shared/`)
- **Action Pipeline (`pipeline.ts`)**: Pure simulation function for server ticks: snapshots world/grid, applies player action intent, executes phased core systems, produces `StateDelta` via `json-diff-ts`.
- **Reconciliation Engine (`reconciliation.ts`)**: Client-side prediction buffer, optimistic intent application, server delta patching, rollback and re-simulation on prediction divergence.
- **Serialization (`serialization.ts`)**: Deep serializing and deserializing of ECS `World` stores and `Grid` tile sets.
- **Component Definitions (`src/shared/components/`)**: 40+ strict Zod component schemas defining entity state (Position, Health, Heat, Stability, Actor, Energy, Hostile, Intents, Slots, Defs).

### 2.6 Rendering & Visuals (`src/rendering/`)
- **PixiJS WebGL Renderer (`renderer.ts`, `render-system.ts`)**: Multi-container layered rendering (background, floor/walls, dead zones, items, entities, VFX, fog-of-war, UI).
- **Tilemap Renderer (`tilemap.ts`)**: Batch rendering via `@pixi/tilemap`.
- **Camera (`camera.ts`)**: Smooth lerp tracking of player position with viewport bounds culling.
- **Shader Filters (`src/rendering/filters/`)**: CRT scanlines, chromatic aberration, heat blur, glitch effects, anchor desaturation, death particle emitters.

### 2.7 UI & Web Application (`src/app/`, `src/components/ui/`)
- **Zustand UI Store (`src/game/ui/store.ts`)**: Reactive UI state mirror updated via `sync-bridge.ts`.
- **Next.js API Routes (`src/app/api/`)**: Authoritative endpoints for `/api/action`, `/api/session`, `/api/profile`, `/api/vault/*`, `/api/economy/*`, `/api/run-mode/*`, `/api/leaderboard/*`, and `/api/admin/*`.
- **Game Data Studio (`src/app/dev/gamedata/`)**: In-browser visual editor for entities, mixins, shells, spawn tables, and component schema introspection.

---

## 3. Detailed Architectural Violations & Root Cause Analysis

### Violation 1: The `TurnManager` Game Component Leak
**File:** `src/engine/turn/turn-manager.ts`  
**Lines:** 11, 71–79, 132–156, 173–175, 200–211, 227–228, 234–240  
**Evidence:**
```typescript
// Line 11:
import { Actor, Energy, Health, Acting } from '@shared/components';

// Line 71:
const playerId = this.world.query(Actor).find(id => this.world.getComponent(id, Actor)?.isPlayer);

// Line 132-136:
const enemies = this.world.query(Actor, Energy)
  .filter(id => {
    const actor = this.world.getComponent(id, Actor);
    const energy = this.world.getComponent(id, Energy);
    return actor && !actor.isPlayer && energy && energy.current >= this.config.energyThreshold;
  });

// Line 208-210:
currentData.current += currentData.speed;
this.world.addComponent(id, Energy, currentData);

// Line 227-228:
const health = this.world.getComponent(id, Health);
return !health || health.isAlive;
```
**Impact:** `TurnManager` cannot be used in any other game or simulation. It is hardcoded to Nirmata Runner's specific components (`Actor`, `Energy`, `Health`, `Acting`), hardcodes the concept of a single "player" vs "enemy", hardcodes `energy.current >= 1000`, and hardcodes health checks.

### Violation 2: Hardcoded Hierarchy Keys in `World` and `EntityBuilder`
**Files:** `src/engine/ecs/world.ts` (lines 40–46), `src/engine/entity/builder.ts` (lines 121–126, 151–154)  
**Evidence:**
```typescript
// world.ts (lines 40-46):
const childrenStore = this.stores.get('children');
if (childrenStore && childrenStore.has(id)) {
  const childrenData = childrenStore.get(id) as { entityIds: number[] };
  for (const childId of childrenData.entityIds) {
    this.destroyEntity(childId);
  }
}

// builder.ts (lines 121-126):
const parentDef = componentRegistry.get('parent');
const childrenDef = componentRegistry.get('children');

// builder.ts (lines 151-154):
const templateIdDef = componentRegistry.get('templateId');
```
**Impact:** The core ECS `World` and `EntityBuilder` contain hardcoded magic strings (`'children'`, `'parent'`, `'templateId'`) coupled to specific game component schemas in `@shared/components/`. If a project renames these components or uses a different hierarchy paradigm, the engine breaks.

### Violation 3: Game Data Infiltration in `Grid`
**Files:** `src/engine/grid/grid.ts` (line 3, 137–160), `src/engine/grid/types.ts` (lines 6–17, 30–37)  
**Evidence:**
```typescript
// grid.ts:
import { SerializedTile } from '@shared/types';

// types.ts:
export interface Tile {
  terrain: string;
  walkable: boolean;
  transparent: boolean;
  entities: Set<EntityId>;
  items: Set<EntityId>; // <-- Game domain distinction!
}

export function createDefaultTile(): Tile {
  return {
    terrain: 'floor', // <-- Roguelike assumption
    walkable: true,
    transparent: true,
    entities: new Set<EntityId>(),
    items: new Set<EntityId>(),
  };
}
```
**Impact:** A pure spatial engine grid should index entities across generic spatial layers (or a single entity set per cell). Distinguishing "items" from "entities" violates the fundamental ECS principle that *an item is simply an entity with an `Item` component*. Furthermore, importing `SerializedTile` from `@shared/types` creates an upward dependency from engine to shared.

### Violation 4: SessionManager Game Coupling
**File:** `src/engine/session/SessionManager.ts` (line 15)  
**Evidence:**
```typescript
export interface WorldState<T extends EngineEvents = EngineEvents, S = unknown> {
  world: World<T>;
  grid: Grid;
  turnManager: TurnManager<T>;
  eventBus: EventBus<T>;
  playerId: number; // <-- Game specific concept!
  systems?: S;
}
```
**Impact:** An engine session manager should manage generic game states (`WorldState<TState>`), not assume every session has a single `playerId: number`.

### Violation 5: EventBus Lifecycle Strings and Global Browser Pollution
**File:** `src/engine/events/event-bus.ts` (lines 60–73)  
**Evidence:**
```typescript
const isDebugEnabled = isServer 
  ? process.env.DEBUG_EVENTS === 'true'
  : (window as any).DEBUG_EVENTS === true;

const isLifecycleEvent = typeStr === 'COMPONENT_ADDED' || 
                        typeStr === 'COMPONENT_REMOVED' || 
                        typeStr === 'ENTITY_CREATED' || 
                        typeStr === 'ENTITY_DESTROYED';
```
**Impact:** Hardcodes component lifecycle event names as magic strings and relies on `(window as any)` which causes ESLint violations.

### Violation 6: The ESLint Boundary Loophole
**File:** `eslint.config.js` (lines 30–56)  
**Evidence:**
```javascript
'import-x/no-restricted-paths': [
  'error',
  {
    zones: [
      { target: './src/engine/**', from: './src/game/**' },
      { target: './src/engine/**', from: './src/rendering/**' },
      { target: './src/engine/**', from: './src/network/**' },
      { target: './src/engine/**', from: './src/ui/**' },
    ],
  },
]
```
**Root Cause:** Notice that `./src/shared/**` is **omitted** from the forbidden zones for `./src/engine/**`! This oversight allowed developers to import `@shared/components` directly into `src/engine/turn/turn-manager.ts` and `src/engine/grid/grid.ts` without triggering linter failures.

### Violation 7: Event Tier Classification Inversion (`AGENTS.md`)
**File:** `src/shared/events/types.ts` (lines 134–144, 174–179, 191–196)  
**Evidence:**
Events such as `APPLY_WORLD_FILTER`, `REMOVE_WORLD_FILTER`, `TARGETING_STARTED`, `TARGETING_CONFIRMED`, `TARGETING_CANCELLED`, and `TARGETING_CURSOR_MOVED` are declared in `GameplayEvents` (`src/shared/events/types.ts`).  
Per `AGENTS.md`:
> *"GameplayEvents: Gameplay-meaningful events that the authoritative pipeline and reconciliation need to emit or consume. Shared between client & server."*  
> *"GameEvents: Client-only, UI-bound, or rendering-specific events. Never emitted or consumed by server-side code."*

Because shader filters (`APPLY_WORLD_FILTER`) and cursor movement (`TARGETING_CURSOR_MOVED`) are client rendering/UI signals never consumed by the server pipeline, placing them in `GameplayEvents` violates the event tier hierarchy.

---

## 4. Target Architecture: The Fully Decoupled Engine

The objective is to achieve a **Zero-Game-Knowledge Engine**:
```
┌────────────────────────────────────────────────────────┐
│                      src/game/                         │
│   (Rules, Systems, Shells, AI, Combat, Dungeon Gen)    │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
                ▼                        ▼
┌───────────────────────────┐  ┌─────────────────────────┐
│       src/shared/         │  │     src/rendering/      │
│ (Schemas, Pipeline, Diffs)│  │    (PixiJS, Shaders)    │
└───────────────┬───────────┘  └─────────┬───────────────┘
                │                        │
                └───────────┬────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                     src/engine/                        │
│   (Pure ECS, Generic Grid, Pluggable Turn Scheduler,   │
│       Generic Entity Builder, Queued Event Bus)        │
└────────────────────────────────────────────────────────┘
```

### 4.1 Target Contracts for Engine Subsystems

#### A. Decoupled Turn Management
Instead of the engine's `TurnManager` knowing what `Actor`, `Energy`, `Health`, or `Acting` are, the engine provides an abstract scheduling contract:
```typescript
// src/engine/turn/types.ts (Pure Engine)
export interface ITurnScheduler<TEntity = number> {
  start(): void;
  submitAction(action: string): void;
  canAcceptInput(): boolean;
  getTurnNumber(): number;
  pause(): void;
  resume(): void;
}

export interface SpeedAccumulatorConfig<TEntity = number> {
  getActors: () => TEntity[];
  getSpeed: (entity: TEntity) => number;
  getAccumulator: (entity: TEntity) => number;
  setAccumulator: (entity: TEntity, value: number) => void;
  threshold: number;
  isControllable: (entity: TEntity) => boolean;
  isAlive: (entity: TEntity) => boolean;
  onExecutePhase: (phase: string) => void;
  onAction: (entity: TEntity, action: string) => number; // returns energy cost
}
```
All game component references (`Actor`, `Energy`, `Health`, `Acting`) move to `@game/turn/` or are supplied via configuration callbacks in `src/game/engine-factory.ts`.

#### B. Generic Hierarchy Plumbing in `World`
Instead of hardcoding `'children'`, the `World` accepts lifecycle listeners or a hierarchy configuration:
```typescript
// src/engine/ecs/types.ts
export interface WorldHooks {
  onEntityDestroyed?: (world: any, entityId: EntityId) => void;
}

// In src/game/setup.ts (Game layer registers cascade deletion)
world.setHook('onEntityDestroyed', (w, id) => {
  const children = w.getComponent(id, Children);
  if (children) {
    for (const childId of children.entityIds) {
      w.destroyEntity(childId);
    }
  }
});
```

#### C. Layer-Based Spatial Grid
Remove `items: Set<EntityId>` and roguelike-specific `terrain: 'floor'` defaults from `src/engine/grid/`:
```typescript
// src/engine/grid/types.ts (Pure Engine)
export interface SpatialCell<TLayer extends string = string> {
  layers: Map<TLayer, Set<EntityId>>;
  flags: number; // Bitmask for walkable/transparent/custom flags
  metadata?: Record<string, unknown>;
}
```
Or simply keep `entities: Set<EntityId>` per tile and let the game's ECS components (`Item`, `BlocksMovement`, `Position`) query the spatial index.

#### D. Configurable Entity Builder
Make `'parent'`, `'children'`, and `'templateId'` injectable in `ComponentRegistry` or builder options:
```typescript
export interface HierarchyConfig {
  parentKey: string;
  childrenKey: string;
  templateIdKey?: string;
}
```

---

## 5. Step-by-Step Decoupling & Migration Plan

This plan is divided into 5 discrete phases to preserve backward compatibility and ensure all 560 tests remain green at every step.

### Phase 1: ESLint Boundary Hardening & Grid Self-Sufficiency
1. **Move `SerializedTile` into Engine**: Define `SerializedTile` in `src/engine/grid/types.ts`. Re-export it from `@shared/types.ts` for backward compatibility. Remove `import { SerializedTile } from '@shared/types'` from `src/engine/grid/grid.ts`.
2. **Update `eslint.config.js`**: Add `./src/shared/**` to restricted paths for `./src/engine/**`:
   ```javascript
   {
     target: './src/engine/**',
     from: './src/shared/**',
     message: 'Engine must not import from shared layer (zero game components allowed in engine)',
   }
   ```
3. **Fix Engine Lint Errors**: Resolve the 2 existing `@typescript-eslint/no-explicit-any` errors in `src/engine/ecs/types.ts` and `src/engine/events/event-bus.ts`.

### Phase 2: Decouple `TurnManager` from Game Components
1. **Create Generic Scheduler Interface**: Update `src/engine/turn/` to operate on generic delegate hooks (`getActors`, `getSpeed`, `getEnergy`, `deductEnergy`, `isPlayer`, `isAlive`).
2. **Create `GameTurnManager` in `@game/turn/`**: Wrap the generic engine turn scheduler with Nirmata Runner's specific components (`Actor`, `Energy`, `Health`, `Acting`).
3. **Update Factory & Tests**: Wire `GameTurnManager` in `src/game/engine-factory.ts` and update `turn-manager.test.ts` to use generic mock delegates.

### Phase 3: Decouple Entity Hierarchy & Lifecycle from ECS World
1. **Remove Hardcoded `'children'` from `world.ts`**: Replace `stores.get('children')` with an engine hook `world.onBeforeDestroy(entityId)`.
2. **Register Cascade Deletion in Game Setup**: In `src/game/engine-factory.ts` / `setup.ts`, register the cascade deletion hook that queries the `Children` component.
3. **Decouple Builder Hierarchy Keys**: Pass `{ parentKey: 'parent', childrenKey: 'children', templateIdKey: 'templateId' }` into `buildEntity` from the game layer rather than hardcoding strings in the engine.

### Phase 4: Event Tier Realignment (`AGENTS.md`)
1. **Move Client-Only Events to `GameEvents`**:
   - Move `APPLY_WORLD_FILTER`, `REMOVE_WORLD_FILTER` to `src/game/events/types.ts`.
   - Move `TARGETING_STARTED`, `TARGETING_CONFIRMED`, `TARGETING_CANCELLED`, `TARGETING_CURSOR_MOVED` to `src/game/events/types.ts`.
   - Move `GAME_PAUSE_REQUESTED`, `GAME_RESUME_REQUESTED` to `src/game/events/types.ts`.
2. **Keep Authoritative Events in `GameplayEvents`**: Retain `DAMAGE_DEALT`, `ENTITY_DIED`, `HEALED`, `ITEM_PICKED_UP`, `FLOOR_TRANSITION`, `ANCHOR_INTERACTION`, `RUN_ENDED`, `STATUS_EFFECT_APPLIED`.
3. **Clean Up `EventBus` Debug Hook**: Replace `(window as any).DEBUG_EVENTS` with a clean debug callback or environment variable check.

### Phase 5: Decouple SessionManager
1. **Parameterize `WorldState`**: Change `WorldState` in `src/engine/session/SessionManager.ts` to:
   ```typescript
   export interface WorldState<TEvents extends EngineEvents = EngineEvents, TMeta = Record<string, unknown>> {
     world: World<TEvents>;
     grid: Grid;
     turnManager: unknown;
     eventBus: EventBus<TEvents>;
     metadata: TMeta;
   }
   ```
2. Move `playerId` into the `metadata` object in `src/game/setup.ts` and `src/app/api/session/`.

---

## 6. Comprehensive Feature Accounting Table

The following table provides the complete, authoritative inventory of all features identified across both layers:

| Layer | Subsystem / Feature | Location | Domain Responsibility | Decoupling Status |
| :--- | :--- | :--- | :--- | :--- |
| **Engine** | ECS Entity & Store Coordinator | `src/engine/ecs/world.ts` | Entity allocation, store mapping, component CRUD, phase dispatch | Needs hierarchy hook |
| **Engine** | Component Definition Utility | `src/engine/ecs/types.ts` | Zod component definition factory (`defineComponent`) | Clean |
| **Engine** | Event Bus Engine | `src/engine/events/event-bus.ts` | Type-safe queued event publish/subscribe & flush | Needs lint fix & clean debug check |
| **Engine** | Engine Lifecycle Events | `src/engine/events/types.ts` | Entity/Component lifecycle & turn boundary events | Clean |
| **Engine** | 2D Spatial Grid | `src/engine/grid/grid.ts` | 1D-backed 2D spatial coordinate mapping | Needs local `SerializedTile` & remove `items` layer |
| **Engine** | Template Registry | `src/engine/entity/registry.ts` | Raw template storage | Clean |
| **Engine** | Template & Mixin Builder | `src/engine/entity/builder.ts` | Mixin inheritance, override merging, schema validation | Needs configurable hierarchy keys |
| **Engine** | Entity Factory | `src/engine/entity/factory.ts` | High-level template instantiate helper | Clean |
| **Engine** | Finite State Machine | `src/engine/state-machine/state-machine.ts` | State transition table with enter/exit hooks | Clean |
| **Engine** | BSP Procedural Generator | `src/engine/generation/bsp.ts` | Binary space partitioning room & corridor carving | Algorithmic utility |
| **Engine** | Flood Fill Connectivity | `src/engine/generation/flood-fill.ts` | Map reachability and connectivity audit | Algorithmic utility |
| **Engine** | Session Manager | `src/engine/session/SessionManager.ts` | Multi-session server world cache | Needs generic `metadata` instead of `playerId` |
| **Engine** | Logger & Event Context | `src/engine/utils/` | Tagged logging & event origin tagging | Clean |
| **Game** | Movement System | `src/game/systems/movement.ts` | Bump attacks, grid collision, `MoveIntent`, `MovedThisTurn` | Game-specific ECS system |
| **Game** | Combat System | `src/game/systems/combat.ts` | Damage, armor mitigation, `AttackIntent`, `DamageIntent`, `Dying` | Game-specific ECS system |
| **Game** | AI Behavior System | `src/game/systems/ai.ts` | ROT.js pathfinding, enemy archetypes, intent generation | Game-specific ECS system |
| **Game** | Neural Heat System | `src/game/systems/heat.ts` | Heat tracking, dissipation, overheat penalties, `VentIntent` | Game-specific ECS system |
| **Game** | Neural Stability System | `src/game/systems/stability.ts` | Stability decay, anchor refill, glitch damage | Game-specific ECS system |
| **Game** | Augment Synergies System | `src/game/systems/augment.ts` | Passive trigger augments, on-kill vampiric procs, cooldowns | Game-specific ECS system |
| **Game** | Firmware Abilities System | `src/game/systems/firmware.ts` | Active skill execution (Ghost Pulse, Phase Shift, etc.) | Game-specific ECS system |
| **Game** | Software System | `src/game/systems/software.ts` | Software slot execution, `BurnSoftwareIntent` infusions | Game-specific ECS system |
| **Game** | Equipment System | `src/game/systems/equipment.ts` | Weapon/armor slots, equip/unequip intents, stat bonuses | Game-specific ECS system |
| **Game** | Item Pickup System | `src/game/systems/item-pickup.ts` | Currency auto-pickup, gear pickup into inventory | Game-specific ECS system |
| **Game** | Floor Progression System | `src/game/systems/floor-manager.ts` | Depth generation, floor transitions, staircase descent | Game-specific ECS system |
| **Game** | Stability Anchor System | `src/game/systems/anchor-interaction.ts` | Safe extraction vs deeper descent risk/reward choice | Game-specific ECS system |
| **Game** | Dead Zone Hazard System | `src/game/systems/dead-zone.ts` | Map-constricting hazard damage | Game-specific ECS system |
| **Game** | Tile Corruption System | `src/game/systems/tile-corruption.ts` | Dynamic corruption spread on grid tiles | Game-specific ECS system |
| **Game** | Pack Coordinator System | `src/game/systems/pack-coordinator.ts` | Swarm intelligence for grouped enemy packs | Game-specific ECS system |
| **Game** | Kernel Panic / BSOD | `src/game/systems/kernel-panic.ts` | System failure penalties on max heat / min stability | Game-specific ECS system |
| **Game** | Reward Drop System | `src/game/systems/reward-drop.ts` | Deterministic loot & scrap drops on entity death | Game-specific ECS system |
| **Game** | Gravedigger System | `src/game/systems/gravedigger.ts` | Sole death authority, purging dying entities | Game-specific ECS system |
| **Game** | Run Ender System | `src/game/systems/run-ender.ts` | Run completion, stats summary, death pity calculation | Game-specific ECS system |
| **Game** | Run Mode Configurator | `src/game/systems/run-mode-config.ts` | Neural Simulation, Daily Run, Weekly One-Shot modes | Game-specific ECS system |
| **Game** | Shell Stats System | `src/game/systems/shell-stats.ts` | Base stat recalculation from shell archetype | Game-specific ECS system |
| **Game** | Shop Rotation System | `src/game/systems/shop-rotation.ts` | Seeded vendor inventory generation | Game-specific ECS system |
| **Game** | Tag Cleanup System | `src/game/systems/tag-cleanup.ts` | Ephemeral single-turn tag purging | Game-specific ECS system |
| **Game** | Teleportation System | `src/game/systems/teleport.ts` | Spatial displacement mechanics | Game-specific ECS system |
| **Game** | Status Effects System | `src/game/systems/status-effects.ts` | Buff/debuff durations, DoT tick damage | Game-specific ECS system |
| **Game** | Vault & Economy Manager | `src/game/systems/vault-manager.ts` | Cross-run persistent inventory & scrap/flux trading | Game-specific ECS system |
| **Game** | Weekly Reset System | `src/game/systems/weekly-reset.ts` | Seed rotation & one-shot leaderboard resets | Game-specific ECS system |
| **Game** | Shell Archetypes | `src/game/shells/` | Vanguard, Striker, Recon, Titan, Specialist definitions | Game definitions |
| **Game** | Game State Machine | `src/game/states/game-states.ts` | Top-level states (Title, Hub, InRun, Inventory, BSOD) | Game state configuration |
| **Game** | Input & Targeting | `src/game/input/` | Action bindings, cursor movement, LOS targeting | Game input & targeting |
| **Game** | Dungeon Generator & Spawner | `src/game/generation/` | Room/corridor tuning, monster & loot spawn tables | Game procgen |
| **Game** | UI Sync Bridge | `src/game/ui/sync-bridge.ts` | ECS state to Zustand store synchronization | Game UI bridge |
| **Shared** | Authoritative Action Pipeline | `src/shared/pipeline.ts` | Server-side tick processing & state diffing | Shared simulation logic |
| **Shared** | State Reconciliation | `src/shared/reconciliation.ts` | Client prediction & server delta patching | Shared networking |
| **Shared** | ECS Serialization | `src/shared/serialization.ts` | Full world & grid serialization to JSON | Shared serialization |
| **Shared** | Component Schemas | `src/shared/components/` | 40+ Zod component schemas | Shared data definitions |
| **Shared** | Gameplay Events | `src/shared/events/types.ts` | Shared authoritative action/result events | Needs UI event realignment |
| **Rendering** | PixiJS Render System | `src/rendering/` | Multi-layer canvas rendering, camera, sprite animation | Client rendering |
| **Rendering** | Shader Filters | `src/rendering/filters/` | Heat distortion, glitch, death particles, CRT | Client shaders |
| **App / UI** | React HUD & Dialogs | `src/components/ui/` | PlayerHUD, HeatBar, StabilityBar, Inventory Grid | React UI |
| **App / UI** | Next.js API Routes | `src/app/api/` | Authoritative REST API (`/action`, `/session`, etc.) | Next.js server |
| **App / UI** | Game Data Studio | `src/app/dev/gamedata/` | Visual schema & template editor | Developer tools |

---

## 7. Verification Protocol & Quality Gates

To confirm system integrity throughout any refactor:
1. **Vitest Unit & Integration Suite:**
   ```bash
   npm test
   ```
   *Requirement: 98 test files, 560 tests must pass.*
2. **TypeScript Compilation:**
   ```bash
   npm run typecheck
   ```
   *Requirement: Zero type errors across all aliases (`@engine`, `@game`, `@shared`, `@rendering`).*
3. **ESLint Structural Boundaries:**
   ```bash
   npm run lint
   ```
   *Requirement: Zero restricted-path violations (`import-x/no-restricted-paths`).*
4. **Next.js Production Build:**
   ```bash
   npm run build
   ```
   *Requirement: Successful production build across all static and dynamic API routes.*

---

## 8. Summary of Recommendations for Engineering Team

1. **Immediate Quick Win**: Update `eslint.config.js` to add `./src/shared/**` to `./src/engine/**` restricted paths. This immediately prevents any further game components from being imported into the engine.
2. **Phase 2 Priority**: Extract `TurnManager`'s game-specific logic (`Actor`, `Energy`, `Health`, `Acting`) into a `GameTurnManager` in `@game/turn/`, leaving a pure `SpeedAccumulatorScheduler` in `@engine/turn/`.
3. **Phase 3 Priority**: Remove hardcoded `'children'`, `'parent'`, and `'templateId'` from `world.ts` and `builder.ts`, using lifecycle hooks (`onBeforeDestroy`) and builder options.
4. **Event Realignment**: Move client-only UI/rendering events (`APPLY_WORLD_FILTER`, `TARGETING_CURSOR_MOVED`) from `GameplayEvents` into `GameEvents` in strict accordance with `AGENTS.md`.
