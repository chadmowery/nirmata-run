# Phase 19: Combat Stat Pipeline & Turn Costs - Research

**Researched:** 2026-05-15
**Domain:** ECS Combat Systems, Stat Aggregation, Intent/Turn Pipeline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Calculation trigger — On-demand at combat time. The hierarchy traversal runs inside `collectDamageModifiers` (and its defensive counterpart) each time damage is resolved. No cached derived stat. Satisfies LMC-02's "no permanent stat mutation" constraint.
- **D-02:** Traversal anchor — The player entity gets an `EquipmentSlots` component `{ weapon: EntityId | null, armor: EntityId | null }`. `collectDamageModifiers` walks `EquipmentSlots.weapon` → weapon entity → `SlotComponent` children → `SoftwareDef`/modifier data. Armor stat is read from `EquipmentSlots.armor` entity + its children.
- **D-03:** Slot shape — Weapon + Armor only. No additional slots in this phase.
- **D-04:** Intent type — Equipment actions are submitted as named intent types: `EquipIntent` and `UninstallIntent` (or a single `EquipmentActionIntent` with an `action` discriminant). Routed through `TurnManager.submitAction(...)` like all other player actions.
- **D-05:** Turn cycle behavior — When the intent resolves (Phase.ACTION), the equipment slot updates, then the standard turn cycle continues normally — enemies take their turns. The player spent their action on gear management; enemies respond.
- **D-06:** Hierarchy traversal replaces BurnedSoftware — `collectDamageModifiers` is updated to walk the entity hierarchy (via `EquipmentSlots` → weapon children) instead of reading `BurnedSoftware`. The `BurnedSoftware` component is removed entirely — no shim, no dead code.

### Claude's Discretion

- Exact naming and structure of the intent types (`EquipIntent` vs. `EquipmentActionIntent`).
- Whether `collectDamageModifiers` and the new armor-traversal logic are co-located in `combat.ts` or extracted into a `stat-pipeline.ts` helper.
- How `SlotComponent` children are queried — exact component names from Phase 18 output.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LMC-02 | The combat engine dynamically calculates effective stats (Damage, Armor, Heat) by traversing the equipment hierarchy, ensuring no permanent stat mutation on the player entity. | `collectDamageModifiers` rewrite to walk `EquipmentSlots` → `Children` entities; defender armor read from `EquipmentSlots.armor` entity's `Defense` component at combat time. |
| EQP-03 | Swapping equipment or modifying software costs the player 1 turn, enforced by the Turn Manager. | New intent components (`EquipIntent`/`UninstallIntent` extended, or new gear-management intents) routed through `TurnManager.submitAction` at the standard `defaultActionCost` (1000 energy). |
</phase_requirements>

---

## Summary

Phase 19 has two tightly coupled but independently testable responsibilities: (1) rewiring the combat stat calculation to read from the new Phase 18 entity hierarchy instead of the old `BurnedSoftware` flat component, and (2) ensuring equipment management actions (Equip, Uninstall) are counted as player turns by the turn manager.

The codebase already contains every primitive needed. `EquipmentSlots` is the only genuinely new component — a simple two-field Zod-validated struct. The `collectDamageModifiers` function in `combat.ts` already follows the exact pattern to be extended: it already reads a flat EntityId from `BurnedSoftware`, gets `SoftwareDef` and `RarityTier` from that entity, and builds modifiers. The surgery is to replace the `BurnedSoftware` read with an `EquipmentSlots` read, then extend the traversal to walk `Children` of the equipped weapon for installed software modifiers. A symmetric armor-bonus traversal is added using the `EquipmentSlots.armor` reference. `BurnedSoftware` is then deleted with its entire import chain.

The turn cost work is nearly free: `TurnManager.submitAction` already deducts `defaultActionCost` (1000) from any action name passed in. The `EquipmentSystem` already runs at `Phase.ACTION`. What is needed is: the `pipeline.ts` `processAction` switch handles new action type literals that attach gear-management intents, and those intents drive the existing `EquipmentSystem`. No TurnManager changes are required; the system is already correct.

