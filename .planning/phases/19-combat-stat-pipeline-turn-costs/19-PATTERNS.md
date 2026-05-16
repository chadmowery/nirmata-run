# Phase 19: Combat Stat Pipeline & Turn Costs - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/components/equipment-slots.ts` | component | CRUD | `src/shared/components/burned-software.ts` | exact |
| `src/shared/components/index.ts` | config | batch | self (existing) | self-update |
| `src/shared/components/intents.ts` | component | request-response | self (existing) | self-update |
| `src/shared/types.ts` | config | request-response | self (existing) | self-update |
| `src/shared/pipeline.ts` | utility | request-response | self (existing) | self-update |
| `src/game/systems/combat.ts` | system | request-response | self (existing) | self-update |
| `src/game/systems/equipment.ts` | system | CRUD | self (existing) | self-update |
| `src/game/systems/software-effects.ts` | utility | event-driven | self (existing, BurnedSoftware→EquipmentSlots migration) | self-update |
| `src/game/systems/run-ender.ts` | system | event-driven | self (existing, BurnedSoftware→EquipmentSlots migration) | self-update |
| `src/game/ui/sync-bridge.ts` | utility | event-driven | self (existing, BurnedSoftware→EquipmentSlots migration) | self-update |
| `src/game/engine-factory.ts` | config | CRUD | self (existing) | self-update |

---

## Pattern Assignments

### `src/shared/components/equipment-slots.ts` (NEW component, CRUD)

**Analog:** `src/shared/components/burned-software.ts`

This new file directly replaces `burned-software.ts`. The schema shape is identical — two nullable EntityId fields — but the component key and name change. Copy the entire structure from the analog.

**Full analog to copy** (`src/shared/components/burned-software.ts`, lines 1-18):
```typescript
import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const BurnedSoftware = defineComponent(
  'burnedSoftware',
  z.object({
    weapon: z.number().nullable().default(null),
    armor: z.number().nullable().default(null),
  }),
);

export type BurnedSoftwareData = z.infer<typeof BurnedSoftware.schema>;
```

**New file target pattern** — replace names, keep structure:
```typescript
import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const EquipmentSlots = defineComponent(
  'equipmentSlots',
  z.object({
    weapon: z.number().nullable().default(null),
    armor: z.number().nullable().default(null),
  }),
);

export type EquipmentSlotsData = z.infer<typeof EquipmentSlots.schema>;
```

**Also see** `src/shared/components/defense.ts` (lines 1-14) for the minimal single-field variant of this pattern and `src/shared/components/children.ts` for the Phase 18 style.

---

### `src/shared/components/index.ts` (MODIFIED config, batch)

**Analog:** self — perform a surgical swap.

**Pattern to follow** (lines 1-170):

1. **Import swap** (line 28 → replace):
   - Remove: `import { BurnedSoftware } from './burned-software';`
   - Add: `import { EquipmentSlots } from './equipment-slots';`

2. **Export swap** (line 80 → replace):
   - Remove: `export * from './burned-software';`
   - Add: `export * from './equipment-slots';`

3. **COMPONENTS_REGISTRY swap** (line 130 → replace):
   - Remove: `BurnedSoftware,` from the array
   - Add: `EquipmentSlots,` in the same position

**COMPONENTS_REGISTRY pattern** (lines 103-170) — the registry is a `as const` array of component definitions. Every new component that must survive serialization/deserialization MUST appear here. The order affects nothing functionally but keep it grouped with related components (near `Defense`, `Attack`):
```typescript
export const COMPONENTS_REGISTRY = [
  // ... existing entries ...
  EquipmentSlots,   // replaces BurnedSoftware
  // ... rest of intents ...
] as const;
```

---

### `src/shared/components/intents.ts` (MODIFIED component, request-response)

**Analog:** self — extend the `EquipIntent` and `UnequipIntent` Zod enums.

