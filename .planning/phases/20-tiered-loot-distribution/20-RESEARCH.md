<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** **Hardcoded in Enemy Templates** — Tiered drops will be mapped directly in each enemy's JSON template by updating their `LootTable.drops` array, keeping it simple and consistent with the current design.
- **D-02:** **Guaranteed + Chance** — Higher-tier enemies (Elites/Bosses) will always drop at least 1 equipment piece, plus chances for more, rather than relying purely on percentage rolls.
- **D-03:** **Static Templates** — Tiered weapons and armor will be generated using static JSON templates (e.g., `rifle-v1.json`), consistent with the current software `v0-v3` pattern.
- **D-04:** **Existing LootTable.tier** — The system will use the existing `LootTable.tier` property (1-3) to identify the 3-tier hierarchy instead of introducing a new component.

### the agent's Discretion
- Implementation details for guaranteeing the equipment drop in `reward-drop.ts`.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LMC-01 | Enemy drop tables are updated to include tiered Weapons, Armor, and Software items corresponding to the 3-tier enemy hierarchy. | Confirmed structure of `LootTable.tier` and `LootTable.drops` in JSON templates. Equipment templates need to be created (`rifle-v1.json`, `armor-v1.json`) and added to existing enemy JSON files. |
</phase_requirements>

# Phase 20: Tiered Loot Distribution - Research

**Researched:** 2026-05-16
**Domain:** Entity Component System (ECS) Loot Drop Mechanics
**Confidence:** HIGH

## Summary

The phase focuses on updating `src/game/systems/reward-drop.ts` and enemy templates in `src/game/entities/templates/` to support tiered drops based on the 3-tier hierarchy (`LootTable.tier`). The existing codebase uses `Math.random()` for item, scrap, flux, and blueprint drops, which must be fully replaced with `ROT.RNG.getUniform()` from `rot-js` to ensure deterministic item drops per floor. 

**Primary recommendation:** Replace all `Math.random()` instances in `reward-drop.ts` with `RNG.getUniform()`. Implement a "guaranteed drop" loop for `tier >= 2` enemies before rolling chances for remaining drop options. Utilize the `children` array property in new static templates (e.g., `rifle-v1.json`) to fulfill the "preserve internal entity state (pre-installed software)" requirement natively through `EntityFactory.create()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rot-js | 2.2.1 | `ROT.RNG` for deterministic drops | Requested by Success Criteria to balance drop rates and unify RNG. |
| json-diff-ts | 4.10.0 | State syncing | Handled by existing ECS serialization. |

## Architecture Patterns

### Recommended Project Structure
```
src/game/entities/templates/
├── [enemy].json         # Updated with LootTable.tier and tiered template drops
├── rifle-v1.json        # NEW: Tier 1 weapon template
├── armor-v1.json        # NEW: Tier 1 armor template
└── ...
```

### Pattern 1: Deterministic Drops
**What:** Replacing standard math randoms with the rot-js pseudo-random number generator.
**When to use:** Whenever making chance-based decisions in game systems.
**Example:**
```typescript
import RNG from 'rot-js/lib/rng';