**Primary recommendation:** Execute as two waves — Wave A (stat pipeline rewrite + BurnedSoftware deletion) then Wave B (turn cost wiring + pipeline integration). Both waves are small and independently verifiable by running `vitest run`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `EquipmentSlots` component definition | Shared Layer | — | All components live in `src/shared/components/`; consumed by both Game and Engine layers. |
| Stat aggregation (Damage/Armor) | Game Logic Layer | — | `collectDamageModifiers` lives in `src/game/systems/combat.ts`; it is game-rule logic, not engine primitive. |
| `EquipmentSystem` (intent resolution) | Game Logic Layer | — | Already exists at `Phase.ACTION` in `src/game/systems/equipment.ts`. |
| Turn cost enforcement | Engine Layer (TurnManager) | Game Logic Layer | `TurnManager.submitAction` deducts cost; game layer creates the intent; cost enforcement is implicit. |
| Network action types | Shared/Network Layer | — | New action literals added to `ActionIntentSchema` in `src/shared/types.ts` so both client and server validate identically. |

---

## Standard Stack

No new packages are installed in this phase. All work is within the existing project stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type system | Project standard [VERIFIED: package.json] |
| Zod | ^4.3.6 | Component schema definition and runtime validation | Project standard for all ECS components [VERIFIED: package.json] |
| Vitest | ^4.1.0 | Unit and integration testing | Project standard test runner [VERIFIED: package.json] |

### Supporting (already in codebase, used directly in this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `json-diff-ts` | (existing) | Network delta serialization | Flat entity model (Phase 18 D-05) means no change needed here — new component data is automatically diffed. |

### Alternatives Considered

None — all decisions are locked. No new dependencies.

---

## Package Legitimacy Audit

No new packages are installed in this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
Player input (EQUIP_WEAPON / UNINSTALL action)
    │
    ▼
pipeline.ts: processAction() switch
    │ attaches EquipIntent / UninstallIntent to player entity
    ▼
TurnManager.submitAction()
    │ deducts defaultActionCost (1000 energy)
    ▼
Phase.ACTION → EquipmentSystem.update()
    │ reads EquipIntent: patches EquipmentSlots.weapon or .armor
    │ reads UninstallIntent: clears EquipmentSlots.weapon or .armor
    │ removes intent component
    ▼
Phase.REACTION → CombatSystem.update()
    │ AttackIntent on player entity
    │   └── collectDamageModifiers(world, attackerId)
    │         ├── read EquipmentSlots.weapon → weaponEntityId
    │         │     ├── read Attack component on weapon entity (base weapon power)
    │         │     └── read Children.entityIds on weapon entity
    │         │           └── for each childId: read SoftwareDef + RarityTier → DamageModifier
    │         └── read AugmentSlots, StatusEffects (unchanged)
    │
    │ AttackIntent on defender entity
    │   └── effectiveArmor = getEquippedArmorValue(world, defenderId)
    │         ├── read EquipmentSlots.armor → armorEntityId
    │         └── read Defense component on armor entity
    │
    ▼
resolveDamage(baseAttack + weaponPower, modifiers, effectiveArmor)
    │
    ▼
Health mutation on defender
```

### Recommended Project Structure

```
src/shared/components/
├── equipment-slots.ts   # NEW: { weapon: EntityId | null, armor: EntityId | null }
└── index.ts             # Updated: add EquipmentSlots export; remove BurnedSoftware

src/shared/types.ts      # Updated: add EQUIP_WEAPON / UNINSTALL action schemas

src/shared/pipeline.ts   # Updated: add cases for new action types

src/game/systems/
├── combat.ts            # Updated: rewrite collectDamageModifiers; add armor traversal helper
└── equipment.ts         # Updated: handle new EquipmentSlots component (weapon/armor slot types)

src/game/engine-factory.ts
                         # Updated: add EquipmentSlots component to player entity overrides
