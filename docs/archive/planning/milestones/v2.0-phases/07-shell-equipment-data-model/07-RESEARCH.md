# Phase 7: Shell & Equipment Data Model — Research

**Researched:** 2026-03-29
**Phase Goal:** Equipment system data backbone works end-to-end — Shells with stats, Ports, and Loadouts can be created, configured, and persisted
**Requirement IDs:** SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, SHELL-07

---

## 1. Existing ECS Patterns (Source of Truth)

### Component Definition Pattern

Every component follows a strict pattern in `src/shared/components/`:

```typescript
// src/shared/components/health.ts (canonical example)
import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const Health = defineComponent('health', z.object({
  current: z.number().int().min(0),
  max: z.number().int().positive(),
}));

export type HealthData = z.infer<typeof Health.schema>;
```

**Rules observed:**
- Import `z` from `'zod'` and `defineComponent` from `'@engine/ecs/types'`
- `defineComponent(key, zodSchema)` returns `ComponentDef<T>` with `.key` and `.schema`
- Export const component + exported type alias via `z.infer<typeof X.schema>`
- One component per file, kebab-case filename
- Some files use `@engine/` alias, some use relative `../../engine/` — either works but `@engine/` is preferred per conventions

### Component Registration Pattern

All components barrel-exported in `src/shared/components/index.ts`:

```typescript
export const COMPONENTS_REGISTRY = [
  Position, Health, Energy, Actor, SpriteComponent,
  Hostile, Attack, Defense, LootTable, AIState,
  FovAwareness, BlocksMovement, Item, PickupEffect, Progression
] as const;

export * from './health';
// ... one re-export per component
```

**Key:** New components MUST be added to both `COMPONENTS_REGISTRY` array AND re-exported. The array is iterated in `engine-factory.ts` to build the `ComponentRegistry` used by `EntityFactory`.

### Entity Template Pattern (JSON)

Templates are JSON files in `src/game/entities/templates/`:

```json
// player.json
{
  "name": "player",
  "mixins": ["physical", "combatant"],
  "components": {
    "actor": { "isPlayer": true },
    "energy": { "current": 1000, "speed": 100, "threshold": 1000 },
    "sprite": { "key": "player" }
  },
  "overrides": {
    "health": { "current": 20, "max": 20 },
    "attack": { "power": 5 },
    "defense": { "armor": 2 }
  }
}
```

**`RawTemplate` interface** (`src/engine/entity/types.ts`):
- `name: string` — unique template identifier
- `components: Record<string, unknown>` — component data keyed by component key
- `mixins?: string[]` — optional mixin template names to inherit from
- `overrides?: Record<string, Record<string, unknown>>` — deep-merge on top of mixin components

**Mixin resolution** (`src/engine/entity/builder.ts`):
- `resolveMixins()` recursively resolves mixins (max depth 3)
- Conflicting components across two mixins throw an error
- Overrides deep-merge onto resolved components
- `buildEntity()` validates each component via `def.schema.safeParse(data)` and stamps into World

### Entity Registration Pattern

`src/game/entities/index.ts` imports JSON templates and registers them:

```typescript
import player from './templates/player.json';
registry.register(player as unknown as RawTemplate);
```

The `as unknown as RawTemplate` cast is needed because JSON imports don't match the TS interface perfectly.

### EntityFactory Usage

`EntityFactory.create()` takes:
- `world: World<T>` — target ECS world
- `templateName: string` — registered template name
- `componentRegistry: ComponentRegistry` — for validation
- `runtimeOverrides?: Record<string, Record<string, unknown>>` — optional overrides at spawn time

Runtime overrides are powerful — they let us stamp Shell-specific stats onto a player entity at run start without modifying the template.

---

## 2. Existing Combat Components

Shell stats need to seed these existing components:

| Shell Stat | Target Component | Target Field | Notes |
|-----------|-----------------|-------------|-------|
| Speed | `Energy` | `speed` | Higher speed = more energy/turn = more frequent turns |
| MaxHealth | `Health` | `max`, `current` | Seeded at run start |
| Armor | `Defense` | `armor` | Damage reduction |
| AttackPower | `Attack` | `power` | Base damage (may not be a Shell stat — comes from equipment) |

**Current player defaults** (from `player.json`):
- Health: 20/20
- Attack: 5
- Defense: 2
- Energy: speed=100, threshold=1000