**Current EquipIntent** (lines 68-74):
```typescript
export const EquipIntent = defineComponent(
  'equipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment']),
    itemEntityId: z.number(),
  })
);
```

**Target pattern** — extend the enum (add `'weapon'` and `'armor'`):
```typescript
export const EquipIntent = defineComponent(
  'equipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment', 'weapon', 'armor']),
    itemEntityId: z.number(),
  })
);
```

**Current UnequipIntent** (lines 79-85) — extend identically:
```typescript
export const UnequipIntent = defineComponent(
  'unequipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment']),
    slotIndex: z.number(),
  })
);
```

**Target:**
```typescript
export const UnequipIntent = defineComponent(
  'unequipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment', 'weapon', 'armor']),
    slotIndex: z.number(),
  })
);
```

**Intent definition pattern** — all intents follow the same shape: `defineComponent('camelCaseKey', z.object({...}))` with a JSDoc comment. Copy any existing intent block as the structural template.

---

### `src/shared/types.ts` (MODIFIED config, request-response)

**Analog:** self — add new action schemas and register them in `ActionIntentSchema`.

**Existing EquipActionSchema** (lines 26-31) as the pattern to copy for new gear actions:
```typescript
export const EquipActionSchema = z.object({
  type: z.literal('EQUIP'),
  shellId: z.string(),
  slotType: z.enum(['firmware', 'augment', 'software']),
  itemEntityId: z.number(),
});
```

**New schemas to add** — copy the structure above, changing `type` literal and extending `slotType` enum to include `'weapon'` and `'armor'`, or add dedicated `EQUIP_WEAPON` / `EQUIP_ARMOR` action schemas if discrete routing is preferred (see RESEARCH.md D-04 guidance on naming):
```typescript
// Option A: extend existing EquipActionSchema slotType enum
export const EquipActionSchema = z.object({
  type: z.literal('EQUIP'),
  shellId: z.string(),
  slotType: z.enum(['firmware', 'augment', 'software', 'weapon', 'armor']),
  itemEntityId: z.number(),
});

// Option B: new discrete schemas (same shape as EquipActionSchema)
export const EquipGearActionSchema = z.object({
  type: z.literal('EQUIP_GEAR'),
  slotType: z.enum(['weapon', 'armor']),
  itemEntityId: z.number(),
});
```

**ActionIntentSchema registration pattern** (lines 104-122) — add new schemas to the `discriminatedUnion` array:
```typescript
export const ActionIntentSchema = z.discriminatedUnion('type', [
  MoveActionSchema,
  // ... existing ...
  EquipActionSchema,       // already present (or extended)
  UnequipActionSchema,     // already present (or extended)
  // ... rest ...
]);
```

---

### `src/shared/pipeline.ts` (MODIFIED utility, request-response)

**Analog:** self — follow the existing `case 'EQUIP':` pattern exactly.

**Existing EQUIP case** (lines 114-116) — the pattern to replicate:
```typescript
case 'EQUIP':
  world.addComponent(entityId, EquipIntent, { slotType: action.slotType, itemEntityId: action.itemEntityId });
  break;
case 'UNEQUIP':
  world.addComponent(entityId, UnequipIntent, { slotType: action.slotType, slotIndex: action.slotIndex });
  break;
```

If Option A (extend existing enum) is chosen, NO change is needed here — the existing cases already pass `slotType` through. If Option B (new action types) is chosen, add parallel cases following the same `world.addComponent(entityId, EquipIntent, {...})` pattern.

**Pipeline import pattern** (lines 10-15):
```typescript
import {
  Position, RunInventory,
  MoveIntent, AttackIntent, VentIntent, COMPONENTS_REGISTRY,
  DescentIntent, ExtractionIntent, EquipIntent, UnequipIntent, ShellUpdateTag, MovedThisTurn,
  BurnSoftwareIntent, FirmwareIntent, PickupIntent
} from './components';
```
Add `EquipmentSlots` here if the pipeline needs to read it directly (it does not in most cases — the system reads it). Remove `BurnedSoftware` from this import list.

