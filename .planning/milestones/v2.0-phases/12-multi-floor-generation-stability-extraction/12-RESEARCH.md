# Phase 12: Multi-Floor Generation & Stability/Extraction - Research

**Researched:** 2026-03-31
**Domain:** Multi-floor procedural generation, turn-based roguelike mechanics, ECS state transitions, React/PixiJS overlay architecture
**Confidence:** HIGH

## Summary

Phase 12 extends the existing single-floor BSP dungeon generator to support sequential multi-floor descent with floor-specific seeded generation, implements a dual-drain Stability system (per-floor chunk + per-turn bleed) with degraded state mechanics, introduces Stability Anchors as interactive extraction decision points with a full-fidelity System Handshake overlay UI, scales content by depth (enemies/loot/BSP parameters), and provides comprehensive run results screens for both extraction and death outcomes.

The phase leverages the existing ECS architecture, event-driven systems, PixiJS filter pipeline, and React overlay patterns. Key technical challenges include: refactoring `engine-factory.ts` to support floor regeneration while preserving player state, implementing pause/resume for the turn manager during Anchor interaction, applying PixiJS ColorMatrix filters for desaturation effects, and managing complex nested UI state with Zustand for the Anchor overlay and results screens.

**Primary recommendation:** Refactor dungeon generation into a reusable function accepting depth-specific parameters, extend the action pipeline for floor transitions and Anchor operations, implement Stability as a component with dual-drain logic in a new system, use PixiJS's built-in ColorMatrixFilter for world desaturation during Anchor UI, and mount React overlays using the established pattern from MainMenu/GameOver.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Floor Transition Architecture:**
- **D-01:** Regenerate-on-descent — destroy all non-player entities, generate new Grid with seed `runSeed_floor_N`, place new entities via `placeEntities(depth=N)`. Player persists with all components. Systems stay alive.
- **D-02:** No backtracking — floors are one-way. Previous floors not cached.
- **D-03:** Staircase spawns in room furthest from player spawn (greatest distance). Deterministic.
- **D-04:** Step-on + confirm interaction — moving onto staircase prompts confirmation dialog. Prevents accidental descent.
- **D-05:** Max floor depth configurable in JSON, default 15.
- **D-06:** Voluntary descent only — staircase available from floor start. No kill/explore quota.
- **D-07:** Quick glitch fade transition — glitch effect (~200ms), fade to black with scanlines (~200ms), generate floor, fade in (~200ms), floor number flash ("FLOOR 06").

**Stability System:**
- **D-08:** Dual drain model — per-floor chunk on entry AND per-turn passive bleed. Maximum pressure.
- **D-09:** Linear escalation curve — both per-floor chunk and per-turn drain increase linearly with depth. Configurable in JSON.
- **D-10:** Stability starts at 100% from floor 1. Drain active from first floor.
- **D-11:** Zero stability = degraded state — player takes HP damage each turn. Player might limp to Anchor. Creates dramatic moments.
- **D-12:** Degraded state visual feedback: HUD corruption (scanlines, flicker, text corruption) AND progressive screen desaturation. World loses color as stability drops, HUD glitches at zero.
- **D-13:** Stability bar always visible on HUD alongside Health and Heat.
- **D-14:** Floor number and depth band label always visible (e.g., "FLOOR 07 // DEPTH BAND: STATIC HORRORS").

**Stability Anchor & Extraction:**
- **D-15:** Anchors appear every 5 floors (5, 10, 15) as interactable entities in normal rooms (not dedicated rooms). Enemies may be present.
- **D-16:** Risky interact — player can interact with Anchor even with enemies present. Game pauses during overlay.
- **D-17:** React overlay + game pause — stepping on Anchor pauses turn loop, PixiJS applies grayscale filter to world, React `<AnchorOverlay>` mounts. Player decides, overlay unmounts, game resumes.
- **D-18:** Full visual fidelity for System Handshake UI in Phase 12 — complete desaturation, bold condensed sans-serif, exact cyan/pink palette from VIS-07. Ships final, not deferred to Phase 16.
- **D-19:** Categorized inventory manifest with expandable sections — Firmware / Augments / Software / Currency, each showing names, rarity, slot info.
- **D-20:** Full risk breakdown on Descend option — next floor number, estimated Stability after descent, enemy tier range, Scrap cost.
- **D-21:** Extract transfers all unsecured items to Stash (per STAB-04). Brief de-rezz animation (~1-2 sec) before results screen.
- **D-22:** Anchor breaks after Descend (per STAB-05). Player cannot re-use it.
- **D-23:** Descend costs Scrap (common currency). Cost configurable in JSON, scales with depth.