**Per CONTEXT.md D-01:** `ShellComponent` seeds combat components at entity creation. Combat systems continue reading existing components — `ShellComponent` is NOT queried during combat.

**Per CONTEXT.md D-02:** Propagation from Shell→combat is event-driven via `SHELL_STATS_CHANGED`. Only fires when Shell state actually mutates (upgrades, equipment modifiers).

---

## 3. Event System Classification

Per AGENTS.md tier rules:

**"Does the server/pipeline need to emit or react to this event during authoritative action processing?"**

| Event | Tier | Rationale |
|-------|------|-----------|
| `SHELL_STATS_CHANGED` | **GameplayEvents** | Server computes stat propagation during equip/upgrade actions |
| `EQUIPMENT_CHANGED` | **GameplayEvents** | Equip/unequip is an authoritative action |
| `SHELL_SELECTED` | **GameplayEvents** | Shell selection affects run initialization (server-side) |
| `PLAYER_DIED` | Already exists as `ENTITY_DIED` | Reuse — no new event needed |

**Existing events used:**
- `ENTITY_DIED` (`GameplayEvents`) — equipment clearing listens to this
- `ENTITY_CREATED`, `COMPONENT_ADDED` (`EngineEvents`) — entity/component lifecycle

---

## 4. Architecture: Shell as Persistent Record

### The Two-Tier Model (CONTEXT.md D-06, D-07)

**Tier 1: Shell Record (persistent, lives outside World)**
- `ShellRegistry` — in-memory Map, pattern from `EntityRegistry`
- Contains Shell identity, archetype, base stats, port config, upgrade level
- Survives death, survives run boundaries
- Phase 7 uses in-memory storage that resets on page refresh
- Phase 13-14 adds real persistence

**Tier 2: Player Entity (ephemeral, lives in World)**
- Created at run start by stamping Shell data onto `Health`, `Energy`, `Defense`, `Attack`
- Equipment slot components attached to player entity
- Destroyed when run ends

### ShellRegistry Design

Based on `EntityRegistry` pattern (`src/engine/entity/registry.ts`):

```typescript
// Conceptual API
class ShellRegistry {
  private shells: Map<string, ShellRecord> = new Map();
  register(shell: ShellRecord): void;
  get(id: string): ShellRecord | undefined;
  has(id: string): boolean;
  getAll(): ShellRecord[];
  update(id: string, updates: Partial<ShellRecord>): void; // extension over EntityRegistry
}
```

**ShellRecord** contains:
- `id: string` — unique identifier
- `archetypeId: string` — references a Shell archetype template
- `level: number` — upgrade level (1-5)
- `currentStats: ShellStats` — computed from base + upgrade bonuses
- `portConfig: PortConfig` — current max slots (may grow with upgrades)

### Shell vs Player Entity Flow

```
[ShellRegistry] --select--> [ShellRecord]
                                |
                 run start      |  stamp stats as runtimeOverrides
                                v
                [EntityFactory.create('player', overrides)]
                                |
                                v
              [Player Entity in World with Health/Energy/Defense/etc]
                                |
                 run end        |  write back upgrade progress
                                v
                         [ShellRegistry]
```

---

## 5. Equipment Slot Architecture

### Per CONTEXT.md D-03: Separate Components Per Slot Type

```
FirmwareSlots  → { equipped: EntityId[] }   // Phases 8+
AugmentSlots   → { equipped: EntityId[] }   // Phases 9+
SoftwareSlots  → { equipped: EntityId[] }   // Phases 10+
```

**Phase 7 creates the shell of these components** (pun intended) — they exist as empty arrays on the player entity. Phases 8-10 each populate their respective slot type.

**PortConfigComponent** — source of truth for slot limits:
```
{ maxFirmware: number, maxAugment: number, maxSoftware: number }
```

### Per CONTEXT.md D-04: Business Rule Enforcement