---

### `src/game/systems/combat.ts` (MODIFIED system, request-response)

**Analog:** self — this is the primary surgical site.

**Current imports** (line 6) — replace `BurnedSoftware` with `EquipmentSlots` and `Children`:
```typescript
// BEFORE
import { Attack, Defense, Health, Actor, Heat, BurnedSoftware, SoftwareDef, RarityTier, Dying, StatusEffects, AugmentSlots, AugmentData, DealtDamageThisTurn } from '@shared/components';
// AFTER
import { Attack, Defense, Health, Actor, Heat, EquipmentSlots, Children, SoftwareDef, RarityTier, Dying, StatusEffects, AugmentSlots, AugmentData, DealtDamageThisTurn } from '@shared/components';
```

**`collectDamageModifiers` — current BurnedSoftware read** (lines 49-70) — replace entirely:
```typescript
// CURRENT (lines 54-70) — to be replaced:
const burnedSoftware = world.getComponent(attackerId, BurnedSoftware);
if (!burnedSoftware) return modifiers;

if (burnedSoftware.weapon !== null) {
  const softwareDef = world.getComponent(burnedSoftware.weapon, SoftwareDef);
  const rarity = world.getComponent(burnedSoftware.weapon, RarityTier);
  if (softwareDef && rarity && softwareDef.effectType !== 'dot' && ...) {
    modifiers.push({ source: `software:${softwareDef.type}`, type: 'additive', value: softwareDef.baseMagnitude * rarity.scaleFactor, phase: 'pre_defense' });
  }
}
```

**Replacement pattern** — walk `EquipmentSlots.weapon` → `Children.entityIds` → child `SoftwareDef`/`RarityTier`:
```typescript
// NEW: walk equipped weapon's installed software children
const equipmentSlots = world.getComponent(attackerId, EquipmentSlots);
if (equipmentSlots?.weapon !== null && equipmentSlots?.weapon !== undefined) {
  const weaponId = equipmentSlots.weapon;
  const children = world.getComponent(weaponId, Children);
  for (const childId of children?.entityIds ?? []) {
    const softwareDef = world.getComponent(childId, SoftwareDef);
    const rarity = world.getComponent(childId, RarityTier);
    if (
      softwareDef &&
      rarity &&
      softwareDef.effectType !== 'dot' &&
      softwareDef.effectType !== 'action_economy' &&
      softwareDef.effectType !== 'heal_on_kill'
    ) {
      modifiers.push({
        source: `software:${softwareDef.type}`,
        type: 'additive',
        value: softwareDef.baseMagnitude * rarity.scaleFactor,
        phase: 'pre_defense',
      });
    }
  }
}
```

**New `getEffectiveArmor` helper** — add as a module-level function before `createCombatSystem`. Pattern derived from the existing `effectiveArmor` inline logic in `update` (lines 155-157):
```typescript
// EXISTING inline pattern (lines 155-157) — factor out and extend:
const armor = defenderDefense?.armor ?? 0;
const defenderHeat = w.getComponent(defenderId, Heat);
const effectiveArmor = defenderHeat?.isVenting ? 0 : armor;
```

**New helper target:**
```typescript
function getEffectiveArmor<T extends GameplayEvents>(
  world: World<T>,
  defenderId: EntityId,
  isVenting: boolean
): number {
  if (isVenting) return 0;
  const baseDefense = world.getComponent(defenderId, Defense);
  const base = baseDefense?.armor ?? 0;
  const equipmentSlots = world.getComponent(defenderId, EquipmentSlots);
  if (equipmentSlots?.armor !== null && equipmentSlots?.armor !== undefined) {
    const armorEntityDefense = world.getComponent(equipmentSlots.armor, Defense);
    return base + (armorEntityDefense?.armor ?? 0);
  }
  return base;
}
```

Then replace the inline armor calculation in `update` (lines 154-157) with a call to this helper.

---

### `src/game/systems/equipment.ts` (MODIFIED system, CRUD)

