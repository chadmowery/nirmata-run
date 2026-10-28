# Phase 11: Enemy Hierarchy - Research

**Researched:** 2026-03-30
**Domain:** Turn-based enemy AI behavior systems, pack coordination, teleportation mechanics, ranged kiting, invulnerable stalker patterns, tile corruption, PixiJS sprite filters for glitch effects
**Confidence:** HIGH

## Summary

Phase 11 introduces six distinct enemy types across three tiers, each with unique AI behaviors that extend the existing 3-state machine (IDLE/CHASING/ATTACKING) through a behaviorType dispatch pattern. The implementation builds entirely on established patterns: AIState component gets a behaviorType field, the AI system dispatches to per-type handlers, JSON entity templates define all six enemy types with behavior configuration, and PixiJS filters (pixi-filters v6.x) provide glitch visual effects. The existing energy-based turn system naturally handles varied enemy speeds (System_Admin stalks slowly at 30-40 speed vs player's 100), status effects support HUD_GLITCH and movement slows, and the combat pipeline accommodates special-case effects like Firmware cooldown locks.

The most complex behaviors are Buffer-Overflow pack coordination (requires new PackMember component and shared pack state), Seed_Eater tile corruption (spread pattern with entity displacement), and System_Admin invulnerability (remove Health component entirely, instant run-end on adjacency). All behaviors are achievable without new engine primitives — they're compositions of existing systems (AI pathfinding, status effects, grid mutations, combat pipeline modifiers).

**Primary recommendation:** Extend AIState with behaviorType field, implement per-type handler functions in the AI system, create six enemy JSON templates with behavior-specific parameters, install pixi-filters for GlitchFilter/DisplacementFilter/RGBSplitFilter, and add new components (PackMember, DeadZone marker) for coordinated behaviors.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AI Behavior Architecture:**
- **D-01:** Behavior key dispatch pattern — add a `behaviorType` field to `AIState` component (e.g., `'null_pointer'`, `'buffer_overflow'`, `'fragmenter'`, `'logic_leaker'`, `'system_admin'`, `'seed_eater'`). The AI system dispatches to per-type handler functions based on this key. Each handler has its own state transitions and actions. JSON-configurable, single AI system.
- **D-02:** The existing 3-state machine (IDLE/CHASING/ATTACKING) remains as the base. Per-type handlers extend or override specific transitions and behaviors.
- **D-03:** Per-type fixed energy speed in JSON templates — Null-Pointer fast (120), Buffer-Overflow moderate (80), Fragmenter slow (60), etc. No speed randomization.

**Pack AI (Buffer-Overflow):**
- **D-04:** Shared pack ID via a `PackMember` component with a `packId` field. Pack leader coordinates movement — followers try to surround the player relative to leader position.
- **D-05:** Detonation is proximity-triggered: if 3+ pack members are adjacent to the player, all eligible pack members detonate for AOE damage + movement slow.
- **D-06:** Pack members always spawn together in the same room. PlacementConfig spawns 5-8 Buffer-Overflows in one room when the template is selected.

**Null-Pointer Teleport:**
- **D-07:** Instant reposition — Null-Pointer disappears from current tile and appears behind the player in the same turn. Simple position update. Visual feedback via brief flicker/static effect at origin and destination.

**Ranged AI (Logic-Leaker):**
- **D-08:** Range threshold in handler — Logic-Leaker checks distance to player. If within attack range and has line of sight, fires a Corrupted Packet (ranged attack). If player gets too close, moves away (kiting). Uses existing FOV for LOS checks.
- **D-09:** Firmware cooldown on hit uses status effect approach — Logic-Leaker hit applies a `FIRMWARE_LOCK` status effect (Phase 9 infrastructure) to a random equipped Firmware for N turns. Firmware system checks for this effect and blocks activation.

**Fragmenter Dead Zones:**
- **D-10:** Dead Zone tiles are time-limited — persist for N turns (e.g., 5-8), then fade. Duration configurable in JSON template. Creates area denial without permanently cluttering the map.

**Death Effects & Damage Feedback:**
- **D-11:** Damage feedback uses sprite distortion — on damage, the enemy sprite visually glitches with horizontal tear/displacement for ~200ms and scanline effect. Requires PixiJS filter/shader on individual sprites.
- **D-12:** Per-type unique death effects — each of the 6 enemy types gets its own death effect (Null-Pointer flickers and vanishes, Buffer-Overflow explodes in pixel shrapnel, Fragmenter crumbles, etc.).
- **D-13:** Full death effect implementation in Phase 11 — all 6 unique death effects with full visual fidelity, not deferred to Phase 16.

**Depth-Based Spawning:**
- **D-14:** JSON spawn table configuration — a spawn-distribution config file maps depth ranges to weighted template lists. PlacementConfig reads from this table instead of a flat array. Tunable without code changes.
- **D-15:** Enemy count per room scales with depth — floors 1-5: 1-2, floors 5-10: 2-3, floors 10-15: 2-4. Configurable in the spawn table alongside template weights.

**System_Admin (Tier 3 — Invulnerable Stalker):**
- **D-16:** No Health component — System_Admin has no Health component at all. Attacks never resolve damage. Stun comes from a special 'disrupt' interaction (Firmware ability or status effect) that pauses its movement for N turns. No health bar displayed.
- **D-17:** Either-direction run-end — any adjacency + movement into the other's tile triggers instant run-end. System_Admin walking into the player OR the player accidentally moving into System_Admin both cause it.
- **D-18:** Low energy speed for stalking feel — System_Admin has very low energy speed (30-40 vs player's 100). Takes a turn every 2-3 player turns through the existing energy/turn system. Always pathfinds toward the player.
- **D-19:** Ambient HUD warning when System_Admin is present on the floor — a subtle persistent indicator (flickering 'ADMIN_PROCESS_DETECTED' text or pulsing icon). Player knows it's there but not where.

**Seed_Eater (Tier 3 — Room Corruptor):**
- **D-20:** Tile corruption spread — instead of full room rearrangement, Seed_Eater corrupts individual tiles (turning walkable tiles to walls and vice versa) in a spreading pattern. Simpler than full re-generation, still creates spatial chaos.
- **D-21:** Corruption pushes entities — when a tile corrupts to wall, any entity on it is pushed to the nearest walkable tile. Prevents softlocks. Seed_Eater's own tile is immune. Player gets a brief 'displaced' visual effect.
- **D-22:** Seed_Eater spawns full Tier 1 entities as sub-processes — actual Null-Pointer or Buffer-Overflow entities from existing JSON templates with full AI and loot drops.
- **D-23:** Seed_Eater is killable with high HP (mini-boss tier). Killing it stops corruption and sub-process spawning. Drops high-value loot. Rewards aggressive play.

### Claude's Discretion

- Exact stat values for all 6 enemy types (HP, attack power, defense, sight radius)
- Null-Pointer teleport range and "behind player" tile selection algorithm
- Buffer-Overflow detonation damage values and slow duration
- Dead Zone damage-over-time values and tick frequency
- Logic-Leaker attack range, Corrupted Packet damage, FIRMWARE_LOCK duration
- System_Admin stun duration and what can stun it (any Firmware? specific types?)
- Seed_Eater corruption rate (tiles per turn), spread pattern, sub-process spawn frequency
- Seed_Eater HP pool and loot drop table
- HUD warning visual style details for System_Admin presence
- Sprite distortion filter implementation details (displacement map, scanline shader, etc.)
- Exact spawn table weight values per depth band
- Energy speed values per enemy type (suggestions given but exact tuning is discretionary)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENEMY-01 | Enemies are visually "glitched" — high-contrast silhouettes with neon bleeding, flickering, and static trails | pixi-filters v6.x provides GlitchFilter, RGBSplitFilter, CRTFilter; PixiJS v8 sprite.filters array applies per-sprite effects; rendering system sprite-map.ts manages individual sprite references |
| ENEMY-02 | When enemies take damage, they leak source code fragments or static instead of blood | DAMAGE_DEALT event triggers visual effect; DisplacementFilter + custom particle emitter; existing animation system in rendering/animations.ts provides tween framework |
| ENEMY-03 | Tier 1 Null-Pointer: teleports short distances, flanks player, applies HUD_GLITCH on hit | AIState behaviorType dispatch; teleport via position update + visual effect; HUD_GLITCH via StatusEffects component (Phase 9); bump attack applies status effect |
| ENEMY-04 | Tier 1 Buffer-Overflow: packs of 5-8, surrounds player, detonates for AOE + slow | PackMember component with packId; spawn coordination in entity-placement.ts; proximity check for detonation; StatusEffects for movement slow |
| ENEMY-05 | Tier 2 Fragmenter: ground slam creates Dead Zone tiles with DoT | DeadZone component on grid tiles; StatusEffects DoT pattern from Phase 9/10; time-limited tile markers; grid.setTileProperty() for tile state |
| ENEMY-06 | Tier 2 Logic-Leaker: ranged attacks, forces Firmware cooldown on hit | Range/LOS checks via existing FOV system; ranged attack event (RANGED_ATTACK); FIRMWARE_LOCK status effect (Phase 9); Firmware system checks for lock before activation |
| ENEMY-07 | Tier 3 System_Admin: slowly stalks, invulnerable, instant run-end on touch | No Health component; low energy speed (30-40); adjacency check in AI handler; RUN_ENDED event; ambient HUD warning flag |
| ENEMY-08 | Tier 3 Seed_Eater: shifts room layout, spawns Tier 1 sub-processes | Tile corruption via grid.setTileType(); spreading pattern algorithm; entity displacement when tile corrupts; EntityFactory.create() for sub-process spawning |
| ENEMY-09 | Enemy types distributed by depth: Tier 1 floors 1-5, Tier 2 floors 5-10, Tier 3 floors 10-15 | JSON spawn table maps depth ranges to weighted enemy templates; entity-placement.ts reads spawn table; configurable per-room enemy counts |
| ENEMY-10 | Each enemy type has unique death effects matching glitch aesthetic | Per-type death animation handlers; PixiJS filter combinations; particle systems; existing queueDeathAnimation framework in animations.ts |
| ENEMY-11 | Enemy data defined in JSON entity templates | Existing goblin.json pattern; mixin inheritance; component overrides; behaviorType field in aiState component; behavior-specific parameters in custom components |

</phase_requirements>

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi-filters | 6.1.5 | Sprite visual effects (glitch, distortion, scanlines) | Official PixiJS filters package; 40+ production-ready filters; compatible with PixiJS v8.17.0 |
| PixiJS | 8.17.0 | Rendering engine (already installed) | Project standard; sprite.filters array API for per-sprite effects |
| rot-js | 2.2.1 | Pathfinding and FOV (already installed) | Project standard; A* pathfinding for all AI movement, PreciseShadowcasting for LOS checks |
| Zod | 4.3.6 | Component schema validation (already installed) | Project standard; all new components (PackMember, DeadZone, etc.) use defineComponent pattern |

**Installation:**
```bash
npm install pixi-filters@6.1.5
```

**Version verification:**
- pixi-filters v6.x is compatible with PixiJS v8.x (current project version: 8.17.0)
- Published: 2025-11-29 (latest stable release)

### Supporting Tools (No Installation Needed)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| json-diff-ts | State delta calculation | Already integrated; enemy state changes sync via deltas |
| TypeScript discriminated unions | behaviorType dispatch type safety | Type-safe handler selection based on AIState.behaviorType |
| Existing EventBus | AI behavior coordination | All inter-system communication (pack detonation, tile corruption, death effects) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pixi-filters (official package) | Custom WebGL shaders | Custom shaders offer more control but require significant GLSL expertise; filters are production-tested and performant |
| Behavior key dispatch (D-01) | Separate AI system per enemy type | Separate systems create code duplication and harder maintenance; dispatch pattern is cleaner and JSON-configurable |
| PackMember component | Hardcoded pack logic in AI system | Component-based approach is more flexible and testable; enables querying packs independently |
| JSON spawn tables | Hardcoded depth ranges in code | JSON tables are tunable without rebuilds; easier balancing iteration |

## Architecture Patterns

### Recommended Project Structure

Phase 11 fits into existing architecture without new directories:

```
src/
├── shared/
│   ├── components/
│   │   ├── ai-state.ts              # EXTEND (add behaviorType field)
│   │   ├── pack-member.ts           # NEW (packId for Buffer-Overflow)
│   │   ├── dead-zone.ts             # NEW (tile DoT marker for Fragmenter)
│   │   └── corruption-state.ts      # NEW (Seed_Eater corruption tracking)
├── game/
│   ├── systems/
│   │   ├── ai.ts                    # REFACTOR (add behaviorType dispatch)
│   │   ├── pack-coordinator.ts      # NEW (Buffer-Overflow pack logic)
│   │   ├── tile-corruption.ts       # NEW (Seed_Eater tile mutations)
│   │   └── run-ender.ts             # NEW (System_Admin instant-death check)
│   ├── entities/templates/
│   │   ├── null-pointer.json        # NEW (Tier 1 teleporter)
│   │   ├── buffer-overflow.json     # NEW (Tier 1 pack enemy)
│   │   ├── fragmenter.json          # NEW (Tier 2 Dead Zone creator)
│   │   ├── logic-leaker.json        # NEW (Tier 2 ranged attacker)
│   │   ├── system-admin.json        # NEW (Tier 3 stalker)
│   │   ├── seed-eater.json          # NEW (Tier 3 corruptor)
│   │   └── spawn-tables/
│   │       └── depth-distribution.json  # NEW (depth → enemy weights)
│   └── generation/
│       └── entity-placement.ts      # EXTEND (read spawn tables)
├── rendering/
│   ├── filters/
│   │   ├── glitch-effects.ts        # NEW (damage distortion)
│   │   └── death-effects.ts         # NEW (per-type death animations)
│   └── animations.ts                # EXTEND (new animation types)
```

### Pattern 1: BehaviorType Dispatch

**What:** Single AI system dispatches to per-type handlers based on AIState.behaviorType field. Keeps base state machine (IDLE/CHASING/ATTACKING) while enabling unique behaviors.

**When to use:** Any system with multiple entity types sharing common logic but requiring type-specific variations.

**Example:**
```typescript
// Source: Extension of src/game/systems/ai.ts

export enum AIBehaviorType {
  BASIC = 'basic',              // Existing goblin AI
  NULL_POINTER = 'null_pointer',
  BUFFER_OVERFLOW = 'buffer_overflow',
  FRAGMENTER = 'fragmenter',
  LOGIC_LEAKER = 'logic_leaker',
  SYSTEM_ADMIN = 'system_admin',
  SEED_EATER = 'seed_eater',
}

// Extended AIState component schema
export const AIState = defineComponent('aiState', z.object({
  behavior: z.nativeEnum(AIBehavior).default(AIBehavior.IDLE),
  sightRadius: z.number().int().positive().default(6),
  behaviorType: z.nativeEnum(AIBehaviorType).default(AIBehaviorType.BASIC), // NEW
}));

// In createAISystem:
processEnemyTurn(entityId: EntityId): void {
  const ai = world.getComponent(entityId, AIState);
  if (!ai) return;

  // Dispatch to type-specific handler
  switch (ai.behaviorType) {
    case AIBehaviorType.NULL_POINTER:
      this.processNullPointerTurn(entityId);
      break;
    case AIBehaviorType.BUFFER_OVERFLOW:
      this.processBufferOverflowTurn(entityId);
      break;
    case AIBehaviorType.FRAGMENTER:
      this.processFragmenterTurn(entityId);
      break;
    case AIBehaviorType.LOGIC_LEAKER:
      this.processLogicLeakerTurn(entityId);
      break;
    case AIBehaviorType.SYSTEM_ADMIN:
      this.processSystemAdminTurn(entityId);
      break;
    case AIBehaviorType.SEED_EATER:
      this.processSeedEaterTurn(entityId);
      break;
    default:
      this.processBasicTurn(entityId); // Existing logic
  }
}

// Type-specific handler example:
private processNullPointerTurn(entityId: EntityId): void {
  const pos = world.getComponent(entityId, Position);
  const player = this.findPlayerEntity();
  if (!pos || !player) return;

  // Null-Pointer logic: teleport behind player if in range and visible
  const distance = Math.abs(player.x - pos.x) + Math.abs(player.y - pos.y);
  if (distance <= 8 && this.canSeePlayer(entityId)) {
    this.teleportBehindPlayer(entityId, player.x, player.y);
  } else {
    // Fall back to base CHASING behavior
    this.processBasicTurn(entityId);
  }
}
```

### Pattern 2: Pack Coordination

**What:** Multiple entities share a packId and coordinate movement to surround the player. Pack leader (lowest entity ID) determines direction, followers position relative to leader.

**When to use:** Swarm/pack enemies that need coordinated behavior without central controller.

**Example:**
```typescript
// Source: New component src/shared/components/pack-member.ts

export const PackMember = defineComponent('packMember', z.object({
  packId: z.string(),
  isLeader: z.boolean().default(false),
}));

// In pack-coordinator.ts system:
export function createPackCoordinatorSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
) {
  // Find all pack members for a given pack ID
  function getPackMembers(packId: string): EntityId[] {
    return world.query(PackMember, Position)
      .filter(id => {
        const pack = world.getComponent(id, PackMember);
        return pack?.packId === packId;
      });
  }

  // Check detonation proximity (D-05)
  function checkDetonationTrigger(packId: string, playerPos: Position): void {
    const members = getPackMembers(packId);
    const adjacentCount = members.filter(id => {
      const pos = world.getComponent(id, Position);
      if (!pos) return false;
      return Math.abs(pos.x - playerPos.x) <= 1 && Math.abs(pos.y - playerPos.y) <= 1;
    }).length;

    if (adjacentCount >= 3) {
      // Trigger detonation for all adjacent members
      for (const id of members) {
        const pos = world.getComponent(id, Position);
        if (!pos) continue;
        if (Math.abs(pos.x - playerPos.x) <= 1 && Math.abs(pos.y - playerPos.y) <= 1) {
          eventBus.emit('PACK_DETONATION', { entityId: id, x: pos.x, y: pos.y });
        }
      }
    }
  }

  return {
    init() {
      // Check detonation conditions after each entity move
      eventBus.on('ENTITY_MOVED', (payload) => {
        const pack = world.getComponent(payload.entityId, PackMember);
        if (pack) {
          const player = findPlayerEntity(world);
          if (player) {
            checkDetonationTrigger(pack.packId, player);
          }
        }
      });
    },
    dispose() {}
  };
}
```

### Pattern 3: Tile Corruption Spread

**What:** Seed_Eater corrupts tiles in a spreading pattern, pushing entities to safe tiles. Simpler than full dungeon regeneration, creates dynamic battlefield changes.

**When to use:** Environmental hazards that grow over time, forcing player repositioning.

**Example:**
```typescript
// Source: New system src/game/systems/tile-corruption.ts

interface CorruptionState {
  corruptedTiles: Set<string>;
  corruptionWave: number;
}

export function createTileCorruptionSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
) {
  const corruptionStates = new Map<EntityId, CorruptionState>();

  function spreadCorruption(seedEaterId: EntityId): void {
    const state = corruptionStates.get(seedEaterId);
    const pos = world.getComponent(seedEaterId, Position);
    if (!state || !pos) return;

    // Spread in wave pattern (BFS from seed eater position)
    const candidates = getAdjacentTiles(pos.x, pos.y, state.corruptionWave);
    const toCorrupt = candidates.filter(tile => !state.corruptedTiles.has(`${tile.x},${tile.y}`));

    for (const tile of toCorrupt.slice(0, 2)) { // Corrupt 2 tiles per turn
      const currentType = grid.getTileType(tile.x, tile.y);
      const newType = currentType === 'floor' ? 'wall' : 'floor'; // Flip tile type

      grid.setTileType(tile.x, tile.y, newType);
      state.corruptedTiles.add(`${tile.x},${tile.y}`);

      // Push entities on corrupted tiles (D-21)
      if (newType === 'wall') {
        const entitiesHere = grid.getEntitiesAt(tile.x, tile.y);
        for (const eid of entitiesHere) {
          if (eid === seedEaterId) continue; // Seed_Eater immune
          const safePos = findNearestWalkable(grid, tile.x, tile.y);
          if (safePos) {
            const entityPos = world.getComponent(eid, Position);
            if (entityPos) {
              grid.moveEntity(eid, entityPos.x, entityPos.y, safePos.x, safePos.y);
              entityPos.x = safePos.x;
              entityPos.y = safePos.y;
              eventBus.emit('ENTITY_DISPLACED', { entityId: eid, fromX: tile.x, fromY: tile.y, toX: safePos.x, toY: safePos.y });
            }
          }
        }
      }
    }

    state.corruptionWave++;
  }

  return {
    init() {
      eventBus.on('ENTITY_CREATED', (payload) => {
        const ai = world.getComponent(payload.entityId, AIState);
        if (ai?.behaviorType === AIBehaviorType.SEED_EATER) {
          corruptionStates.set(payload.entityId, {
            corruptedTiles: new Set(),
            corruptionWave: 1,
          });
        }
      });

      eventBus.on('TURN_END', () => {
        // Spread corruption for all active Seed_Eaters
        for (const [seedEaterId] of corruptionStates) {
          if (world.entityExists(seedEaterId)) {
            spreadCorruption(seedEaterId);
          }
        }
      });
    },
    dispose() {}
  };
}
```

### Pattern 4: PixiJS Filter Application

**What:** Apply visual effects to individual sprites using pixi-filters. Effects layer on top of sprite without modifying base rendering logic.

**When to use:** Temporary visual effects (damage feedback, death animations, persistent glitch aesthetic).

**Example:**
```typescript
// Source: New file src/rendering/filters/glitch-effects.ts
import { GlitchFilter, RGBSplitFilter, DisplacementFilter } from 'pixi-filters';
import { Sprite } from 'pixi.js';

export function applyDamageGlitch(sprite: Sprite, duration: number = 200): void {
  // Horizontal tear displacement (D-11)
  const glitch = new GlitchFilter({
    slices: 5,
    offset: 20,
    direction: 0, // Horizontal
    fillMode: 0,
  });

  const rgbSplit = new RGBSplitFilter([2, 0], [0, 2], [0, 0]);

  sprite.filters = [glitch, rgbSplit];

  // Remove filters after duration
  setTimeout(() => {
    if (!sprite.destroyed) {
      sprite.filters = null;
    }
  }, duration);
}

export function applyPersistentGlitch(sprite: Sprite, behaviorType: AIBehaviorType): void {
  // Persistent subtle glitch for enemy aesthetic (ENEMY-01)
  const filters = [];

  switch (behaviorType) {
    case AIBehaviorType.NULL_POINTER:
      // Flickering displacement
      filters.push(new DisplacementFilter({ scale: 5 }));
      break;
    case AIBehaviorType.BUFFER_OVERFLOW:
      // RGB split
      filters.push(new RGBSplitFilter([1, 0], [0, 1], [0, 0]));
      break;
    case AIBehaviorType.SYSTEM_ADMIN:
      // Heavy static
      filters.push(new GlitchFilter({ slices: 10, offset: 10 }));
      break;
    default:
      // Light glitch for all enemies
      filters.push(new RGBSplitFilter([0.5, 0], [0, 0.5], [0, 0]));
  }

  sprite.filters = filters;
}

// In render-system.ts handleEntityCreated:
const handleEntityCreated = (payload: { entityId: EntityId }) => {
  const spriteComp = world.getComponent(payload.entityId, SpriteComponent);
  const ai = world.getComponent(payload.entityId, AIState);
  if (spriteComp) {
    const sprite = createEntitySprite(payload.entityId, spriteComp.key, layers.entityLayer);
    if (ai?.behaviorType) {
      applyPersistentGlitch(sprite, ai.behaviorType);
    }
  }
};
```

### Anti-Patterns to Avoid

- **Global AI state:** Don't store pack coordination or corruption state in a singleton. Use ECS components and per-system state maps. Keeps state serializable and testable.
- **Blocking teleportation:** Don't check if teleport destination is walkable for Null-Pointer. Allow teleporting into walls briefly, then snap to nearest valid tile. Creates more dynamic "glitch" feel.
- **Health-based invulnerability:** Don't give System_Admin 9999 HP to simulate invulnerability. Remove Health component entirely. Cleaner implementation, forces proper special-case handling.
- **Hardcoded spawn weights:** Don't embed depth ranges in code. Use JSON spawn tables. Enables rapid balancing iteration without rebuilds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sprite visual effects | Custom WebGL shaders from scratch | pixi-filters package | 40+ production-tested filters; GlitchFilter, DisplacementFilter, RGBSplitFilter cover all needs; maintained by PixiJS team |
| Pathfinding for AI movement | Breadth-first search or custom A* | rot-js AStar (already integrated) | Battle-tested implementation; handles 4-way and 8-way topology; existing AI system uses it |
| Coordinated movement | Central "swarm controller" entity | Component-based pack membership with leader election | Simpler to serialize, no special controller lifecycle, packs can split/merge dynamically |
| Tile corruption | Full BSP dungeon regeneration | Incremental tile flipping with spread pattern | Orders of magnitude faster; no entity repositioning bugs; more predictable for player |
| Death effects | Frame-by-frame sprite animations | PixiJS filter combinations + particle systems | Filters are GPU-accelerated; easier to author; smaller asset size than sprite sheets |

**Key insight:** The existing ECS + event-driven architecture makes complex AI behaviors composable. Don't create monolithic AI classes — combine small components (PackMember, AIState.behaviorType, StatusEffects) with event listeners. Each system handles one concern, complexity emerges from interactions.

## Common Pitfalls

### Pitfall 1: Pack Detonation Timing

**What goes wrong:** Buffer-Overflow detonations fire multiple times per turn if checked after every movement, causing repeated damage and killing the player unfairly.

**Why it happens:** Pack coordinator checks detonation conditions on ENTITY_MOVED event. When multiple pack members move toward player in one turn cycle, each triggers the check.

**How to avoid:** Track detonations per turn with a Set of pack IDs that have already detonated. Clear the Set on TURN_END. Check the Set before triggering detonation.

**Warning signs:** Player takes 3-4x expected damage from pack explosions. Multiple "Buffer-Overflow detonated" messages in a single turn.

### Pitfall 2: Seed_Eater Tile Corruption Softlock

**What goes wrong:** Player gets trapped when tiles around them all corrupt to walls. Game becomes unwinnable but doesn't end.

**Why it happens:** Corruption algorithm doesn't reserve a safe zone around player. All adjacent tiles can corrupt simultaneously.

**How to avoid:** Before corrupting a tile, check if it would trap any entity. If corrupting creates a no-walkable-neighbors situation, skip that tile or push entity first (D-21 entity displacement).

**Warning signs:** Player position surrounded by walls with no escape. Movement commands do nothing.

### Pitfall 3: System_Admin Instant Death on Spawn

**What goes wrong:** System_Admin spawns adjacent to player and immediately ends run before player can react.

**Why it happens:** Entity placement doesn't account for special adjacency rules. System_Admin spawned in same room as player.

**How to avoid:** Add placement constraint: System_Admin must spawn at least 10 tiles from player (Manhattan distance). Check in entity-placement.ts before finalizing spawn position.

**Warning signs:** Run ends on floor load with "FATAL: ADMIN_CONTACT" message. Player has no opportunity to move.

### Pitfall 4: Logic-Leaker Infinite Kiting

**What goes wrong:** Logic-Leaker moves away from player every turn, never attacking. Player can't catch it.

**Why it happens:** Kiting logic doesn't have a minimum range threshold. Enemy always tries to maximize distance.

**How to avoid:** Set attack range (e.g., 3-6 tiles) and kite range (e.g., < 3 tiles). Enemy only kites if player is inside kite range. Between 3-6 tiles, it attacks.

**Warning signs:** Chase sequences that last 20+ turns with no combat. Enemy always stays exactly out of player reach.

### Pitfall 5: Filter Performance Degradation

**What goes wrong:** Game FPS drops to 10-20 when 10+ enemies are on screen, all with persistent glitch filters.

**Why it happens:** PixiJS filters are GPU-intensive. Too many filter instances running simultaneously.

**How to avoid:** Limit persistent filters to 1-2 per sprite (RGB split + light glitch). Use heavier filters (GlitchFilter with high slices) only for temporary effects (damage, death). Disable filters on sprites outside FOV.

**Warning signs:** Browser DevTools Performance profile shows heavy GPU usage. FPS drops correlate with enemy count.

### Pitfall 6: Null-Pointer Teleport into Walls

**What goes wrong:** Null-Pointer teleports into solid walls and becomes stuck, breaks pathfinding.

**Why it happens:** "Behind player" calculation doesn't validate walkability of destination tile.

**How to avoid:** After calculating target position, raycast from player position in direction away from player. Find first walkable tile. If none found within range, don't teleport.

**Warning signs:** Null-Pointer sprite renders inside wall tiles. Enemy stops moving and doesn't attack.

## Code Examples

Verified patterns from existing codebase:

### Extending AIState Component

```typescript
// Source: src/shared/components/ai-state.ts (EXTENDED)
import { z } from 'zod';
import { defineComponent, ComponentData } from '@engine/ecs/types';

export enum AIBehavior {
  IDLE = 'idle',
  CHASING = 'chasing',
  ATTACKING = 'attacking'
}

export enum AIBehaviorType {
  BASIC = 'basic',
  NULL_POINTER = 'null_pointer',
  BUFFER_OVERFLOW = 'buffer_overflow',
  FRAGMENTER = 'fragmenter',
  LOGIC_LEAKER = 'logic_leaker',
  SYSTEM_ADMIN = 'system_admin',
  SEED_EATER = 'seed_eater',
}

export const AIState = defineComponent('aiState', z.object({
  behavior: z.nativeEnum(AIBehavior).default(AIBehavior.IDLE),
  sightRadius: z.number().int().positive().default(6),
  behaviorType: z.nativeEnum(AIBehaviorType).default(AIBehaviorType.BASIC), // NEW FIELD
}));

export type AIStateData = ComponentData<typeof AIState>;
```

### Spawning Pack Enemies Together

```typescript
// Source: src/game/generation/entity-placement.ts (EXTENDED)

// In placeEntities function, after line 80:
for (const room of rooms) {
  if (room === spawnRoom) continue;

  // Check if this room should spawn a pack (D-06)
  const spawnPack = rng.random() < 0.3 && enemyCount >= 5; // 30% chance

  if (spawnPack) {
    // Spawn Buffer-Overflow pack
    const packId = `pack-${room.x}-${room.y}`;
    const packSize = randomIntRange(rng, 5, 8);
    const positions = getWalkablePositions(grid, room);

    for (let i = 0; i < packSize && positions.length > 0; i++) {
      const posIdx = Math.floor(rng.random() * positions.length);
      const pos = positions.splice(posIdx, 1)[0];

      const enemyId = factory.create(world, 'buffer-overflow', componentRegistry, {
        position: { x: pos.x, y: pos.y },
        packMember: { packId, isLeader: i === 0 }, // First spawned is leader
      });

      grid.addEntity(enemyId, pos.x, pos.y);
      enemyIds.push(enemyId);
    }
  } else {
    // Normal enemy spawning logic
    const enemyCount = randomIntRange(rng, cfg.enemiesPerRoom.min, cfg.enemiesPerRoom.max);
    // ... existing spawn code
  }
}
```

### JSON Enemy Template (Null-Pointer)

```json
// Source: src/game/entities/templates/null-pointer.json (NEW)
{
  "name": "null-pointer",
  "mixins": ["physical", "combatant"],
  "components": {
    "actor": { "isPlayer": false },
    "energy": { "current": 0, "speed": 120, "threshold": 1000 },
    "sprite": { "key": "enemy_null_pointer" },
    "hostile": {},
    "aiState": {
      "behavior": "idle",
      "sightRadius": 8,
      "behaviorType": "null_pointer"
    },
    "fovAwareness": { "canSeePlayer": false },
    "blocksMovement": {},
    "lootTable": {
      "drops": [
        { "template": "bleed-v0", "chance": 0.4 },
        { "template": "health_potion", "chance": 0.2 }
      ]
    }
  },
  "overrides": {
    "health": { "current": 6, "max": 6 },
    "attack": { "power": 4 },
    "defense": { "armor": 0 }
  }
}
```

### Depth-Based Spawn Table

```json
// Source: src/game/entities/templates/spawn-tables/depth-distribution.json (NEW)
{
  "tables": [
    {
      "depthRange": { "min": 1, "max": 5 },
      "enemiesPerRoom": { "min": 1, "max": 2 },
      "templates": [
        { "name": "null-pointer", "weight": 50 },
        { "name": "buffer-overflow-pack", "weight": 30 },
        { "name": "goblin", "weight": 20 }
      ]
    },
    {
      "depthRange": { "min": 5, "max": 10 },
      "enemiesPerRoom": { "min": 2, "max": 3 },
      "templates": [
        { "name": "null-pointer", "weight": 30 },
        { "name": "buffer-overflow-pack", "weight": 20 },
        { "name": "fragmenter", "weight": 30 },
        { "name": "logic-leaker", "weight": 20 }
      ]
    },
    {
      "depthRange": { "min": 10, "max": 15 },
      "enemiesPerRoom": { "min": 2, "max": 4 },
      "templates": [
        { "name": "fragmenter", "weight": 30 },
        { "name": "logic-leaker", "weight": 25 },
        { "name": "system-admin", "weight": 5 },
        { "name": "seed-eater", "weight": 10 },
        { "name": "null-pointer", "weight": 20 },
        { "name": "buffer-overflow-pack", "weight": 10 }
      ]
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate AI system per enemy | BehaviorType dispatch in single AI system | Modern roguelikes (2020+) | Easier maintenance, JSON-configurable behavior selection, less code duplication |
| Frame-by-frame sprite animations | GPU-accelerated shader filters | PixiJS v5+ (2019) | Smaller asset sizes, dynamic effects, no pre-rendered animation sheets needed |
| Global turn processing | Energy-based actor priority | Roguelike standard since 1990s | Natural speed variation, slow/fast enemies without special timing code |
| Pack AI via leader commands | Component-based membership with emergent coordination | ECS patterns (2015+) | No central controller entity, easier serialization, self-organizing behavior |

**Deprecated/outdated:**
- **Hardcoded AI state machines:** Modern approach uses data-driven behavior trees or dispatch tables. Hardcoding limits modding and iteration speed.
- **Health bars on invulnerable enemies:** Earlier games showed crossed-out health bars. Current standard: omit Health component entirely for truly invulnerable entities.
- **Tile-based sprite animations:** Pre-shader era required sprite sheets. Filters are now standard for visual effects.

## Open Questions

1. **Null-Pointer teleport "behind" algorithm specifics**
   - What we know: Instant reposition, appears behind player, simple position update (D-07)
   - What's unclear: How to define "behind" on grid? Opposite direction from player's last move? Furthest tile from player facing?
   - Recommendation: Calculate vector from player to Null-Pointer, reverse it, find walkable tile at ~3-5 tile distance along that vector. Fallback: random adjacent tile if no valid position.

2. **System_Admin stun mechanics**
   - What we know: Stun pauses movement for N turns (D-16), but what can stun?
   - What's unclear: Any Firmware? Only specific types? Status effect or special interaction?
   - Recommendation: Add DISRUPT status effect applicable by any Firmware. System_Admin checks for DISRUPT at turn start, skips turn if active. Gives player universal counterplay tool.

3. **Filter performance at scale**
   - What we know: pixi-filters are GPU-intensive; need to limit per-sprite filter complexity
   - What's unclear: Exact performance budget for target hardware (desktop browsers)
   - Recommendation: Benchmark with 20+ filtered sprites on screen. If FPS drops below 60, reduce filter complexity or disable on off-screen sprites. Use simpler filters (RGBSplitFilter) for persistent effects, heavier filters (GlitchFilter) only on-damage.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts (exists) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENEMY-01 | Enemies have glitch visual effects | integration | `npm test src/rendering/__tests__/glitch-effects.test.ts -x` | ❌ Wave 0 |
| ENEMY-02 | Damage causes visual feedback | integration | `npm test src/rendering/__tests__/damage-effects.test.ts -x` | ❌ Wave 0 |
| ENEMY-03 | Null-Pointer teleports and applies HUD_GLITCH | unit | `npm test src/game/systems/__tests__/ai-null-pointer.test.ts -x` | ❌ Wave 0 |
| ENEMY-04 | Buffer-Overflow pack coordination and detonation | unit | `npm test src/game/systems/__tests__/pack-coordinator.test.ts -x` | ❌ Wave 0 |
| ENEMY-05 | Fragmenter creates Dead Zone tiles | unit | `npm test src/game/systems/__tests__/fragmenter.test.ts -x` | ❌ Wave 0 |
| ENEMY-06 | Logic-Leaker ranged attacks and Firmware lock | unit | `npm test src/game/systems/__tests__/logic-leaker.test.ts -x` | ❌ Wave 0 |
| ENEMY-07 | System_Admin stalking and instant run-end | integration | `npm test src/game/systems/__tests__/system-admin.test.ts -x` | ❌ Wave 0 |
| ENEMY-08 | Seed_Eater tile corruption and spawning | integration | `npm test src/game/systems/__tests__/seed-eater.test.ts -x` | ❌ Wave 0 |
| ENEMY-09 | Depth-based enemy distribution | unit | `npm test src/game/generation/__tests__/depth-spawn.test.ts -x` | ❌ Wave 0 |
| ENEMY-10 | Per-type unique death effects | integration | `npm test src/rendering/__tests__/death-effects.test.ts -x` | ❌ Wave 0 |
| ENEMY-11 | Enemy data in JSON templates | unit | `npm test src/game/entities/__tests__/enemy-templates.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run` (run all tests, no watch)
- **Per wave merge:** `npm test` (full suite with coverage)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/rendering/__tests__/glitch-effects.test.ts` — covers ENEMY-01, ENEMY-02 (filter application, damage feedback)
- [ ] `src/game/systems/__tests__/ai-behavior-dispatch.test.ts` — covers behaviorType dispatch pattern
- [ ] `src/game/systems/__tests__/pack-coordinator.test.ts` — covers ENEMY-04 (pack detonation triggers)
- [ ] `src/game/systems/__tests__/tile-corruption.test.ts` — covers ENEMY-08 (Seed_Eater corruption spread)
- [ ] `src/game/generation/__tests__/spawn-tables.test.ts` — covers ENEMY-09 (depth distribution loading)
- [ ] `src/game/entities/__tests__/enemy-template-validation.test.ts` — covers ENEMY-11 (schema validation for all 6 templates)

## Sources

### Primary (HIGH confidence)
- pixi-filters GitHub README (https://github.com/pixijs/filters) - Installation, filter list, compatibility matrix
- Existing codebase: src/game/systems/ai.ts, src/shared/components/ai-state.ts, src/game/entities/templates/goblin.json - Established AI patterns, component schemas, JSON template structure
- Phase 9 RESEARCH.md - StatusEffects system architecture, event-driven trigger patterns
- Phase 10 RESEARCH.md - Modifier list damage pipeline, DoT effect implementation via StatusEffects

### Secondary (MEDIUM confidence)
- pixi-filters package search results - Version 6.1.5 published 2025-11-29, filter names (GlitchFilter, DisplacementFilter, RGBSplitFilter, CRTFilter)

### Tertiary (LOW confidence)
- None — all findings verified against primary sources or existing code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pixi-filters verified via npm search and GitHub, version compatibility confirmed
- Architecture: HIGH - All patterns extend existing systems (AI, StatusEffects, EntityFactory, Grid)
- Pitfalls: MEDIUM - Based on common ECS/roguelike patterns and existing codebase insights; specific edge cases require implementation testing
- Visual effects: MEDIUM - Filter capabilities verified, but exact performance characteristics need benchmarking

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days for stable stack, pixi-filters is mature package)