**Depth Content Scaling:**
- **D-24:** Both palette shifts AND structural BSP parameter changes per depth band. Floors 1-5 cool/cyan with large rooms, 5-10 warmer/amber with cramped corridors, 10-15 red/corrupted with open arenas.
- **D-25:** Four special room types: Treasure (high-value loot, no enemies), Challenge (extra-dense enemies, locked exit, bonus loot), Hazard (damaging/restricting terrain), and guaranteed Anchor placement on floors 5/10/15.
- **D-26:** JSON depth-gated loot tables — same pattern as depth-distribution.json for enemies. Firmware drops only below floor 5, rare Augments below floor 10 (per FLOOR-05).

**Scrap Currency (Minimal Implementation):**
- **D-27:** Minimal ScrapComponent (`{ amount: number }`) on player. Enemies drop Scrap. Anchor deducts Scrap for Descend. Phase 13 replaces with full WalletComponent.
- **D-28:** On extraction, Scrap transfers to stash. On death, 25% Scrap pity payout.

**Run Results Screen:**
- **D-29:** Full results screen: extraction manifest (items kept), run stats (floors cleared, enemies killed, turns taken, peak Heat, Firmware activations), cause of end, score breakdown (depth/kill/loot/speed bonuses).
- **D-30:** Different visual tone for extraction vs death — extraction gets clean cyan/success aesthetic, death gets BSOD treatment (Safety Orange, "FATAL_EXCEPTION").
- **D-31:** BSOD reason is context-specific — each death source maps to unique error message (e.g., "KERNEL_PANIC_DURING_COMBAT", "REALITY_STABILITY_COLLAPSE", "TERMINATED_BY: SYSTEM_ADMIN", "BUFFER_OVERFLOW_DETONATION").

**Death Flow:**
- **D-32:** Death → death animation (glitch dissolve, ~500ms) → BSOD screen (2-3 sec with context-specific reason) → results screen (death variant with items lost, 25% Scrap pity) → "REINITIALIZE" button returns to main menu.
- **D-33:** Post-run destination is current game entry point (main menu). Phase 15 redirects to Neural Deck Hub.

### Claude's Discretion

- Exact stability drain values per floor (chunk size, per-turn bleed rate, linear scaling formula)
- Exact Scrap drop amounts per enemy tier and Anchor Descend cost scaling
- Degraded state HP damage rate per turn
- BSP parameter values per depth band (room size ranges, corridor width, room count)
- Palette shift implementation (PixiJS tint vs color matrix filter vs tileset swap)
- Special room spawn probability per depth band
- Score formula components and weights
- Staircase and Anchor entity tile appearance
- De-rezz extraction animation implementation details
- BSOD screen layout, font sizes, animation timing
- Confirmation dialog style for staircase descent
- Floor number flash animation duration and style

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAB-01 | Reality Stability bar decreases with depth | StabilityComponent with dual-drain system architecture |
| STAB-02 | Stability Anchors at fixed intervals (every 5 floors) | AnchorMarker component + special room placement in entity-placement.ts |
| STAB-03 | Anchor interaction pauses game, presents extraction UI | TurnManager pause/resume + React overlay mount pattern |
| STAB-04 | Extract transfers unsecured items to Stash (100% success) | Action pipeline ANCHOR_EXTRACT handler + run inventory transfer |
| STAB-05 | Descend refills Stability, costs currency, Anchor breaks | Action pipeline ANCHOR_DESCEND handler + ScrapComponent deduction |
| STAB-06 | Death/zero Stability loses all unsecured items, 25% Scrap pity | Existing death clearing in pipeline.ts extended for Scrap payout |
| STAB-07 | Anchor UI displays floor, stability, inventory manifest, decision options | React AnchorOverlay component with Zustand state integration |
| STAB-08 | System Handshake visual style (desaturation, bold typography, cyan/pink) | PixiJS ColorMatrixFilter desaturation + CSS design system |
| STAB-09 | Stability drain rate increases with depth | Linear scaling formula in stability-system.ts config |
| FLOOR-01 | Multiple sequential floors player descends through | Floor state tracking + transition system |
| FLOOR-02 | Each floor independently generated with floor-specific seed | `generateDungeon()` accepts seed `${runSeed}_floor_${N}` |
| FLOOR-03 | Floor transitions via staircase entity with descent choice | StaircaseMarker component + input handler for interaction |
| FLOOR-04 | Enemy composition and difficulty scales with depth | Existing depth-distribution.json tables already implemented in Phase 11 |
| FLOOR-05 | Loot tables improve with depth (Firmware below 5, Augments below 10) | New loot-distribution.json following depth-distribution.json pattern |
| FLOOR-06 | Environmental variety per depth band (tile themes, layouts, hazards) | Depth-specific BSP parameters + palette/tint configuration |
| FLOOR-07 | Unique room types at specific depths (treasure, challenge, Anchor) | Special room type enum + placement logic in entity-placement.ts |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rot-js | 2.2.1 | Seeded RNG for floor generation | Industry-standard roguelike toolkit, already integrated for BSP generation |
| pixi.js | 8.17.0 | Rendering engine | Already used for all game rendering, built-in filter support |
| pixi-filters | 6.1.5 | Visual effects (desaturation, glitch) | Official PixiJS filter collection, already used for enemy glitch effects |
| react | 19.2.4 | UI overlays | Entire UI layer uses React, established overlay pattern |
| zustand | 5.0.11 | UI state management | Project-standard for game UI state, lightweight |
| zod | 4.3.6 | Schema validation | Project-wide pattern for component definitions and API validation |