**Analog:** self — add `case 'weapon':` and `case 'armor':` branches to the existing `switch` statements.

**Current `handleEquip` switch** (lines 47-62) — the pattern to extend:
```typescript
switch (intent.slotType) {
  case 'firmware':
    slotComponent = FirmwareSlots;
    maxSlots = portConfig.maxFirmware;
    break;
  case 'augment':
    slotComponent = AugmentSlots;
    maxSlots = portConfig.maxAugment;
    break;
  case 'software':
    slotComponent = SoftwareSlots;
    maxSlots = portConfig.maxSoftware;
    break;
  default:
    return;
}
```

**New cases to add before `default: return`:**
```typescript
case 'weapon': {
  const slots = w.getComponent(entityId, EquipmentSlots);
  if (!slots) return;
  w.patchComponent(entityId, EquipmentSlots, { weapon: intent.itemEntityId });
  eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
  eventBus.emit('MESSAGE_EMITTED', { text: 'Weapon equipped', type: 'info' } as any);
  logger.info(`Entity ${entityId} equipped weapon ${intent.itemEntityId}`, 'SYSTEM');
  return;  // early return — EquipmentSlots uses named fields, not equipped[] arrays
}
case 'armor': {
  const slots = w.getComponent(entityId, EquipmentSlots);
  if (!slots) return;
  w.patchComponent(entityId, EquipmentSlots, { armor: intent.itemEntityId });
  eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
  eventBus.emit('MESSAGE_EMITTED', { text: 'Armor equipped', type: 'info' } as any);
  logger.info(`Entity ${entityId} equipped armor ${intent.itemEntityId}`, 'SYSTEM');
  return;
}
```

**`patchComponent` pattern** — the existing system already uses this pattern at line 77:
```typescript
w.patchComponent(entityId, slotComponent, { equipped: newEquipped });
```

**Current `handleUnequip` switch** (lines 85-98) — add parallel cases:
```typescript
case 'weapon': {
  const slots = w.getComponent(entityId, EquipmentSlots);
  if (!slots) return;
  w.patchComponent(entityId, EquipmentSlots, { weapon: null });
  eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
  return;
}
case 'armor': {
  const slots = w.getComponent(entityId, EquipmentSlots);
  if (!slots) return;
  w.patchComponent(entityId, EquipmentSlots, { armor: null });
  eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
  return;
}
```

**Import update** — add `EquipmentSlots` to the existing import from `@shared/components` (line 7-10):
```typescript
import {
  PortConfig, FirmwareSlots, AugmentSlots, SoftwareSlots,
  EquipmentSlots, EquipIntent, UnequipIntent
} from '@shared/components';
```

---

### `src/game/systems/software-effects.ts` (MODIFIED utility, event-driven)

**BurnedSoftware removal** — this file reads `BurnedSoftware` in three functions. Each must be migrated to read from `EquipmentSlots` + `Children` traversal.

**Current import** (line 4) — replace:
```typescript
// BEFORE
import { BurnedSoftware, SoftwareDef, RarityTier, HealIntent, ApplyStatusEffectIntent } from '@shared/components';
// AFTER
import { EquipmentSlots, Children, SoftwareDef, RarityTier, HealIntent, ApplyStatusEffectIntent } from '@shared/components';
```

**`applyBleedOnHit` current pattern** (lines 18-19) — replace `BurnedSoftware` read:
```typescript
// BEFORE
const burned = world.getComponent(attackerId, BurnedSoftware);
if (!burned?.weapon) return;
const softwareDef = world.getComponent(burned.weapon, SoftwareDef);
if (!softwareDef || softwareDef.type !== 'bleed') return;
const rarity = world.getComponent(burned.weapon, RarityTier);
```