```

### Pattern 1: EquipmentSlots Component

**What:** The traversal anchor for all Phase 19 stat calculations. A simple Zod-validated component holding nullable EntityId references for each gear slot.

**When to use:** Added to the player entity on spawn. Read by `collectDamageModifiers` and the new armor-bonus helper at combat resolution time.

```typescript
// Source: established project pattern from src/shared/components/defense.ts, attack.ts
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

### Pattern 2: Updated collectDamageModifiers — Hierarchy Traversal

**What:** Replace the `BurnedSoftware` flat lookup with a walk through `EquipmentSlots.weapon` → `Children` → `SoftwareDef`. The `resolveDamage` signature is unchanged.

**When to use:** Called at combat resolution time during `Phase.REACTION`. No caching.

```typescript
// Source: adapts existing combat.ts:49 pattern
export function collectDamageModifiers<T extends GameplayEvents>(
  world: World<T>,
  attackerId: EntityId
): DamageModifier[] {
  const modifiers: DamageModifier[] = [];

  // Walk EquipmentSlots.weapon → installed software children
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

  // AugmentSlots and StatusEffects modifiers — unchanged
  // ...
  return modifiers;
}
```

### Pattern 3: Armor Bonus Traversal (New Helper)

**What:** At combat time, read the defender's effective armor by traversing `EquipmentSlots.armor` → armor entity's `Defense` component. Replaces the direct `Defense` component read on the defender's player entity.

**When to use:** Inside `CombatSystem.update()` when computing `effectiveArmor` for the defender. The base shell armor still comes from the player entity's `Defense` component — the equipped armor entity's `Defense` value is added on top, not substituted.