Slot limits are NOT enforced by Zod schema (can't express "array length ≤ N" dynamically). Instead, the equip system checks:

```typescript
if (firmwareSlots.equipped.length >= portConfig.maxFirmware) {
  // Return error through action pipeline
}
```

### Per CONTEXT.md D-05: Event-Driven Equipment Clearing

Each slot system independently listens for `ENTITY_DIED`:
```typescript
eventBus.on('ENTITY_DIED', ({ entityId }) => {
  // Clear FirmwareSlots for this entity
  // Clear AugmentSlots for this entity
  // Clear SoftwareSlots for this entity
});
```

Phase 7 wires the clearing for FirmwareSlots, AugmentSlots, SoftwareSlots — even though Phases 8-10 define what goes IN them.

---

## 6. Shell Upgrade Model (CONTEXT.md D-08, D-09)

### Tier/Level System

Each Shell has levels 1-5. Each level grants a predefined stat bump and/or Port expansion:

```json
{
  "upgrades": [
    { "level": 2, "stats": { "speed": 5 }, "ports": {} },
    { "level": 3, "stats": {}, "ports": { "firmware": 1 } },
    { "level": 4, "stats": { "armor": 1, "maxHealth": 5 }, "ports": {} },
    { "level": 5, "stats": { "speed": 5 }, "ports": { "augment": 1 } }
  ]
}
```

### Upgrade Action Flow

1. Client sends `{ type: 'UPGRADE_SHELL', shellId: string }` action
2. Server validates: correct currency (stubbed in Phase 7), not at max level
3. Server mutates `ShellRecord` in `ShellRegistry` — bumps level, applies stat/port bonuses
4. Server emits `SHELL_STATS_CHANGED` — propagation handler updates combat components if entity is active
5. Returns state delta

---

## 7. Shell JSON Template Design

### Proposed Template Structure

Shell archetypes are JSON templates, but they are NOT entity templates in the `EntityRegistry` sense — they define Shell records, not ECS entities. They should live in their own directory:

```
src/game/shells/templates/
  striker-v1.json
  bastion-v1.json
  signal-v1.json
```

Or alternatively, they could be Shell entity templates that get registered alongside other templates. The key question is: **do Shell templates go through `EntityFactory`?**

**Analysis:**
- Shell records are NOT entities in the World during the between-run phase
- Shell data is STAMPED onto a player entity at run start
- Shell templates define the archetype data (base stats, ports, upgrades), not ECS components directly

**Recommendation:** Shell templates are standalone JSON files parsed by `ShellRegistry`. They are NOT `RawTemplate` objects. This avoids confusing Shell records (persistent) with ECS entities (ephemeral). The `ShellRegistry` has its own Zod schema for validation.

However, at run start, the Shell's stats are used as `runtimeOverrides` when calling `entityFactory.create('player', componentRegistry, shellOverrides)` — this reuses the existing template composition pipeline.

---

## 8. Action Pipeline Integration

### New Action Types Needed

```typescript
// Additions to ActionIntentSchema in src/shared/types.ts
const EquipActionSchema = z.object({
  type: z.literal('EQUIP'),
  shellId: z.string(),
  slotType: z.enum(['firmware', 'augment', 'software']),
  itemEntityId: z.number(),
});

const UnequipActionSchema = z.object({
  type: z.literal('UNEQUIP'),
  slotType: z.enum(['firmware', 'augment', 'software']),
  slotIndex: z.number(),
});

const UpgradeShellActionSchema = z.object({
  type: z.literal('UPGRADE_SHELL'),
  shellId: z.string(),
});

const SelectShellActionSchema = z.object({
  type: z.literal('SELECT_SHELL'),
  shellId: z.string(),
});
```

These need to be added to the `ActionIntentSchema` discriminated union and handled in `pipeline.ts`'s `processAction` switch.

**Note:** Equip/unequip/upgrade actions are between-run actions. They happen at the Neural Deck (Phase 15), not during combat. The action pipeline currently processes MOVE/WAIT/PICKUP/ATTACK — all in-run actions. Between-run actions may need a separate pipeline or a mode flag.

**Phase 7 approach:** Add the action schemas now. Handle them in `processAction()` with a simple passthrough. The full between-run action flow comes in Phase 14-15 when the Neural Deck exists. For Phase 7, we can test equip/unequip/upgrade via direct API calls or test harnesses.

---

## 9. Integration Points Summary

### Files Modified

| File | Change |
|------|--------|
| `src/shared/components/index.ts` | Add new components to `COMPONENTS_REGISTRY` and re-exports |
| `src/shared/events/types.ts` | Add `SHELL_STATS_CHANGED`, `EQUIPMENT_CHANGED`, `SHELL_SELECTED` events |
| `src/game/entities/index.ts` | No change — Shell templates are not entity templates |
| `src/shared/types.ts` | Add EQUIP, UNEQUIP, UPGRADE_SHELL, SELECT_SHELL action schemas |
| `src/shared/pipeline.ts` | Add processAction cases for new action types |
| `src/game/setup.ts` | Accept Shell selection, stamp Shell data onto player entity |
| `src/game/engine-factory.ts` | Accept Shell data for player entity creation overrides |
| `src/app/api/action/route.ts` | Handle new action types |

### Files Created

| File | Purpose |
|------|---------|
| `src/shared/components/shell.ts` | ShellComponent definition |
| `src/shared/components/port-config.ts` | PortConfigComponent definition |
| `src/shared/components/firmware-slots.ts` | FirmwareSlots component (empty for Phase 7) |
| `src/shared/components/augment-slots.ts` | AugmentSlots component (empty for Phase 7) |
| `src/shared/components/software-slots.ts` | SoftwareSlots component (empty for Phase 7) |
| `src/game/shells/shell-registry.ts` | ShellRegistry class |
| `src/game/shells/types.ts` | ShellRecord, ShellStats, PortConfig types |
| `src/game/shells/templates/striker-v1.json` | Striker Shell archetype |
| `src/game/shells/templates/bastion-v1.json` | Bastion Shell archetype |
| `src/game/shells/templates/signal-v1.json` | Signal Shell archetype |
| `src/game/systems/shell-stats.ts` | Shell stat propagation system |
| `src/game/systems/equipment.ts` | Equip/unequip/upgrade logic |

---

## 10. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Shell templates conflated with entity templates | Medium | Keep separate: `ShellRegistry` for Shells, `EntityRegistry` for entities |
| runtime overrides too rigid for Shell→player mapping | Low | `EntityFactory.create()` already supports `runtimeOverrides` — tested with goblin/player |
| Equipment actions during combat (out of scope) | Low | Gate equip/unequip actions: only allowed when not in a run |
| Component count explosion (5 new components) | Low | All follow established one-file pattern, properly registered |
| ShellRegistry reset on page refresh | Expected | Phase 7 explicit decision (D-07): real persistence in Phase 13-14 |
| SHELL_STATS_CHANGED event ordering | Medium | Propagation handler must run BEFORE combat systems read stats. Use event-driven approach (run on event, not on tick) to avoid ordering issues |

---

## 11. Validation Architecture

### Unit Test Strategy

| Component/System | Test File | Key Assertions |
|-----------------|-----------|----------------|
| ShellComponent schema | `src/shared/components/__tests__/shell.test.ts` | Validates Zod parsing for valid/invalid Shell data |
| PortConfigComponent schema | `src/shared/components/__tests__/port-config.test.ts` | Validates slot counts are non-negative integers |
| ShellRegistry | `src/game/shells/__tests__/shell-registry.test.ts` | Register, get, update, getAll operations |
| Shell stat propagation | `src/game/systems/__tests__/shell-stats.test.ts` | Shell stats correctly seed Health/Energy/Defense; SHELL_STATS_CHANGED triggers recalc |
| Equipment system | `src/game/systems/__tests__/equipment.test.ts` | Equip within limits succeeds, over-limit fails, clearing on death works |
| Shell template loading | `src/game/shells/__tests__/template-loading.test.ts` | All 3 templates parse, produce valid ShellRecords |

### Integration Test Strategy

| Scenario | Test File | Flow |
|----------|-----------|------|
| Shell→Player stamp | `src/tests/integration/shell-to-player.test.ts` | Select Shell → create player entity → verify combat components match Shell stats |
| Upgrade pipeline | `src/tests/integration/shell-upgrade.test.ts` | Upgrade Shell → verify ShellRecord updated → verify combat components propagated |
| Death equipment clear | `src/tests/integration/death-equipment-clear.test.ts` | Equip items → kill player → verify slots cleared, Shell record survives |

---

## RESEARCH COMPLETE

**Key findings:**
1. The ECS component/template/factory pipeline is clean and extensible — Shell components follow established patterns exactly
2. Shell records (persistent) must be architecturally separate from ECS entities (ephemeral) — ShellRegistry is a new abstraction parallel to EntityRegistry
3. Five new components, two new systems, one new registry — moderate footprint
4. Three starter Shell templates as standalone JSON validated by Zod
5. SHELL_STATS_CHANGED belongs in GameplayEvents (server needs it for equip/upgrade actions)
6. Phase 7 action pipeline additions are forward-compatible with Phase 14-15's between-run action handling