**Replacement pattern** — walk `EquipmentSlots.weapon` → `Children` → find child with `type === 'bleed'`:
```typescript
const equipmentSlots = world.getComponent(attackerId, EquipmentSlots);
if (equipmentSlots?.weapon === null || equipmentSlots?.weapon === undefined) return;
const children = world.getComponent(equipmentSlots.weapon, Children);
let softwareDef: SoftwareDefData | null = null;
let rarity: RarityTierData | null = null;
for (const childId of children?.entityIds ?? []) {
  const def = world.getComponent(childId, SoftwareDef);
  if (def?.type === 'bleed') {
    softwareDef = def;
    rarity = world.getComponent(childId, RarityTier);
    break;
  }
}
if (!softwareDef || !rarity) return;
```

Apply the same traversal pattern for `applyVampireOnKill` (reads `burned.armor` → traverse `EquipmentSlots.armor` → `Children` → find `type === 'vampire'`) and `checkAutoLoader` (reads `burned.weapon` → traverse `EquipmentSlots.weapon` → `Children` → find `type === 'auto-loader'`).

---

### `src/game/systems/run-ender.ts` (MODIFIED system, event-driven)

**Analog:** self — two `BurnedSoftware` patch calls at lines 95-97 and 105-107.

**Current pattern** (lines 95-97):
```typescript
if (world.hasComponent(playerId, BurnedSoftware)) {
  world.patchComponent(playerId, BurnedSoftware, { weapon: null, armor: null });
}
```

**Replacement pattern** — identical shape, different component:
```typescript
if (world.hasComponent(playerId, EquipmentSlots)) {
  world.patchComponent(playerId, EquipmentSlots, { weapon: null, armor: null });
}
```

**Import update** (line 9) — swap `BurnedSoftware` for `EquipmentSlots`:
```typescript
import { RunInventory, EquipmentSlots, MovedThisTurn, Dying, FirmwareSlots, SoftwareSlots, AugmentSlots, Stability, ExtractionIntent } from '@shared/components';
```

---

### `src/game/ui/sync-bridge.ts` (MODIFIED utility, event-driven)

**Analog:** self — reads `BurnedSoftware` to populate the UI `mods` array.

**Current pattern** (lines 37-54):
```typescript
const burned = world.getComponent(context.playerId, BurnedSoftware);
// ...
if (burned?.weapon) {
  const sw = world.getComponent(burned.weapon, SoftwareDef);
  if (sw) mods.push(sw.name);
}
if (burned?.armor) {
  const sw = world.getComponent(burned.armor, SoftwareDef);
  if (sw) mods.push(sw.name);
}
```

**Replacement pattern** — traverse `EquipmentSlots` → `Children` to collect all installed software names:
```typescript
const equipmentSlots = world.getComponent(context.playerId, EquipmentSlots);
if (equipmentSlots?.weapon !== null && equipmentSlots?.weapon !== undefined) {
  const children = world.getComponent(equipmentSlots.weapon, Children);
  for (const childId of children?.entityIds ?? []) {
    const sw = world.getComponent(childId, SoftwareDef);
    if (sw) mods.push(sw.name);
  }
}
if (equipmentSlots?.armor !== null && equipmentSlots?.armor !== undefined) {
  const children = world.getComponent(equipmentSlots.armor, Children);
  for (const childId of children?.entityIds ?? []) {
    const sw = world.getComponent(childId, SoftwareDef);
    if (sw) mods.push(sw.name);
  }
}
```

---

### `src/game/engine-factory.ts` (MODIFIED config, CRUD)

**Analog:** self — follow the existing `playerOverrides` pattern.

**Existing playerOverrides pattern** (lines 146-151):
```typescript
const playerOverrides: Record<string, Record<string, unknown>> = {
  'augmentSlots': { equipped: [] },
  'augmentState': { activationsThisTurn: {}, cooldownsRemaining: {} },
  'heat': { current: 0, maxSafe: 100, baseDissipation: 5, ventPercentage: 0.5, isVenting: false },
  'stability': { current: 100, max: 100 },
  'floorState': { currentFloor: 1, maxFloor: 15, runSeed: config.seed }
};
```