```typescript
// Defensive stat: base shell armor + armor entity bonus
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

### Pattern 4: Equipment Intent Wiring for Turn Cost

**What:** New action type literals (`EQUIP_WEAPON`, `UNINSTALL_WEAPON`, `EQUIP_ARMOR`, `UNINSTALL_ARMOR`, or a single `GEAR_ACTION` with a discriminant) added to `ActionIntentSchema` in `types.ts`. `processAction` in `pipeline.ts` attaches the existing `EquipIntent` / `UnequipIntent` components. The turn cost is automatic because `TurnManager.submitAction` calls `deductEnergy(playerEntity, defaultActionCost)` before executing the phase cycle.

**When to use:** These are the new player action types for gear management. The existing `EquipIntent` component's `slotType` enum currently accepts `'firmware' | 'software' | 'augment'`. It must be extended to include `'weapon' | 'armor'` to cover the new gear slots.

```typescript
// Extension of existing EquipIntent in src/shared/components/intents.ts
export const EquipIntent = defineComponent(
  'equipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment', 'weapon', 'armor']),
    itemEntityId: z.number(),
  })
);
```

### Anti-Patterns to Avoid

- **Mutating the player's `Attack` or `Defense` component:** Per D-01 and LMC-02, gear bonuses must NEVER be written back to the player entity's base stat components. Always aggregate at read time only.
- **Caching the computed stat sum:** An intermediate "effective stats" component would be equivalent to permanent mutation and creates sync/staleness bugs. Compute on demand.
- **Storing a `BurnedSoftware` shim/alias:** D-06 states the component is removed entirely. Any code that kept a reference will get a TypeScript compile error, which is the desired enforcement mechanism.
- **Adding new system phases:** The existing Phase.ACTION + Phase.REACTION ordering already handles equipment resolution before combat; do not introduce new execution phases.
- **Checking `slotType === 'weapon' || 'armor'` in the existing EquipmentSystem without updating it:** The existing `EquipmentSystem.handleEquip` switches on `slotType` and dispatches to `FirmwareSlots`, `AugmentSlots`, or `SoftwareSlots`. It does not know about `EquipmentSlots`. The system must be updated to handle the new `weapon` and `armor` slot types and patch `EquipmentSlots` instead of the old slot arrays.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity hierarchy traversal | Custom recursive walker | `world.getComponent(entityId, Children)` + iterate `entityIds` | Phase 18 already established this pattern; the `Children` component is the contract |
| Turn cost deduction | Custom energy math in equipment handler | `TurnManager.submitAction(actionName)` — it already calls `deductEnergy(playerEntity, defaultActionCost)` | The turn cycle already runs in full after `submitAction`; no additional wiring needed |
| Zod schema validation | Manual type guards | `defineComponent('key', z.object({...}))` pattern established by every existing component | Zod integration is the project standard and auto-validates on `addComponent` |
| Network delta for new component | Custom serialization | No change needed — `json-diff-ts` diffs the entire serialized world; flat `EquipmentSlots` data is included automatically | This is Phase 18 D-05 in action |

**Key insight:** The project already solves all hard problems in this phase. Phase 19 is a targeted surgery on three files (`combat.ts`, `equipment.ts`, `components/index.ts`) plus one new file (`equipment-slots.ts`), with a `BurnedSoftware` tombstoning sweep afterward.

---

## Common Pitfalls

### Pitfall 1: Forgetting That EquipIntent.slotType Needs New Values

**What goes wrong:** The existing `EquipIntent` component uses `z.enum(['firmware', 'software', 'augment'])`. If new action handlers attach `EquipIntent` with `slotType: 'weapon'`, Zod will throw a validation error at runtime when `world.addComponent` is called with the updated schema not yet deployed.

**Why it happens:** The component definition and the handler are in different files; it is easy to update one and forget the other.

**How to avoid:** Update `intents.ts` first, then update `equipment.ts` handler logic, then add pipeline action routing. Tests will fail with Zod errors immediately if the enum is wrong.

**Warning signs:** `ZodError: Invalid enum value` in the console during `Phase.ACTION`.

### Pitfall 2: Existing EquipmentSystem Does Not Handle 'weapon' / 'armor' slotType

**What goes wrong:** The current `EquipmentSystem.handleEquip` has a `switch (intent.slotType)` that dispatches to `FirmwareSlots`, `AugmentSlots`, or `SoftwareSlots`. A `weapon` or `armor` value falls through to the `default: return` branch silently — no error, no slot update.

**Why it happens:** The system was built before `EquipmentSlots` existed.

**How to avoid:** Add explicit `case 'weapon':` and `case 'armor':` branches to `handleEquip` (and `handleUnequip`) that call `world.patchComponent(entityId, EquipmentSlots, { weapon: itemEntityId })`.

**Warning signs:** Equipment action completes turn cost, enemies take their turn, but `EquipmentSlots` remains `{ weapon: null, armor: null }`. Verified by checking component state in tests.

### Pitfall 3: BurnedSoftware Import Chain Left Partially Intact

**What goes wrong:** After removing `BurnedSoftware` from `components/index.ts`, TypeScript will surface compile errors in every file that still imports it. These include: `combat.ts`, `software.ts`, `software-effects.ts`, `run-ender.ts`, `run-ender.test.ts`, `sync-bridge.ts`, `engine-factory.ts`, and `software.test.ts`. Missing one file causes a silent functional regression (the file compiles if the import is from the old path, not the barrel export).

**Why it happens:** `BurnedSoftware` is widely used across gameplay systems including DoT effects, vampire healing, auto-loader checks, and the run-ender state clearing.

**How to avoid:** Complete the `BurnedSoftware` removal as a dedicated wave. Search for all usages first (`grep -rn BurnedSoftware src/`). The `software-effects.ts` functions (`applyBleedOnHit`, `applyVampireOnKill`, `checkAutoLoader`) must be updated to read from `EquipmentSlots` instead. The `run-ender.ts` death/extraction clear must patch `EquipmentSlots` to `null` instead of `BurnedSoftware`.

**Warning signs:** `tsc --noEmit` returns errors for `burnedSoftware` property access or missing module.

### Pitfall 4: Weapon-Installed Software's effectType Enum Is Incomplete

**What goes wrong:** The new `collectDamageModifiers` logic correctly skips `'dot' | 'action_economy' | 'heal_on_kill'` software as damage bonuses. However, `SoftwareDef.effectType` only lists those three values — there is no positive `'damage_bonus'` type. The existing `software.test.ts` even passes an invalid `effectType: 'damage_bonus' as any` in a test, signaling this gap.

**Why it happens:** The enum was defined by the existing software types, not by the new weapon/armor hierarchy model.

**How to avoid:** Either (a) add `'damage_bonus'` to the `effectType` enum and use it as the positive check, or (b) keep the current negative-filter approach (skip known non-damage types) which is already working. Option (b) is a zero-risk change for Phase 19; option (a) is cleaner but is a scope expansion. Recommend option (b) for this phase.

**Warning signs:** New software entities installed on weapons are silently never included in modifiers because their `effectType` value is an unrecognized string.

### Pitfall 5: Player Entity Not Initialized with EquipmentSlots

**What goes wrong:** `collectDamageModifiers` reads `world.getComponent(attackerId, EquipmentSlots)`. If the player entity was created without this component (engine-factory.ts does not add it), the function returns `null` and produces zero weapon modifiers — silently incorrect.

**Why it happens:** New components must be explicitly added to entity initialization; the ECS does not auto-add missing components.

**How to avoid:** Add `EquipmentSlots` to `playerOverrides` in `engine-factory.ts` with `{ weapon: null, armor: null }` as the default. Also add it to the `COMPONENTS_REGISTRY` array in `components/index.ts` so the network serializer includes it.

**Warning signs:** `collectDamageModifiers` returns only Augment/StatusEffect modifiers, never weapon software modifiers. Test with a player entity that has equipment and verify modifier count > 0.

---

## Code Examples

### Existing Pattern: How BurnedSoftware Was Read (to be replaced)

```typescript
// Source: src/game/systems/combat.ts:54-68 (current — to be removed)
const burnedSoftware = world.getComponent(attackerId, BurnedSoftware);
if (!burnedSoftware) return modifiers;