// Instead of Math.random() < drop.chance
if (RNG.getUniform() < drop.chance) {
  // Execute drop
}
```

### Pattern 2: Nested Entity Generation (Pre-installed Software)
**What:** Using the `children` array in static JSON templates to spawn internal state automatically.
**When to use:** Defining Weapons or Armor with pre-installed software out of the box.
**Example:**
```json
{
  "name": "rifle-v1",
  "components": { ... },
  "children": [
    {
      "template": "auto-loader-v1",
      "slotComponent": "softwareSlot"
    }
  ]
}
```
*Note: `src/engine/entity/builder.ts` recursively evaluates `children` into ECS entities and links them via the `parent` and `children` components automatically.*

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Internal Item State Instantiation | A custom script to attach software on item drop. | `children` in template JSONs | `buildEntity` already handles complex hierarchical entity generation based on templates. |
| Guaranteed Pick Logic | Complex weight-accumulation arrays | A simple uniform shuffle and selection for the guaranteed item | Keep the drop system efficient, predictable, and simple inside the `CLEANUP` phase. |

## Common Pitfalls

### Pitfall 1: Partial RNG Replacement
**What goes wrong:** `Math.random()` is replaced for equipment drops but left for scrap, flux, or blueprints.
**Why it happens:** Incomplete audit of `src/game/systems/reward-drop.ts`.
**How to avoid:** Specifically audit lines 76-101 in `reward-drop.ts` to ensure `RNG.getUniform()` replaces every `Math.random()` check.

### Pitfall 2: Mutating the `LootTable.drops` Array during Guaranteed Drops
**What goes wrong:** Modifying the `LootTable.drops` object inside the ECS during iteration.
**Why it happens:** Trying to pull the "guaranteed" drop out of the pool via array splices.
**How to avoid:** Clone the `drops` array locally in the system or mark the guaranteed index to skip it during the percentage-based roll pass.

### Pitfall 3: Missing Parent/Children Component Definitions
**What goes wrong:** `buildEntity` throws an error stating "parent or children component definition missing".
**Why it happens:** The game engine does not have the `parent` or `children` ECS components registered before instantiating hierarchical items.
**How to avoid:** Ensure Phase 18 (Hierarchical Entity Foundation) completed registering these components.

## Code Examples

### Guaranteed + Chance Implementation in `reward-drop.ts`
```typescript
import RNG from 'rot-js/lib/rng';

// Inside createRewardDropSystem...
if (lootTable) {
  const drops = [...lootTable.drops];
  const tier = lootTable.tier ?? 1;

  // D-02: Guaranteed drop for Elite/Boss (tier 2 or 3)
  if (tier >= 2 && drops.length > 0) {
    // Pick 1 guaranteed item
    const guaranteedIndex = Math.floor(RNG.getUniform() * drops.length);
    const drop = drops[guaranteedIndex];
    const itemId = entityFactory.create(w, drop.template, componentRegistry, { position: { x: pos.x, y: pos.y } });
    grid.addItem(itemId, pos.x, pos.y);
    
    // Remove it from the chance pool
    drops.splice(guaranteedIndex, 1);
  }

  // Roll for remaining equipment chances
  for (const drop of drops) {
    if (RNG.getUniform() < drop.chance) {
      const itemId = entityFactory.create(w, drop.template, componentRegistry, { position: { x: pos.x, y: pos.y } });
      grid.addItem(itemId, pos.x, pos.y);
    }
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/game/systems/reward-drop.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LMC-01 | Tier 2+ enemies always drop 1 guaranteed item + chances for others | unit | `npx vitest run src/game/systems/reward-drop.test.ts` | ❌ Wave 0 |
| LMC-01 | Drop mechanics utilize `rot-js` RNG for determinism | unit | `npx vitest run src/game/systems/reward-drop.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/game/systems/reward-drop.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/game/systems/reward-drop.test.ts` — covers LMC-01 (Guaranteed drops and ROT.RNG usage). Existing drop logic doesn't appear to be fully tested directly as a system test, or missing mocking for ROT.RNG. (Need to mock `rot-js/lib/rng` instead of `Math.random()`).

## Sources

### Primary (HIGH confidence)
- `src/game/systems/reward-drop.ts` - Drop system core logic mapping
- `src/engine/entity/builder.ts` - Entity factory hierarchical resolution
- `src/shared/components/loot-table.ts` - Zod schema confirming `tier` usage.

### Secondary (MEDIUM confidence)
- N/A

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Directly observed dependencies (`rot-js`).
- Architecture: HIGH - Fully aligned with current entity generation patterns.
- Pitfalls: HIGH - Spotted exact lines needing replacement and existing factory boundaries.

**Research date:** 2026-05-16
**Valid until:** 2026-06-16