**Installation:**
All dependencies already installed in project. No new packages required.

**Version verification:**
Verified from package.json (read 2026-03-31). All versions current as of January 2025 training data.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json-diff-ts | 4.10.0 | State delta generation | Action pipeline for network sync (already used) |
| next.js | 16.1.6 | App framework | Route handlers for session/action API (already used) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rot-js RNG | seedrandom npm package | rot-js already integrated and handles BSP generation; no value in introducing second RNG |
| PixiJS ColorMatrixFilter | Custom shader | ColorMatrixFilter is battle-tested and performant; custom shader adds complexity for no gain |
| Zustand | Redux/MobX | Zustand already project-standard, minimal API surface, sufficient for phase needs |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shared/components/
│   ├── stability.ts           # New: StabilityComponent with current/max/drainRate
│   ├── scrap.ts               # New: ScrapComponent with amount
│   ├── floor-state.ts         # New: FloorState with currentFloor/maxFloor/runSeed
│   ├── staircase-marker.ts    # New: StaircaseMarker for staircase entities
│   └── anchor-marker.ts       # New: AnchorMarker for Anchor entities
├── game/systems/
│   ├── stability.ts           # New: Stability drain system (per-floor + per-turn)
│   ├── floor-manager.ts       # New: Floor transition orchestration
│   └── anchor-interaction.ts  # New: Anchor interaction handlers
├── game/generation/
│   ├── dungeon-generator.ts   # EXTEND: Accept depth-specific BSP config
│   ├── entity-placement.ts    # EXTEND: Staircase/Anchor placement, special rooms
│   └── depth-config.json      # New: BSP params, palette, special room probabilities per band
├── game/engine-factory.ts     # REFACTOR: Extract floor generation into reusable function
├── components/ui/
│   ├── AnchorOverlay.tsx      # New: System Handshake extraction decision UI
│   ├── RunResultsScreen.tsx   # New: Post-run stats and item manifest
│   ├── BSODScreen.tsx         # New: Death screen with context-specific error
│   ├── StabilityBar.tsx       # New: HUD stability indicator
│   └── FloorIndicator.tsx     # New: HUD floor number + depth band label
├── rendering/filters/
│   └── screen-effects.ts      # New: Desaturation, scanlines, HUD corruption helpers
└── shared/pipeline.ts         # EXTEND: ANCHOR_EXTRACT, ANCHOR_DESCEND, DESCEND_FLOOR actions
```

### Pattern 1: Floor-Specific Seeded Generation
**What:** Derive floor-specific seeds from base run seed to ensure deterministic generation per floor.
**When to use:** Every floor transition, dungeon regeneration.
**Example:**
```typescript
// Existing pattern from engine-factory.ts
function hashSeedForPlacement(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// New: Floor-specific seed derivation
function generateFloorSeed(runSeed: string, floorNumber: number): string {
  return `${runSeed}_floor_${floorNumber}`;
}

// Usage in floor generation
const floorSeed = generateFloorSeed(context.runSeed, currentFloor);
RNG.setSeed(hashSeedForPlacement(floorSeed));
const dungeonResult = generateDungeon({
  width: 80,
  height: 45,
  seed: floorSeed,
  depth: currentFloor, // Pass depth for BSP parameter selection
});
```
**Source:** Existing pattern from `src/game/engine-factory.ts` lines 136-142 + rot-js deterministic generation.

### Pattern 2: Floor Regeneration While Preserving Player
**What:** Destroy all non-player entities and grid, regenerate dungeon, re-instantiate enemies/items, but preserve player entity with all components.
**When to use:** Floor transitions (D-01).
**Example:**
```typescript
// Conceptual pattern extending engine-factory.ts
function descendToFloor(
  context: EngineInstance,
  newFloor: number,
  runSeed: string
): void {
  const { world, grid, eventBus, entityFactory, componentRegistry, playerId } = context;

  // 1. Preserve player components (read before destroying grid)
  const playerComponents = world.getAllComponents(playerId);

  // 2. Destroy all non-player entities
  const allEntities = world.getAllEntities();
  for (const entityId of allEntities) {
    if (entityId !== playerId) {
      world.destroyEntity(entityId);
    }
  }

  // 3. Clear grid (but keep player in world)
  grid.clear();

  // 4. Generate new floor
  const floorSeed = generateFloorSeed(runSeed, newFloor);
  RNG.setSeed(hashSeedForPlacement(floorSeed));

  const dungeonResult = generateDungeon({
    width: grid.width,
    height: grid.height,
    seed: floorSeed,
    depth: newFloor,
  });

  // 5. Replace grid terrain
  grid.replaceWith(dungeonResult.grid);

  // 6. Place player at spawn room center
  const spawnRoom = dungeonResult.playerSpawnRoom;
  const playerPos = world.getComponent(playerId, Position)!;
  grid.removeEntity(playerId, playerPos.x, playerPos.y);
  playerPos.x = spawnRoom.centerX;
  playerPos.y = spawnRoom.centerY;
  grid.addEntity(playerId, playerPos.x, playerPos.y);

  // 7. Place new enemies and items
  placeEntities(
    world,
    grid,
    entityFactory,
    componentRegistry,
    dungeonResult.rooms,
    dungeonResult.playerSpawnRoom,
    { random: () => RNG.getUniform() },
    { depth: newFloor }
  );

  // 8. Emit floor transition event
  eventBus.emit('FLOOR_TRANSITION', { floorNumber: newFloor });
}
```
**Source:** Extrapolated from existing `createEngineInstance()` in `src/game/engine-factory.ts` and entity persistence patterns.

### Pattern 3: Dual-Drain Stability System
**What:** Stability decreases via two mechanisms: per-floor chunk on entry and per-turn passive bleed. Both scale linearly with depth.
**When to use:** Floor transitions (chunk drain), turn manager POST_TURN phase (passive bleed).
**Example:**
```typescript
// New: src/game/systems/stability.ts
export interface StabilityConfig {
  initialStability: number; // 100
  perFloorChunkBase: number; // e.g., 5
  perFloorChunkScale: number; // e.g., 0.5 (increases by 0.5 per floor)
  perTurnBleedBase: number; // e.g., 0.5
  perTurnBleedScale: number; // e.g., 0.1
  degradedDamagePerTurn: number; // e.g., 2 HP
}

export function createStabilitySystem(
  world: World,
  eventBus: EventBus,
  config: StabilityConfig
) {
  function applyFloorDrain(entityId: EntityId, floorNumber: number) {
    const stability = world.getComponent(entityId, Stability);
    if (!stability) return;

    const chunkDrain = config.perFloorChunkBase + (floorNumber - 1) * config.perFloorChunkScale;
    stability.current = Math.max(0, stability.current - chunkDrain);

    eventBus.emit('STABILITY_CHANGED', {
      entityId,
      oldValue: stability.current + chunkDrain,
      newValue: stability.current,
      reason: 'floor_entry',
    });

    if (stability.current === 0) {
      eventBus.emit('STABILITY_ZERO', { entityId });
    }
  }

  function applyTurnBleed(entityId: EntityId, floorNumber: number) {
    const stability = world.getComponent(entityId, Stability);
    if (!stability) return;

    const bleedDrain = config.perTurnBleedBase + (floorNumber - 1) * config.perTurnBleedScale;
    const oldValue = stability.current;
    stability.current = Math.max(0, stability.current - bleedDrain);

    if (oldValue !== stability.current) {
      eventBus.emit('STABILITY_CHANGED', {
        entityId,
        oldValue,
        newValue: stability.current,
        reason: 'turn_bleed',
      });

      if (stability.current === 0 && oldValue > 0) {
        eventBus.emit('STABILITY_ZERO', { entityId });
      }
    }
  }

  function applyDegradedDamage(entityId: EntityId) {
    const stability = world.getComponent(entityId, Stability);
    const health = world.getComponent(entityId, Health);
    if (!stability || !health || stability.current > 0) return;

    const oldHp = health.current;
    health.current = Math.max(0, health.current - config.degradedDamagePerTurn);

    eventBus.emit('DEGRADED_DAMAGE', {
      entityId,
      damage: config.degradedDamagePerTurn,
    });

    if (health.current === 0 && oldHp > 0) {
      eventBus.emit('ENTITY_DIED', {
        entityId,
        killerId: entityId, // Self-inflicted
      });
    }
  }

  return {
    applyFloorDrain,
    applyTurnBleed,
    applyDegradedDamage,
    init() {
      eventBus.on('FLOOR_TRANSITION', (payload) => {
        const player = getPlayerEntity(world);
        if (player) {
          applyFloorDrain(player.id, payload.floorNumber);
        }
      });
    },
  };
}
```
**Source:** Derived from existing system factory pattern (`createHeatSystem`, `createStatusEffectSystem`) and Heat dual-mechanic model (cost + dissipation).

### Pattern 4: React Overlay with Game Pause
**What:** Mount React overlay on top of PixiJS canvas, pause turn manager, apply PixiJS filter to world, unmount overlay and resume on decision.
**When to use:** Anchor interaction (D-16, D-17), confirmation dialogs.
**Example:**
```typescript
// New: src/game/systems/anchor-interaction.ts
export function createAnchorInteractionSystem(
  world: World,
  eventBus: EventBus,
  turnManager: TurnManager,
  uiStore: typeof gameStore
) {
  function handleAnchorStep(entityId: EntityId, x: number, y: number) {
    const anchorMarker = world.getComponent(grid.getEntityAt(x, y)!, AnchorMarker);
    if (!anchorMarker) return;

    // 1. Pause turn manager
    turnManager.pause();

    // 2. Apply grayscale filter (via event to rendering layer)
    eventBus.emit('APPLY_WORLD_FILTER', { filterType: 'grayscale' });

    // 3. Mount React overlay (via Zustand store)
    uiStore.setState({
      anchorOverlayVisible: true,
      anchorData: {
        floorNumber: getCurrentFloor(world),
        stability: getStability(entityId),
        inventory: getRunInventory(sessionId),
        descendCost: calculateDescendCost(getCurrentFloor(world)),
      },
    });

    // Overlay will emit ANCHOR_EXTRACT or ANCHOR_DESCEND when player decides
  }

  return {
    init() {
      eventBus.on('ENTITY_MOVED', (payload) => {
        const grid = getGrid(); // Access grid from closure
        const targetEntity = grid.getEntityAt(payload.toX, payload.toY);
        if (targetEntity) {
          handleAnchorStep(payload.entityId, payload.toX, payload.toY);
        }
      });

      eventBus.on('ANCHOR_DECISION_MADE', () => {
        // 4. Remove filter
        eventBus.emit('REMOVE_WORLD_FILTER', { filterType: 'grayscale' });

        // 5. Resume turn manager
        turnManager.resume();

        // 6. Unmount overlay
        uiStore.setState({ anchorOverlayVisible: false });
      });
    },
  };
}
```
**Source:** Derived from existing game state transition pattern in `src/game/ui/store.ts` and `src/app/page.tsx` conditional rendering.

### Pattern 5: PixiJS ColorMatrixFilter for Desaturation
**What:** Apply ColorMatrixFilter to world container for instant desaturation/grayscale effect.
**When to use:** Anchor overlay, progressive desaturation as stability drops (D-12).
**Example:**
```typescript
// New: src/rendering/filters/screen-effects.ts
import { ColorMatrixFilter } from 'pixi.js';

export function createDesaturationFilter(amount: number = 1.0): ColorMatrixFilter {
  const filter = new ColorMatrixFilter();
  // amount: 0 = full color, 1 = full grayscale
  filter.desaturate();
  return filter;
}

export function applyGrayscaleToContainer(container: Container) {
  const filter = createDesaturationFilter(1.0);
  container.filters = [filter];
}

export function removeFiltersFromContainer(container: Container) {
  container.filters = null;
}

// Progressive desaturation based on stability percentage
export function applyStabilityDesaturation(
  container: Container,
  stabilityPercent: number
) {
  if (stabilityPercent > 50) {
    // No desaturation above 50%
    container.filters = null;
    return;
  }

  // 50% stability = 0% desaturation, 0% stability = 100% desaturation
  const desaturationAmount = (50 - stabilityPercent) / 50;
  const filter = new ColorMatrixFilter();
  filter.desaturate(); // Full desaturation

  // Scale filter intensity
  const blendFilter = new ColorMatrixFilter();
  blendFilter.alpha = desaturationAmount; // Blend with original

  container.filters = [filter];
}
```
**Source:** PixiJS ColorMatrixFilter API (verified in pixi-filters package, already used for glitch effects in `src/rendering/filters/glitch-effects.ts`).

### Anti-Patterns to Avoid

- **Caching previous floors:** D-02 explicitly states no backtracking. Storing old floor state wastes memory and adds complexity. Regenerate on demand if backtracking is ever added.
- **Mutating player entity during floor transition:** Player entity ID must remain stable across floors. Never destroy/recreate the player entity — only update Position component.
- **Synchronous floor generation blocking UI:** Floor generation (BSP + entity placement) can take 50-100ms on large grids. User has decided voluntary descent is acceptable (D-06), so transition can block briefly. The quick glitch fade (D-07) masks generation time.
- **Global filter state on PixiJS Application:** Always apply filters to specific containers (worldContainer), never app.stage. Allows UI overlays to remain unaffected.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Seeded random generation | Custom PRNG with seed string hashing | rot-js RNG.setSeed() | Already integrated, battle-tested, handles all BSP generation edge cases |
| Grayscale/desaturation shader | Custom WebGL fragment shader | PixiJS ColorMatrixFilter | Built-in, optimized, one-line API (`.desaturate()`), already used for glitch effects |
| JSON diffing for state deltas | Manual property comparison | json-diff-ts | Already integrated for server reconciliation, handles nested objects/arrays |
| UI state management | Custom event emitters or Context API | Zustand | Already project-standard, minimal boilerplate, devtools support |
| Component validation | Manual type checking | Zod schemas | Project-wide pattern for all components, provides runtime validation + TypeScript types |

**Key insight:** This phase extends established patterns rather than introducing new ones. The existing ECS architecture, event-driven systems, and React/PixiJS separation make multi-floor mechanics a natural extension. The temptation to "optimize" floor generation (e.g., caching, streaming) should be resisted — simplicity and determinism are more valuable than premature optimization.

## Common Pitfalls

### Pitfall 1: Floor Seed Collisions
**What goes wrong:** Using naive seed derivation like `${runSeed}${floorNumber}` creates collisions (e.g., `"abc123"` becomes `"abc1231"` for floor 1, same as run seed `"abc1231"` floor 0).
**Why it happens:** String concatenation without delimiters.
**How to avoid:** Use underscore delimiter: `${runSeed}_floor_${floorNumber}`. Guarantees uniqueness.
**Warning signs:** Identical floor layouts appearing at different depths.

### Pitfall 2: Entity Iteration During Destruction
**What goes wrong:** Iterating `world.getAllEntities()` while calling `world.destroyEntity()` inside the loop can skip entities or crash.
**Why it happens:** Entity list mutates during iteration.
**How to avoid:** Snapshot entity IDs before loop: `const entities = [...world.getAllEntities()]; entities.forEach(id => world.destroyEntity(id))`.
**Warning signs:** Entities surviving floor transitions, inconsistent entity counts.

### Pitfall 3: Stability Drain Race Condition
**What goes wrong:** Stability drain triggers death, death handler tries to access Stability component that was just removed.
**Why it happens:** Event handlers fire synchronously in arbitrary order.
**How to avoid:** Check component existence before every access: `if (!stability) return;`. Emit STABILITY_ZERO before ENTITY_DIED, handle death in separate listener.
**Warning signs:** "Cannot read property of undefined" errors on death, inconsistent death processing.

### Pitfall 4: Filter Memory Leaks
**What goes wrong:** Creating new ColorMatrixFilter instances every frame without cleanup causes memory leak.
**Why it happens:** PixiJS filters are not automatically garbage collected when reassigned.
**How to avoid:** Reuse single filter instance or explicitly destroy: `container.filters?.forEach(f => f.destroy()); container.filters = null;`.
**Warning signs:** Increasing memory usage over time, performance degradation after many floor transitions.

### Pitfall 5: TurnManager Pause State Desync
**What goes wrong:** Game pauses for Anchor overlay, player alt-tabs away, overlay unmounts on focus loss, turn manager never resumes.
**Why it happens:** Pause/resume calls not balanced in all code paths.
**How to avoid:** Track pause depth counter or explicit pause token. On overlay unmount, always call resume regardless of decision path.
**Warning signs:** Game freezes after Anchor interaction, input stops working.

### Pitfall 6: Depth-Gated Content Not Loading
**What goes wrong:** Firmware drops configured for floor 5+ but never appear.
**Why it happens:** Loot table depth check uses wrong comparison operator (e.g., `depth > 5` instead of `depth >= 5`).
**How to avoid:** Use inclusive range checks (`>=`, `<=`) for depth bands. Test at exact boundary floors (5, 10, 15).
**Warning signs:** Items expected at depth N only appear at depth N+1.

### Pitfall 7: React Overlay Z-Index Issues
**What goes wrong:** Anchor overlay renders behind PixiJS canvas or other UI elements.
**Why it happens:** CSS z-index not set or PixiJS canvas has higher stacking context.
**How to avoid:** Ensure overlay div has `position: fixed; z-index: 9999;` and PixiJS canvas has lower z-index. Use portal rendering for overlays.
**Warning signs:** Overlay invisible or partially covered, click events not registering.

## Code Examples

### Example 1: Floor-Specific Seed Derivation
```typescript
// Source: Existing pattern from src/game/engine-factory.ts + new floor logic
function hashSeedForPlacement(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateFloorSeed(runSeed: string, floorNumber: number): string {
  return `${runSeed}_floor_${floorNumber}`;
}

// Usage
const floorSeed = generateFloorSeed('run-abc123', 7); // "run-abc123_floor_7"
RNG.setSeed(hashSeedForPlacement(floorSeed));
```

### Example 2: Depth-Specific BSP Configuration
```typescript
// New: src/game/generation/depth-config.json
{
  "depthBands": [
    {
      "range": { "min": 1, "max": 5 },
      "label": "CORRUPTED_DATA",
      "bspConfig": {
        "minRoomSize": 7,
        "maxRoomSize": 14,
        "minRooms": 6,
        "corridorWidth": 2
      },
      "palette": {
        "floor": 0x003344,
        "wall": 0x001122,
        "tint": 0x00DDFF
      },
      "specialRoomProbability": {
        "treasure": 0.1,
        "challenge": 0.05,
        "hazard": 0.0
      }
    },
    {
      "range": { "min": 6, "max": 10 },
      "label": "STATIC_HORRORS",
      "bspConfig": {
        "minRoomSize": 5,
        "maxRoomSize": 10,
        "minRooms": 8,
        "corridorWidth": 1
      },
      "palette": {
        "floor": 0x442200,
        "wall": 0x221100,
        "tint": 0xFFAA00
      },
      "specialRoomProbability": {
        "treasure": 0.15,
        "challenge": 0.1,
        "hazard": 0.1
      }
    },
    {
      "range": { "min": 11, "max": 15 },
      "label": "LOGIC_BREAKERS",
      "bspConfig": {
        "minRoomSize": 10,
        "maxRoomSize": 18,
        "minRooms": 4,
        "corridorWidth": 3
      },
      "palette": {
        "floor": 0x440000,
        "wall": 0x220000,
        "tint": 0xFF0055
      },
      "specialRoomProbability": {
        "treasure": 0.2,
        "challenge": 0.15,
        "hazard": 0.2
      }
    }
  ]
}
```

### Example 3: Stability Component Definition
```typescript
// New: src/shared/components/stability.ts
import { z } from 'zod';
import { defineComponent } from '@engine/ecs/component';

export const StabilitySchema = z.object({
  current: z.number().min(0).max(100),
  max: z.number().min(0),
});

export type StabilityData = z.infer<typeof StabilitySchema>;

export const Stability = defineComponent<StabilityData>(
  'Stability',
  StabilitySchema
);
```

## Environment Availability

> No external dependencies beyond existing project stack. All required tools already installed.

**Step 2.6: SKIPPED** — Phase 12 requires no external tools, services, or runtimes beyond the existing project stack (Node.js, npm, installed packages). All dependencies verified in package.json. No environment checks needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAB-01 | Stability decreases with depth | unit | `npm test -- src/game/systems/stability.test.ts --run` | ❌ Wave 0 |
| STAB-02 | Anchors spawn every 5 floors | integration | `npm test -- src/game/generation/entity-placement.test.ts --run` | ✅ (extend existing) |
| STAB-03 | Anchor interaction pauses game | integration | `npm test -- src/game/systems/anchor-interaction.test.ts --run` | ❌ Wave 0 |
| STAB-04 | Extract transfers items to Stash | integration | `npm test -- src/shared/pipeline.test.ts --run` | ✅ (extend existing) |
| STAB-05 | Descend refills Stability, costs Scrap | integration | `npm test -- src/shared/pipeline.test.ts --run` | ✅ (extend existing) |
| STAB-06 | Death clears items, pays 25% Scrap | integration | `npm test -- src/shared/pipeline.test.ts --run` | ✅ (extend existing) |
| STAB-07 | Anchor UI displays correct data | unit | `npm test -- src/components/ui/AnchorOverlay.test.tsx --run` | ❌ Wave 0 |
| STAB-08 | System Handshake visual style | manual | Visual regression (Phase 16 polish) | ❌ Manual-only |
| STAB-09 | Stability drain escalates with depth | unit | `npm test -- src/game/systems/stability.test.ts --run` | ❌ Wave 0 |
| FLOOR-01 | Multiple sequential floors | integration | `npm test -- src/game/systems/floor-manager.test.ts --run` | ❌ Wave 0 |
| FLOOR-02 | Floor-specific seeded generation | unit | `npm test -- src/game/generation/dungeon-generator.test.ts --run` | ✅ (extend existing) |
| FLOOR-03 | Staircase triggers floor transition | integration | `npm test -- src/game/systems/floor-manager.test.ts --run` | ❌ Wave 0 |
| FLOOR-04 | Enemy composition scales with depth | integration | `npm test -- src/game/generation/entity-placement.test.ts --run` | ✅ (extend existing) |
| FLOOR-05 | Loot tables improve with depth | integration | `npm test -- src/game/generation/entity-placement.test.ts --run` | ✅ (extend existing) |
| FLOOR-06 | Environmental variety per depth band | unit | `npm test -- src/game/generation/depth-config.test.ts --run` | ❌ Wave 0 |
| FLOOR-07 | Special room types spawn at depth | integration | `npm test -- src/game/generation/entity-placement.test.ts --run` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npm test -- {affected-test-file} --run` (< 30 seconds)
- **Per wave merge:** `npm test -- --run` (full suite, ~2-3 minutes)
- **Phase gate:** Full suite green + manual visual inspection of UI overlays before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/game/systems/stability.test.ts` — covers STAB-01, STAB-09
- [ ] `src/game/systems/anchor-interaction.test.ts` — covers STAB-03
- [ ] `src/game/systems/floor-manager.test.ts` — covers FLOOR-01, FLOOR-03
- [ ] `src/components/ui/AnchorOverlay.test.tsx` — covers STAB-07
- [ ] `src/game/generation/depth-config.test.ts` — covers FLOOR-06
- [ ] Extend `src/game/generation/entity-placement.test.ts` for STAB-02, FLOOR-04, FLOOR-05, FLOOR-07
- [ ] Extend `src/game/generation/dungeon-generator.test.ts` for FLOOR-02
- [ ] Extend `src/shared/pipeline.test.ts` for STAB-04, STAB-05, STAB-06

## Sources

### Primary (HIGH confidence)
- Existing codebase files (read directly 2026-03-31):
  - `src/game/engine-factory.ts` — Engine initialization and entity placement patterns
  - `src/game/generation/dungeon-generator.ts` — BSP generation with seeded RNG
  - `src/game/generation/entity-placement.ts` — Depth-based spawn tables pattern
  - `src/game/entities/templates/spawn-tables/depth-distribution.json` — Existing 3-band enemy distribution
  - `src/shared/pipeline.ts` — Action pipeline and death clearing logic
  - `src/game/ui/store.ts` — Zustand state management pattern
  - `src/rendering/filters/glitch-effects.ts` — PixiJS filter usage pattern
  - `package.json` — Verified library versions (rot-js 2.2.1, pixi.js 8.17.0, pixi-filters 6.1.5, react 19.2.4, zustand 5.0.11)
- Phase 12 CONTEXT.md — 33 locked implementation decisions (D-01 through D-33)
- Phase 12 REQUIREMENTS.md — 17 phase requirements (STAB-01 through STAB-09, FLOOR-01 through FLOOR-07)
- .planning/codebase/ARCHITECTURE.md — Layer boundaries, data flow patterns

### Secondary (MEDIUM confidence)
- GitHub pixi-filters repository (2026-03-31) — Confirmed ColorMatrixFilter availability, desaturate() method exists
- PixiJS documentation (2026-03-31) — ColorMatrixFilter usage for desaturation/grayscale effects

### Tertiary (LOW confidence)
- Training data (January 2025) — General roguelike multi-floor patterns, seeded generation best practices, React/PixiJS integration patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already installed and in active use
- Architecture: HIGH — Patterns directly derived from existing codebase
- Pitfalls: MEDIUM — Based on common ECS/roguelike issues, some speculative for this codebase

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (30 days for stable game engine patterns)