if (burnedSoftware.weapon !== null) {
  const softwareDef = world.getComponent(burnedSoftware.weapon, SoftwareDef);
  const rarity = world.getComponent(burnedSoftware.weapon, RarityTier);
  if (softwareDef && rarity && softwareDef.effectType !== 'dot' && ...) {
    modifiers.push({ source: `software:${softwareDef.type}`, ... });
  }
}
```

### Existing Pattern: How Children Are Queried (Phase 18 output)

```typescript
// Source: src/engine/ecs/world.ts:38-44 (cascading destroy uses same pattern)
const childrenStore = this.stores.get('children');
if (childrenStore && childrenStore.has(id)) {
  const childrenData = childrenStore.get(id) as { entityIds: number[] };
  for (const childId of childrenData.entityIds) { ... }
}

// Via public API:
const children = world.getComponent(weaponEntityId, Children);
for (const childId of children?.entityIds ?? []) { ... }
```

### Existing Pattern: How Actions Reach the Pipeline

```typescript
// Source: src/shared/pipeline.ts:114-118 (EQUIP case)
case 'EQUIP':
  world.addComponent(entityId, EquipIntent, {
    slotType: action.slotType,
    itemEntityId: action.itemEntityId
  });
  break;
```

### Existing Pattern: TurnManager Turn Cost (no changes needed)

```typescript
// Source: src/engine/turn/turn-manager.ts:43-51
const cost = action === 'WAIT' ? this.config.waitActionCost : this.config.defaultActionCost;
this.deductEnergy(playerEntity, cost);
// defaultActionCost = 1000 (set in engine-factory.ts TurnManager constructor)
// All non-WAIT actions cost 1 full turn — equipment actions included.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `BurnedSoftware` component holding two EntityId references | `EquipmentSlots` component + `Children` traversal | Phase 19 | Software modifiers sourced from entity hierarchy rather than a parallel flat lookup |
| Equipment actions pass through without turn cost | All gear-management actions routed through `TurnManager.submitAction` | Phase 19 | Enemies always get to react to player equip/uninstall choices |

**Deprecated/outdated after this phase:**