**Add `EquipmentSlots` default** — insert after existing entries:
```typescript
'equipmentSlots': { weapon: null, armor: null },
```

**Remove `burnedSoftware` override** (lines 193-196) — this block must be deleted entirely:
```typescript
// DELETE THIS BLOCK:
playerOverrides['burnedSoftware'] = {
  weapon: weaponSoftwareId,
  armor: armorSoftwareId,
};
```

The equipment slot population for weapon/armor will be handled by the new `EquipmentSystem` at runtime — not pre-seeded in `playerOverrides`. (The existing software item spawning loop may need to be updated separately, depending on Phase 18 item types.)

---

## Test File Patterns

### `src/game/systems/combat.test.ts` (MODIFIED test)

**Analog:** self — existing tests are the template.

**Test setup pattern** (lines 20-32):
```typescript
beforeEach(() => {
  eventBus = new EventBus<GameplayEvents>();
  world = new World<GameplayEvents>(eventBus);
  grid = new Grid(10, 10);
  const mockRegistry = { get: vi.fn() } as any;
  entityFactory = new EntityFactory(mockRegistry);
  vi.spyOn(entityFactory, 'create').mockReturnValue(999 as any);
  componentRegistry = {} as any;
  combatSystem = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry);
  combatSystem.init();
});
```

**Entity creation pattern with components** (lines 34-47) — for new tests, create weapon entity + child software entity:
```typescript
const attacker = world.createEntity();
world.addComponent(attacker, Attack, { power: 5 });
world.addComponent(attacker, EquipmentSlots, { weapon: weaponEntityId, armor: null });

const weaponEntity = world.createEntity();
// no extra components needed — just the entity to hold Children

const softwareEntity = world.createEntity();
world.addComponent(softwareEntity, SoftwareDef, { type: 'bleed', effectType: 'dot', baseMagnitude: 2, name: 'Bleed.exe' });
world.addComponent(softwareEntity, RarityTier, { tier: 'v0.x', scaleFactor: 1.0 });
world.addComponent(weaponEntity, Children, { entityIds: [softwareEntity] });
```

**Assertion pattern** (lines 47-56) — verify expected outcomes:
```typescript
world.addComponent(attacker, AttackIntent, { targetId: defender });
world.executeSystems(Phase.REACTION);
eventBus.flush();

const health = world.getComponent(defender, Health);
expect(health?.current).toBe(expectedValue);
```

### `src/shared/__tests__/pipeline.test.ts` (MODIFIED test)

**Analog:** self — existing MOVE/ATTACK tests are the template.

**New EQUIP action test pattern** — follow the existing `it('should process a MOVE action...')` structure (lines 30-46):
```typescript
it('should process EQUIP_GEAR(weapon) action and update EquipmentSlots', () => {
  // Setup: player needs EquipmentSlots component
  world.addComponent(PLAYER_ID, EquipmentSlots, { weapon: null, armor: null });
  const weaponEntityId = 99; // pre-existing entity id

  const action = { type: 'EQUIP' as const, slotType: 'weapon' as const, itemEntityId: weaponEntityId, shellId: 'test' };
  const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);

  const slots = newWorld.getComponent(PLAYER_ID, EquipmentSlots);
  expect(slots?.weapon).toBe(weaponEntityId);
  // Verify original is unchanged (pipeline is pure)
  expect(world.getComponent(PLAYER_ID, EquipmentSlots)?.weapon).toBeNull();
});
```

---

## Shared Patterns

### Component Definition
**Source:** `src/shared/components/burned-software.ts` (lines 1-18) and `src/shared/components/defense.ts` (lines 1-14)
**Apply to:** `src/shared/components/equipment-slots.ts`
```typescript
import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const ComponentName = defineComponent(
  'camelCaseKey',
  z.object({ /* fields */ }),
);
export type ComponentNameData = z.infer<typeof ComponentName.schema>;
```