- `BurnedSoftware` component (`src/shared/components/burned-software.ts`): entirely removed.
- All references to `BurnedSoftware` in `combat.ts`, `software.ts`, `software-effects.ts`, `run-ender.ts`, `sync-bridge.ts`, `engine-factory.ts`.

---

## Runtime State Inventory

This phase is not a rename/refactor/migration. The only "stored data" concern is the live session world state: any active game session in-flight will have a serialized world containing `burnedSoftware` component data on the player entity. After deployment, the `deserializeWorld` function will simply ignore the now-removed store key — the ECS world loads only components present in `COMPONENTS_REGISTRY`. No migration script is required; the component data is per-session ephemeral state, not persisted profile data.

- Stored data: None persisted across sessions. `BurnedSoftware` data lives only in the in-memory session world.
- Live service config: None.
- OS-registered state: None.
- Secrets/env vars: None.
- Build artifacts: None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The weapon entity has a `Children` component that lists installed software EntityIds, based on Phase 18 builder output. | Architecture Patterns / Pattern 2 | If Phase 18 did not populate `Children` on weapon entities at spawn time, the traversal returns nothing and weapon software gives zero modifiers. Verify in Phase 18 test output. |
| A2 | Enemy entities do not have `EquipmentSlots` and thus the armor traversal helper returns their base `Defense` component value unchanged. | Architecture Patterns / Pattern 3 | If enemies unexpectedly have `EquipmentSlots`, the effective armor calculation would include equipment bonuses on enemies too — potentially unintended. Low risk since no enemy template sets this. |
| A3 | `effectType: 'damage_bonus'` is not added to the enum in this phase; the negative-filter approach is sufficient. | Common Pitfalls / Pitfall 4 | If a new software type installed on a weapon uses a novel `effectType` string that is not in the exclusion list, it would incorrectly generate a damage modifier. This is a Phase 20+ concern. |

---

## Open Questions (RESOLVED)

1. **Does the existing EquipmentSystem handle the complete turn cost for equipment actions that go through the API pipeline (not TurnManager directly)?**
   - What we know: `TurnManager.submitAction` is the entry point for all local client-side game loop actions. Server-side, actions go through `runActionPipeline` which does NOT call `TurnManager.submitAction` — it manually executes each phase.
   - What's unclear: The server pipeline's `runActionPipeline` does not deduct energy or increment turn number. The turn cost in the live game is enforced by the client's TurnManager. Equipment actions via the API route go through `processAction` → `EquipIntent` → `EquipmentSystem` but the energy deduction happens on the client side only.
   - RESOLVED: This is the existing pattern for all actions (MOVE, ATTACK, etc.) and is correct by design — the server is authoritative for world state, the client is authoritative for the turn/energy cycle. No change needed.

2. **Should the new `EquipmentSlots` component use slotType `'weapon'` / `'armor'` or `'gear'` as the discriminant in `EquipIntent`?**
   - What we know: The CONTEXT.md (D-03) says Weapon + Armor only. The `EquipmentSlots` component has named fields (`weapon`, `armor`) rather than a generic array.
   - What's unclear: Whether to add `'weapon'` and `'armor'` to the existing `EquipIntent.slotType` enum, or create a new intent type (`GearEquipIntent`) that maps directly to `EquipmentSlots` field names.
   - RESOLVED: Extend the existing `EquipIntent.slotType` enum. Avoids a proliferation of intent types and reuses the existing pipeline routing. The `EquipmentSystem` switch just needs two new cases.

---

## Environment Availability