### World Component Read
**Source:** `src/game/systems/combat.ts` (lines 54-70), `src/game/systems/equipment.ts` (lines 64-66)
**Apply to:** All system files that replace `BurnedSoftware` reads
```typescript
const component = world.getComponent(entityId, ComponentName);
if (!component) return; // or early exit pattern
```

### World Component Patch
**Source:** `src/game/systems/equipment.ts` (line 77), `src/game/systems/run-ender.ts` (lines 95-97)
**Apply to:** `equipment.ts` (new weapon/armor cases), `run-ender.ts` (slot clearing)
```typescript
w.patchComponent(entityId, EquipmentSlots, { weapon: null, armor: null });
```

### Children Traversal (Phase 18 pattern)
**Source:** `src/engine/ecs/world.ts` (cascading destroy) — public API via:
```typescript
const children = world.getComponent(weaponEntityId, Children);
for (const childId of children?.entityIds ?? []) { /* ... */ }
```
**Apply to:** `combat.ts` (collectDamageModifiers), `software-effects.ts` (all three functions), `sync-bridge.ts` (mods population)

### Phase Registration
**Source:** `src/game/systems/equipment.ts` (lines 116-119), `src/game/systems/combat.ts` (lines 274-277)
**Apply to:** No new systems — existing systems handle the new logic
```typescript
world.registerSystem(Phase.ACTION, update, 'SystemName');
// Equipment actions must be at Phase.ACTION; combat at Phase.REACTION
```

### EventBus Emission Pattern
**Source:** `src/game/systems/equipment.ts` (lines 79-81)
**Apply to:** New `weapon`/`armor` cases in `equipment.ts`
```typescript
eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
eventBus.emit('MESSAGE_EMITTED', { text: `...`, type: 'info' } as any);
logger.info(`Entity ${entityId} equipped item ${intent.itemEntityId} to ${intent.slotType} slot`, 'SYSTEM');
```

---

## No Analog Found

All files in this phase have direct analogs in the codebase. No files require falling back to RESEARCH.md patterns only.

---

## Blast Radius: BurnedSoftware Removal

Files that import `BurnedSoftware` and must be updated (confirmed via RESEARCH.md pitfall analysis):

| File | Current Usage | Required Change |
|------|---------------|-----------------|
| `src/game/systems/combat.ts` | `collectDamageModifiers` reads `BurnedSoftware.weapon` | Replace with `EquipmentSlots` + `Children` traversal (see Pattern Assignments above) |
| `src/game/systems/software-effects.ts` | `applyBleedOnHit`, `checkAutoLoader`, `applyVampireOnKill` | Replace with `EquipmentSlots` + `Children` traversal (see Pattern Assignments above) |
| `src/game/systems/run-ender.ts` | `world.patchComponent(playerId, BurnedSoftware, ...)` | Replace with `EquipmentSlots` (see Pattern Assignments above) |
| `src/game/ui/sync-bridge.ts` | `burned.weapon`, `burned.armor` for UI mods | Replace with `EquipmentSlots` + `Children` (see Pattern Assignments above) |
| `src/game/engine-factory.ts` | `playerOverrides['burnedSoftware']` | Delete block; add `playerOverrides['equipmentSlots']` (see Pattern Assignments above) |
| `src/shared/components/index.ts` | Import, export, and COMPONENTS_REGISTRY entry | Swap for `EquipmentSlots` (see Pattern Assignments above) |

Two additional files mentioned in RESEARCH.md that may need checking:
- `src/game/systems/software.ts` — check for any `BurnedSoftware` imports
- `src/game/systems/software.test.ts` — test setup using `BurnedSoftware` must migrate to `EquipmentSlots` + `Children`

---

## Metadata

**Analog search scope:** `src/shared/components/`, `src/game/systems/`, `src/shared/pipeline.ts`, `src/shared/types.ts`, `src/game/engine-factory.ts`, `src/game/ui/sync-bridge.ts`
**Files scanned:** 14
**Pattern extraction date:** 2026-05-15