This phase has no external dependencies beyond the existing project toolchain. Step 2.6 SKIPPED — all work is code/component changes with no new runtime tools, services, or CLIs.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/game/systems/combat.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LMC-02 | `collectDamageModifiers` returns weapon software modifier when weapon entity has software child | unit | `npx vitest run src/game/systems/combat.test.ts` | Partial (existing tests cover BurnedSoftware path) — new test needed |
| LMC-02 | `collectDamageModifiers` returns zero modifiers when `EquipmentSlots.weapon` is null | unit | `npx vitest run src/game/systems/combat.test.ts` | ❌ Wave 0 |
| LMC-02 | Defender effective armor includes armor entity's Defense value | unit | `npx vitest run src/game/systems/combat.test.ts` | ❌ Wave 0 |
| LMC-02 | Player base `Attack` and `Defense` components are NOT mutated after equipping gear | unit | `npx vitest run src/game/systems/combat.test.ts` | ❌ Wave 0 |
| EQP-03 | Equip action via pipeline deducts full turn from player energy (enemies act) | integration | `npx vitest run src/shared/__tests__/pipeline.test.ts` | Partial — new case needed |
| EQP-03 | Uninstall action via pipeline deducts full turn from player energy | integration | `npx vitest run src/shared/__tests__/pipeline.test.ts` | ❌ Wave 0 |
| D-06 | TypeScript compilation succeeds with BurnedSoftware removed | build | `npx tsc --noEmit` | n/a |

### Sampling Rate

- Per task commit: `npx vitest run src/game/systems/combat.test.ts src/game/systems/software.test.ts`
- Per wave merge: `npx vitest run`
- Phase gate: Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/game/systems/combat.test.ts` — add tests for new `EquipmentSlots`-based `collectDamageModifiers` path
- [ ] `src/game/systems/combat.test.ts` — add test for armor traversal helper
- [ ] `src/shared/__tests__/pipeline.test.ts` — add `EQUIP_WEAPON` / `UNINSTALL_WEAPON` action round-trip tests
- [ ] Existing `software.test.ts` tests that set up `BurnedSoftware` directly must be migrated to use `EquipmentSlots` + `Children` instead

---

## Security Domain

This phase makes no authentication, session, or network surface changes. The only new data is an `EquipmentSlots` component with two nullable integer fields. No new API endpoints, no new user input vectors, no cryptography. ASVS coverage is not applicable for this phase.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/game/systems/combat.ts` — direct read of `collectDamageModifiers`, `resolveDamage` implementation
- Codebase: `src/engine/turn/turn-manager.ts` — direct read of `submitAction`, `deductEnergy`, turn cycle execution
- Codebase: `src/shared/pipeline.ts` — direct read of `processAction` switch, `runActionPipeline` execution model
- Codebase: `src/shared/components/intents.ts` — direct read of `EquipIntent`, `UnequipIntent` schema definitions
- Codebase: `src/shared/components/index.ts` — direct read of `COMPONENTS_REGISTRY` and all current component exports
- Codebase: `src/game/systems/equipment.ts` — direct read of existing `EquipmentSystem` handler logic
- Codebase: `src/game/systems/software-effects.ts` — direct read of all `BurnedSoftware`-reading helpers (to be migrated)
- Codebase: `src/game/systems/run-ender.ts` — direct read of `BurnedSoftware` clearing on player death/extraction
- Codebase: `src/game/ui/sync-bridge.ts` — direct read of `BurnedSoftware` usage in UI sync bridge
- Codebase: `src/game/engine-factory.ts` — direct read of player entity initialization and `playerOverrides`
- Codebase: `src/shared/components/parent.ts`, `children.ts` — Phase 18 output, bidirectional hierarchy components
- Planning: `.planning/phases/18-hierarchical-entity-foundation/18-02-SUMMARY.md` — Phase 18 delivery confirmation
- Planning: `.planning/phases/19-combat-stat-pipeline-turn-costs/19-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- Planning: `.planning/codebase/CONVENTIONS.md` — naming patterns, code style
- Planning: `.planning/codebase/TESTING.md` — Vitest patterns, test organization
- Planning: `.planning/codebase/ARCHITECTURE.md` — layer boundaries, data flow

---

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — all libraries confirmed in package.json; no new packages
- Architecture: HIGH — all integration points verified by direct codebase reads
- Pitfalls: HIGH — identified from direct code inspection of affected files (not hypothetical)
- BurnedSoftware blast radius: HIGH — found all 8 files that import it via grep

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable codebase, 30-day window)
