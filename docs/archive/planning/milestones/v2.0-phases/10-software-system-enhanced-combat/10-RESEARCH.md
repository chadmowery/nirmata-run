# Phase 10: Software System & Enhanced Combat - Research

**Researched:** 2026-03-30
**Domain:** Software consumable modifiers, damage pipeline architecture, DoT effects, rarity scaling
**Confidence:** HIGH

## Summary

Software consumables that "Burn" onto equipment slots provide run-scoped modifiers to combat calculations. The implementation extends existing Phase 7-9 patterns: Software entities are JSON templates with modifier definitions, the Burn mechanic is an action-pipeline mutation, and modifiers integrate into combat through a unified damage pipeline. The damage pipeline refactors from simple subtraction (attack - armor) to an ordered modifier list where Software effects, Augment payloads, and base stats all contribute sequentially.

The existing StatusEffects system from Phase 9 provides infrastructure for DoT effects (Bleed.exe), the equipment system handles slot validation and clearing on death, and the entity template system enables JSON-defined Software with rarity-tiered magnitude scaling. Run-scoped inventory is a new temporary data structure separate from the ECS World, cleared on death and transferred to Stash on extraction.

**Primary recommendation:** Extend the StatusEffects system for DoT, refactor combat damage calculation to use a modifier list pattern with explicit resolution order, create Software entity templates following the existing Firmware/Augment JSON pattern, and implement a RunInventory data structure outside the ECS to hold unburned Software.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Burn Mechanic:**
- **D-01:** Software Burns onto specific equipment pieces (weapon, armor) — not the Shell or Firmware directly. The modifier is scoped to what that equipment does.
- **D-02:** Software targets named slots on the Shell ("weapon", "armor") as burn targets. The slot is the anchor even if the underlying equipment entity is minimal/stub for Phase 10. Full equipment item entities come later.
- **D-03:** Software can be Burned **anytime during a run**, not just pre-run. Burning consumes the player's **full turn** (consistent with Vent costing a turn from Phase 8 D-16).
- **D-04:** Overwriting is allowed — player can Burn new Software over existing Software on a slot. The old Software is destroyed. Enables upgrading with better finds mid-run.
- **D-05:** Found Software goes into a **temporary run-scoped inventory** (5 slots max). Player chooses when to Burn. Unburned Software is lost on death, transferred to Stash on extraction.

**Rarity & Scaling:**
- **D-06:** 4 rarity tiers with **version-themed naming**: v0.x (common), v1.x (uncommon), v2.x (rare), v3.x (legendary).
- **D-07:** Linear magnitude scaling: v0.x = 1x, v1.x = 1.5x, v2.x = 2x, v3.x = 3x base effect value.
- **D-08:** v3.x (legendary) Software only drops from deep floors (10+) or Tier 3 enemies.

**Stacking Rules:**
- **D-09:** No duplicate Software types — each Software type can only be active once across all equipment slots. Forces build diversity.
- **D-10:** When multiple different Software effects trigger on the same action, all fire independently (additive, no conflicts). Consistent with Augment stacking (Phase 9 D-05).

**Damage Pipeline:**
- **D-11:** Damage calculation uses a **modifier list pattern** — collects all active modifiers (Software + Augments) into an ordered list. Each modifier transforms the damage value in sequence. Resolution order: base attack -> Software modifiers -> Augment payloads -> defense -> final damage.
- **D-12:** Software modifiers are **additive** (flat bonuses), not multiplicative. Predictable scaling, prevents runaway compounding.

**Starter Software Types:**
- **D-13:** Software has **typed slot restrictions** — offensive Software (Bleed.exe, Auto-Loader.msi) only burns onto weapons, defensive Software (Vampire.exe) only onto armor.
- **D-14:** **Auto-Loader.msi** allows the player to move AND use Firmware in the same turn (overrides the normal move-OR-act constraint from Phase 8 D-07). This is the premier offensive Software — dramatically increases action economy.
- **D-15:** **Vampire.exe** heal-on-kill triggers from any kill source (bump attacks and Firmware kills). Simple rule: if an enemy dies from your damage, you heal.
- **D-16:** **Bleed.exe** applies damage-over-time on physical attacks. DoT ticks at the target's turn start (consistent with Phase 9 D-03 status effect timing).

### Claude's Discretion

- Exact Zod schema shapes for SoftwareComponent, BurnedSoftware, RunInventory
- How "weapon" and "armor" slots are represented in the data model (extension of PortConfig, separate component, etc.)
- Bleed.exe DoT duration and base damage values
- Vampire.exe heal amount per kill by rarity
- Auto-Loader.msi interaction details (does it work with Vent? With targeting mode?)
- Run inventory UI representation (Phase 10 focuses on data model; full UI is Phase 15)
- Software purchase with Scrap at Neural Deck — stubbed for Phase 10, full implementation Phase 13

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOFT-01 | Software are consumable modifiers that can be "Burned" onto equipment | Burn mechanic uses action pipeline pattern from Phase 7 equipment system; software entities are JSON templates; BurnedSoftware component tracks burn-target slot reference |
| SOFT-02 | Software is lost on death but kept on extraction | Death clearing logic (pipeline.ts ENTITY_DIED handler) already clears SoftwareSlots; extraction pipeline transfers RunInventory to Stash |
| SOFT-03 | Software drops are common (high-frequency loot) from all enemy tiers | LootTable component supports drop chance configuration; all enemy templates include loot tables (see goblin.json pattern) |
| SOFT-04 | At least 3 Software types exist: Bleed.exe, Auto-Loader.msi, Vampire.exe | JSON entity templates define each Software type; AbilityDef-like component for Software configuration; StatusEffects system handles Bleed DoT |
| SOFT-05 | Multiple Software can stack on one item within Port slot limits | PortConfig.maxSoftware enforces slot limits; duplicate prevention logic in burn handler checks active Software types |
| SOFT-06 | Software comes in rarity tiers affecting magnitude | RarityTier component with linearScaleFactor property; Software templates include baseMagnitude scaled by rarity at runtime |
| SOFT-07 | Software can be purchased at Neural Deck or found during runs | Shop system stubbed (Phase 13 implementation); drop system already functional from Phase 1-6 loot tables |

</phase_requirements>

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Schema validation | Already used for all component schemas (defineComponent pattern); no additional dependencies needed |
| TypeScript | 6.0.2 | Type safety for modifier pipeline | Project standard, discriminated unions for Software types |
| json-diff-ts | current | State delta calculation | Already integrated in action pipeline for network reconciliation |

**Installation:**
```bash
# No new dependencies — Phase 10 uses existing stack
```

**Version verification:** All required libraries are already installed and verified in the project dependencies.

### Architecture Patterns (Existing)

Phase 10 builds entirely on established patterns from Phases 7-9:

- **ECS Components:** `defineComponent()` with Zod schemas (one per file in `src/shared/components/`)
- **JSON Entity Templates:** Software definitions follow `src/game/entities/templates/neural-spike.json` pattern
- **Action Pipeline:** Burn action processed through `src/shared/pipeline.ts` → `src/app/api/action/route.ts`
- **System Factory Pattern:** `createSoftwareSystem(world, grid, eventBus, ...)` returns `{ init(), dispose() }`
- **Event-Driven Logic:** GameplayEvents for SOFTWARE_BURNED, MODIFIER_APPLIED, etc.
- **Death Clearing:** ENTITY_DIED listener pattern already clears SoftwareSlots (pipeline.ts line 206)

## Architecture Patterns

### Recommended Project Structure

Software implementation fits into the existing architecture without new directories:

```
src/
├── shared/
│   ├── components/
│   │   ├── software-slots.ts          # ✓ EXISTS (holds equipped entity IDs)
│   │   ├── software-def.ts            # NEW (modifier type, magnitude, target slot)
│   │   ├── burned-software.ts         # NEW (tracks burn-target slot reference)
│   │   └── rarity-tier.ts             # NEW (tier enum, scale factor)
│   ├── systems/
│   │   └── equipment.ts               # ✓ EXISTS (extend for burn validation)
│   └── types.ts                       # EXTEND (BURN_SOFTWARE action schema)
├── game/
│   ├── systems/
│   │   ├── combat.ts                  # REFACTOR (modifier list pipeline)
│   │   ├── software.ts                # NEW (burn mechanic, modifier collection)
│   │   └── run-inventory.ts           # NEW (5-slot temporary inventory)
│   └── entities/templates/
│       ├── bleed-v0.json              # NEW (4 rarity variants per Software type)
│       ├── bleed-v1.json
│       ├── bleed-v2.json
│       ├── bleed-v3.json
│       ├── auto-loader-v0.json
│       ├── vampire-v0.json
│       └── ...                        # (12 total: 3 types × 4 rarities)
```

### Pattern 1: Modifier List Damage Pipeline

**What:** Refactor combat damage calculation from simple subtraction to a sequential modifier pipeline.

**When to use:** Any system where multiple sources contribute to a final numeric value (damage, healing, movement speed, etc.).

**Current Implementation (Phase 9 and earlier):**
```typescript
// Source: src/game/systems/combat.ts line 35-37
const armor = defenderDefense?.armor ?? 0;
const effectiveArmor = defenderHeat?.isVenting ? 0 : armor;
const damage = Math.max(1, attackerAttack.power - effectiveArmor);
```

**Upgraded Implementation (Phase 10):**
```typescript
// Pattern: Collect modifiers, apply in order, resolve final value
interface DamageModifier {
  source: string;          // "software:bleed", "augment:static-siphon"
  type: 'additive' | 'multiplicative';
  value: number;
  applyBefore?: 'defense'; // Ordering constraint
}

function resolveDamage(
  baseAttack: number,
  modifiers: DamageModifier[],
  defense: number
): number {
  let damage = baseAttack;

  // 1. Apply pre-defense modifiers (Software + Augments)
  const preDefense = modifiers.filter(m => m.applyBefore === 'defense');
  for (const mod of preDefense) {
    if (mod.type === 'additive') {
      damage += mod.value;
    } else {
      damage *= mod.value;
    }
  }

  // 2. Apply defense
  damage = Math.max(1, damage - defense);

  // 3. Apply post-defense modifiers (if any)
  const postDefense = modifiers.filter(m => !m.applyBefore);
  for (const mod of postDefense) {
    if (mod.type === 'additive') {
      damage += mod.value;
    } else {
      damage *= mod.value;
    }
  }

  return Math.max(1, Math.floor(damage));
}
```

**Why this pattern:**
- **Extensible:** Adding new modifier sources (future phases) requires no refactoring
- **Deterministic:** Explicit ordering prevents ambiguous interaction resolution
- **Debuggable:** Modifier list can be logged/inspected to trace damage calculation
- **Consistent:** Augment payloads and Software modifiers use the same infrastructure

### Pattern 2: Run-Scoped Temporary Inventory

**What:** A data structure outside the ECS World that holds unburned Software during a run, cleared on death, transferred to Stash on extraction.

**When to use:** When items need temporary storage with lifecycle rules different from ECS entities (which persist in the World until explicitly destroyed).

**Implementation:**
```typescript
// Source: Inferred from CONTEXT.md D-05 and existing equipment patterns
interface RunInventory {
  sessionId: string;
  maxSlots: 5;
  software: Array<{
    entityId: number;        // Reference to Software entity in World
    templateId: string;      // "bleed-v2", "auto-loader-v1"
    rarityTier: string;      // "v2.x"
    pickedUpAtFloor: number; // Metadata for UI
  }>;
}

// Stored in session state (like current ShellRegistry pattern from Phase 7)
// NOT stored as an ECS component on the player entity
```

**Why separate from ECS:**
- **Lifecycle independence:** RunInventory persists across floor transitions; ECS World might be recreated per floor
- **Death clearing semantics:** On ENTITY_DIED, RunInventory is cleared entirely; ECS entity destruction has different semantics
- **Extraction transfer:** Server needs to move RunInventory items to persistent Stash — easier when inventory is a standalone data structure
- **Consistent with ShellRegistry:** Phase 7 established that persistent/meta-run state lives outside the ECS (see CONTEXT.md D-07)

### Pattern 3: Burn Mechanic as Equipment Slot Mutation

**What:** Burning Software is an action that mutates a burn-target slot (weapon/armor) on the player entity, consuming a Software item from RunInventory.

**When to use:** Consumable application to equipment slots with validation rules (slot type restrictions, duplicate prevention, turn cost).

**Implementation:**
```typescript
// Action schema extension in src/shared/types.ts
export const BurnSoftwareActionSchema = z.object({
  type: z.literal('BURN_SOFTWARE'),
  runInventoryIndex: z.number().int().min(0).max(4),  // Which Software from RunInventory
  targetSlot: z.enum(['weapon', 'armor']),            // Where to burn it
});

// Pipeline handler in src/shared/pipeline.ts
function handleBurnSoftware(
  world: World<GameplayEvents>,
  eventBus: EventBus<GameplayEvents>,
  runInventory: RunInventory,
  playerId: EntityId,
  action: BurnSoftwareAction
): void {
  // 1. Validate RunInventory index
  const software = runInventory.software[action.runInventoryIndex];
  if (!software) {
    eventBus.emit('MESSAGE_EMITTED', { text: 'Invalid inventory slot', type: 'error' });
    return;
  }

  // 2. Check slot type restriction (D-13)
  const softwareDef = world.getComponent(software.entityId, SoftwareDef);
  if (softwareDef.targetSlot !== action.targetSlot) {
    eventBus.emit('MESSAGE_EMITTED', {
      text: `${softwareDef.name} can only burn onto ${softwareDef.targetSlot}`,
      type: 'error'
    });
    return;
  }

  // 3. Check for duplicate Software type (D-09)
  const existingBurned = getAllBurnedSoftware(world, playerId);
  if (existingBurned.some(s => s.type === softwareDef.type)) {
    eventBus.emit('MESSAGE_EMITTED', {
      text: `${softwareDef.type} already active`,
      type: 'error'
    });
    return;
  }

  // 4. Apply burn (D-04: overwriting allowed)
  const burnedSlot = world.getComponent(playerId, BurnedSoftware);
  burnedSlot[action.targetSlot] = software.entityId;

  // 5. Remove from RunInventory (consumed)
  runInventory.software.splice(action.runInventoryIndex, 1);

  // 6. Emit success
  eventBus.emit('SOFTWARE_BURNED', {
    entityId: playerId,
    softwareId: software.entityId,
    targetSlot: action.targetSlot
  });
  eventBus.emit('MESSAGE_EMITTED', {
    text: `Burned ${softwareDef.name} onto ${action.targetSlot}`,
    type: 'info'
  });
}
```

**Why this pattern:**
- **Reuses equipment system validation:** Slot type checking, Port limit enforcement already exist
- **Follows Phase 8 turn cost pattern:** Burn action processed through TurnManager.submitAction() just like VENT (D-03)
- **Enables overwriting naturally:** Setting `burnedSlot[targetSlot] = newEntityId` replaces previous value (D-04)
- **Server-authoritative:** Action goes through pipeline → server → reconciliation, preventing client-side cheating

### Pattern 4: DoT Effect Reusing StatusEffects System

**What:** Bleed.exe applies a status effect using the existing StatusEffects component and system from Phase 9.

**When to use:** Any Software that applies a timed effect (debuffs, buffs, DoT, periodic triggers).

**Implementation:**
```typescript
// Bleed.exe applies DoT on physical attack hit
function applyBleedOnHit(
  world: World<GameplayEvents>,
  statusEffectSystem: StatusEffectSystem,
  attackerId: EntityId,
  defenderId: EntityId
): void {
  // Check if attacker has Bleed.exe burned
  const burnedSoftware = world.getComponent(attackerId, BurnedSoftware);
  if (!burnedSoftware?.weapon) return;

  const weaponSoftware = world.getComponent(burnedSoftware.weapon, SoftwareDef);
  if (weaponSoftware?.type !== 'bleed') return;

  // Calculate DoT damage based on rarity
  const rarity = world.getComponent(burnedSoftware.weapon, RarityTier);
  const baseDamage = 2;  // Agent's discretion (Claude's Discretion)
  const scaledDamage = baseDamage * rarity.scaleFactor;  // v0:2, v1:3, v2:4, v3:6

  // Apply status effect
  statusEffectSystem.applyEffect(defenderId, {
    name: 'BLEED',
    duration: 3,  // Agent's discretion (Claude's Discretion)
    magnitude: scaledDamage,
    source: `software:bleed-${rarity.tier}`
  });
}

// DoT tick happens in StatusEffectSystem.tickDown (already implemented Phase 9)
// Combat damage on BLEED tick:
eventBus.on('STATUS_EFFECT_TICK', (payload) => {
  if (payload.effectName === 'BLEED') {
    const health = world.getComponent(payload.entityId, Health);
    if (health) {
      health.current = Math.max(0, health.current - payload.magnitude);
      if (health.current === 0) {
        handleDeath(payload.entityId, payload.sourceEntityId);
      }
    }
  }
});
```

**Why reuse StatusEffects:**
- **Already handles tick timing:** Phase 9 D-03 defines effects tick at turn start — Bleed follows this (D-16)
- **Already handles stacking:** Phase 9 D-01 allows concurrent effect instances — multiple Bleeds can coexist
- **Already handles expiration:** Phase 9 system emits STATUS_EFFECT_EXPIRED, cleans up automatically
- **No new infrastructure needed:** Just add Bleed-specific logic to existing tick handler

### Anti-Patterns to Avoid

- **Storing RunInventory as ECS component:** RunInventory has different lifecycle semantics than ECS entities; mixing concerns leads to complex death/extraction logic
- **Multiplicative Software modifiers:** D-12 explicitly requires additive modifiers to prevent exponential scaling; violating this creates balance nightmares
- **Allowing duplicate Software types:** D-09 prevents this to force build diversity; ignoring this rule makes optimal builds trivial
- **Processing Software modifiers after defense:** D-11 defines explicit ordering (before defense); changing this breaks balance assumptions
- **Hardcoding Software effect logic:** Use JSON templates with SoftwareDef component; hardcoding makes adding new Software require code changes instead of just JSON files

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DoT tick timing and stacking | Custom tick-down system for Bleed | StatusEffects system from Phase 9 | Already handles turn-based tick timing (D-03), concurrent stacking (D-01), expiration events, and magnitude calculation (D-07) — reinventing this creates duplicate logic and bugs |
| Equipment slot validation | Custom burn validation logic | Extend existing `handleEquip` pattern from `src/shared/systems/equipment.ts` | Slot limit enforcement, type checking, and error messaging already exist for Firmware/Augments — Software follows the same rules |
| Death clearing on failed run | Custom death handler for burned Software | Existing ENTITY_DIED listener in `src/shared/pipeline.ts` (line 196) | Already clears FirmwareSlots, AugmentSlots, SoftwareSlots on death — just extend to also clear RunInventory |
| Rarity-based scaling calculations | Runtime multiplication in damage logic | Pre-calculated scale factors in RarityTier component | Linear scale factors (1x, 1.5x, 2x, 3x from D-07) can be stored as constants in JSON templates, avoiding repeated calculations and magic numbers scattered in code |
| Software drop probability | Custom loot roll logic | Existing LootTable component and drop system | Phase 1-6 already handle loot drops with configurable probabilities — Software templates just need LootTable entries with appropriate drop chances (high-frequency per SOFT-03) |

**Key insight:** Phases 7-9 built all the infrastructure Phase 10 needs. The planner should focus on **connecting existing systems** (StatusEffects + damage pipeline + equipment slots + loot tables) rather than building new infrastructure. The only genuinely new code is: SoftwareDef component schema, BurnedSoftware component for tracking burn-target slots, RunInventory data structure, and damage modifier collection logic.

## Runtime State Inventory

> Phase 10 is a greenfield implementation (not a rename/refactor), so this section is omitted.

## Common Pitfalls

### Pitfall 1: Forgetting to Check Duplicate Software Types Across All Slots

**What goes wrong:** Player burns the same Software type onto both weapon and armor, breaking the D-09 rule that each Software type can only be active once.

**Why it happens:** The duplicate check only looks at the target slot being burned, not all burned Software across all slots.

**How to avoid:**
```typescript
// WRONG: Only checks target slot
if (burnedSlot[targetSlot]?.type === newSoftware.type) {
  return 'duplicate';
}

// CORRECT: Checks all burned slots
function getAllBurnedSoftware(world: World, entityId: EntityId): SoftwareDef[] {
  const burned = world.getComponent(entityId, BurnedSoftware);
  const allSoftware = [];
  if (burned.weapon) allSoftware.push(world.getComponent(burned.weapon, SoftwareDef));
  if (burned.armor) allSoftware.push(world.getComponent(burned.armor, SoftwareDef));
  return allSoftware.filter(Boolean);
}

const existing = getAllBurnedSoftware(world, playerId);
if (existing.some(s => s.type === newSoftware.type)) {
  return 'duplicate type already active';
}
```

**Warning signs:** Playtesting reveals players can stack Bleed on weapon + armor, or Auto-Loader appears twice.

---

### Pitfall 2: Applying Software Modifiers After Defense Instead of Before

**What goes wrong:** D-11 explicitly defines resolution order: base attack → Software modifiers → defense → final damage. Applying Software modifiers after defense breaks balance (e.g., +5 damage modifier becomes more valuable because it bypasses armor).

**Why it happens:** Natural intuition is to calculate base damage (attack - defense) first, then apply modifiers as a final step.

**How to avoid:**
```typescript
// WRONG: Modifiers applied after defense
const baseDamage = Math.max(1, attack - defense);
const modifiedDamage = baseDamage + softwareBonus;

// CORRECT: Modifiers applied before defense
let damage = attack;
damage += softwareBonus;  // Software modifiers first
damage = Math.max(1, damage - defense);  // Then defense
```

**Warning signs:** Balance testing shows Software modifiers are too strong against high-armor enemies, or too weak against low-armor enemies (they should be consistent because they apply before armor calculation).

---

### Pitfall 3: RunInventory Persisting After Death

**What goes wrong:** Player dies, but RunInventory is not cleared, so they keep unburned Software for the next run (violates SOFT-02 and D-05).

**Why it happens:** RunInventory is separate from the ECS World (which is recreated each run), so death clearing logic must explicitly handle it.

**How to avoid:**
```typescript
// In death handler
eventBus.on('ENTITY_DIED', (payload) => {
  if (payload.entityId === playerId) {
    // Clear ECS equipment slots (already exists)
    clearEquipmentSlots(world, playerId);

    // ALSO clear RunInventory (new for Phase 10)
    runInventory.software = [];

    eventBus.emit('RUN_INVENTORY_CLEARED', { reason: 'death' });
  }
});

// On extraction
function handleExtraction(runInventory: RunInventory, stash: Stash) {
  // Transfer RunInventory to Stash
  for (const software of runInventory.software) {
    stash.addItem(software);
  }

  // Then clear RunInventory
  runInventory.software = [];

  eventBus.emit('RUN_INVENTORY_CLEARED', { reason: 'extraction' });
}
```

**Warning signs:** Integration test fails: player dies with 3 Software in RunInventory, starts new run, RunInventory still has 3 items.

---

### Pitfall 4: Not Scaling Bleed DoT Damage by Rarity

**What goes wrong:** Bleed.exe v3.x (legendary) applies the same DoT damage as v0.x (common), making rarity meaningless for Bleed.

**Why it happens:** DoT application code reads base damage from SoftwareDef but forgets to multiply by RarityTier.scaleFactor.

**How to avoid:**
```typescript
// WRONG: Ignores rarity scaling
const bleedDef = world.getComponent(softwareEntityId, SoftwareDef);
statusEffectSystem.applyEffect(defenderId, {
  name: 'BLEED',
  magnitude: bleedDef.baseDamage  // Always 2, regardless of rarity
});

// CORRECT: Applies rarity scaling
const bleedDef = world.getComponent(softwareEntityId, SoftwareDef);
const rarity = world.getComponent(softwareEntityId, RarityTier);
const scaledDamage = bleedDef.baseDamage * rarity.scaleFactor;  // v0:2, v3:6
statusEffectSystem.applyEffect(defenderId, {
  name: 'BLEED',
  magnitude: scaledDamage
});
```

**Warning signs:** Player equips Bleed v3.x, observes DoT ticks deal 2 damage per turn (same as v0.x).

---

### Pitfall 5: Auto-Loader.msi Breaking Turn Manager State

**What goes wrong:** D-14 says Auto-Loader.msi allows "move AND use Firmware in the same turn." Naïve implementation lets player move, then press a Firmware hotkey, which submits a second action to TurnManager, causing state machine violation (TurnManager expects one action per turn).

**Why it happens:** Auto-Loader's "break the rules" design creates a special case that normal action submission doesn't handle.

**How to avoid:**

**Option A: Composite Action (Recommended)**
```typescript
// New action type: MOVE_AND_USE_FIRMWARE
export const MoveAndUseFirmwareActionSchema = z.object({
  type: z.literal('MOVE_AND_USE_FIRMWARE'),
  dx: z.number(),
  dy: z.number(),
  firmwareSlotIndex: z.number().int().min(0).max(2),
  targetX: z.number().int(),
  targetY: z.number().int(),
});

// Pipeline processes both atomically
function handleMoveAndUseFirmware(action) {
  handleMove(action.dx, action.dy);
  handleUseFirmware(action.firmwareSlotIndex, action.targetX, action.targetY);
  // One action submission, two effects
}
```

**Option B: Turn Extension Flag (Alternative)**
```typescript
// After move completes, check for Auto-Loader
if (hasBurnedSoftware(playerId, 'auto-loader')) {
  turnManager.allowBonusAction();  // Extends current turn
}

// Input manager checks if bonus action available before submitting Firmware action
```

**Warning signs:** Integration test fails: player with Auto-Loader moves, then presses Firmware hotkey, gets error "action already submitted this turn."

---

### Pitfall 6: Vampire.exe Not Triggering on Firmware Kills

**What goes wrong:** D-15 says Vampire.exe heal-on-kill triggers from "any kill source (bump attacks and Firmware kills)." Implementation only checks for heal trigger in the bump attack handler, missing Firmware kills.

**Why it happens:** Heal trigger logic is coupled to the BUMP_ATTACK event instead of the ENTITY_DIED event.

**How to avoid:**
```typescript
// WRONG: Trigger in bump attack handler
eventBus.on('BUMP_ATTACK', (payload) => {
  // ... damage calculation ...
  if (defenderHealth.current <= 0) {
    handleDeath(defenderId, attackerId);

    // Vampire heal trigger here — but misses Firmware kills!
    if (hasBurnedSoftware(attackerId, 'vampire')) {
      healPlayer(attackerId);
    }
  }
});

// CORRECT: Trigger in death handler (universal)
eventBus.on('ENTITY_DIED', (payload) => {
  const { entityId: victimId, killerId } = payload;

  // Vampire heal trigger — fires for ANY kill source
  if (hasBurnedSoftware(killerId, 'vampire')) {
    const rarity = getBurnedSoftwareRarity(killerId, 'vampire');
    const healAmount = 5 * rarity.scaleFactor;  // Agent's discretion
    healPlayer(killerId, healAmount);
  }
});
```

**Warning signs:** Integration test fails: player with Vampire.exe equipped kills enemy with Neural_Spike.exe, no heal occurs.

## Code Examples

Verified patterns from existing codebase and phase context:

### Software Entity Template (JSON)

```json
{
  "name": "bleed_v2",
  "components": {
    "softwareDef": {
      "name": "Bleed.exe",
      "type": "bleed",
      "targetSlot": "weapon",
      "baseMagnitude": 2,
      "effectType": "dot",
      "description": "Apply bleeding DoT on physical attacks."
    },
    "rarityTier": {
      "tier": "v2.x",
      "scaleFactor": 2.0,
      "minFloor": 5
    },
    "item": {
      "stackable": false
    }
  }
}
```

**Pattern:** Follows Phase 8 Firmware template structure (`src/game/entities/templates/neural-spike.json`). Each rarity variant is a separate JSON file (12 total: 3 Software types × 4 rarity tiers).

---

### Damage Modifier Collection

```typescript
// Source: Inferred from D-11 and Phase 9 Augment payload resolution pattern
function collectDamageModifiers(
  world: World<GameplayEvents>,
  attackerId: EntityId,
  action: 'attack' | 'firmware'
): DamageModifier[] {
  const modifiers: DamageModifier[] = [];

  // 1. Collect Software modifiers
  const burnedSoftware = world.getComponent(attackerId, BurnedSoftware);
  if (burnedSoftware?.weapon) {
    const softwareDef = world.getComponent(burnedSoftware.weapon, SoftwareDef);
    const rarity = world.getComponent(burnedSoftware.weapon, RarityTier);

    if (softwareDef.effectType === 'damage_boost') {
      modifiers.push({
        source: `software:${softwareDef.type}`,
        type: 'additive',
        value: softwareDef.baseMagnitude * rarity.scaleFactor,
        applyBefore: 'defense'
      });
    }
  }

  // 2. Collect Augment payload modifiers (Phase 9 system)
  const augmentModifiers = augmentSystem.collectPayloads(attackerId, {
    trigger: action === 'attack' ? 'ON_BUMP_ATTACK' : 'ON_FIRMWARE_HIT'
  });
  modifiers.push(...augmentModifiers);

  return modifiers;
}
```

**Pattern:** Centralized modifier collection function called from combat resolution. Returns flat array of modifiers with explicit ordering constraints.

---

### RunInventory Data Structure

```typescript
// Source: Inferred from D-05 and Phase 7 ShellRegistry pattern
interface RunInventory {
  sessionId: string;
  maxSlots: number;  // 5 per D-05
  software: Array<{
    entityId: number;        // Reference to Software entity in World
    templateId: string;      // "bleed-v2"
    rarityTier: string;      // "v2.x"
    pickedUpAtFloor: number;
    pickedUpAtTimestamp: number;  // For UI sorting
  }>;
}

class RunInventoryRegistry {
  private inventories: Map<string, RunInventory> = new Map();

  getOrCreate(sessionId: string): RunInventory {
    if (!this.inventories.has(sessionId)) {
      this.inventories.set(sessionId, {
        sessionId,
        maxSlots: 5,
        software: []
      });
    }
    return this.inventories.get(sessionId)!;
  }

  clear(sessionId: string): void {
    this.inventories.delete(sessionId);
  }
}
```

**Pattern:** Follows Phase 7 ShellRegistry pattern (lives outside ECS, session-scoped, server-managed).

---

### Burn Action Handler

```typescript
// Source: Inferred from D-03, D-04, and existing equipment.ts pattern
function handleBurnSoftware(
  world: World<GameplayEvents>,
  eventBus: EventBus<GameplayEvents>,
  runInventory: RunInventory,
  playerId: EntityId,
  action: BurnSoftwareAction
): void {
  // 1. Validate inventory slot
  if (action.runInventoryIndex >= runInventory.software.length) {
    eventBus.emit('MESSAGE_EMITTED', { text: 'Invalid inventory slot', type: 'error' });
    return;
  }

  const software = runInventory.software[action.runInventoryIndex];
  const softwareDef = world.getComponent(software.entityId, SoftwareDef);

  // 2. Check slot type restriction (D-13)
  if (softwareDef.targetSlot !== action.targetSlot) {
    eventBus.emit('MESSAGE_EMITTED', {
      text: `Cannot burn ${softwareDef.name} onto ${action.targetSlot}`,
      type: 'error'
    });
    return;
  }

  // 3. Check for duplicate type across all slots (D-09)
  const existingBurned = getAllBurnedSoftwareTypes(world, playerId);
  if (existingBurned.includes(softwareDef.type)) {
    eventBus.emit('MESSAGE_EMITTED', {
      text: `${softwareDef.type} already active`,
      type: 'error'
    });
    return;
  }

  // 4. Apply burn — overwrites existing Software on slot (D-04)
  let burnedSlot = world.getComponent(playerId, BurnedSoftware);
  if (!burnedSlot) {
    world.addComponent(playerId, BurnedSoftware, { weapon: null, armor: null });
    burnedSlot = world.getComponent(playerId, BurnedSoftware)!;
  }

  // Destroy old Software if overwriting
  if (burnedSlot[action.targetSlot]) {
    world.destroyEntity(burnedSlot[action.targetSlot]);
  }

  burnedSlot[action.targetSlot] = software.entityId;

  // 5. Remove from RunInventory (consumed)
  runInventory.software.splice(action.runInventoryIndex, 1);

  // 6. Emit events
  eventBus.emit('SOFTWARE_BURNED', {
    entityId: playerId,
    softwareId: software.entityId,
    targetSlot: action.targetSlot
  });

  eventBus.emit('MESSAGE_EMITTED', {
    text: `Burned ${softwareDef.name} onto ${action.targetSlot}`,
    type: 'info'
  });
}
```

**Pattern:** Action handler in pipeline.ts (like handleEquip, handleMove). Validates before mutating, emits events after success.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple damage calculation (attack - armor) | Modifier list pipeline with explicit ordering | Phase 10 | Enables extensible combat system where Software, Augments, and future systems (equipment stats, temporary buffs) all contribute to damage through a unified pipeline |
| Equipment slots only track Firmware/Augments | Equipment slots + burn-target slots (weapon/armor) | Phase 10 | Separates "permanent" loadout items (Firmware/Augments in Shell ports) from "consumable" modifiers (Software burned onto equipment) — different death/extraction rules |
| Loot drops are health potions and placeholder items | Loot drops include high-frequency Software consumables | Phase 10 | Shifts loot from sparse+valuable to abundant+tactical (D-03 says Software drops are "common/high-frequency") — creates constant triage decisions |
| Rarity is cosmetic/undefined | Rarity directly affects magnitude via linear scale factors | Phase 10 | Makes rarity mechanically meaningful (v3.x Bleed deals 3× DoT damage of v0.x) — not just a visual/name distinction |

**Deprecated/outdated:**

None — Phase 10 extends existing systems without deprecating prior patterns.

## Open Questions

1. **Bleed.exe DoT duration and base damage values**
   - What we know: Bleed applies DoT on physical attacks (D-16), ticks at target's turn start (Phase 9 D-03), scales by rarity (D-07)
   - What's unclear: Exact base damage (suggested 2) and duration (suggested 3 turns) — these are tuning parameters
   - Recommendation: Start with baseDamage=2, duration=3 turns. Playtest feedback will determine if adjustments needed. Document as "tunable constants" in SoftwareDef JSON templates.

2. **Vampire.exe heal amount per kill by rarity**
   - What we know: Heals on any kill (D-15), scales by rarity (D-07)
   - What's unclear: Base heal amount for v0.x (suggested 5 HP)
   - Recommendation: Start with baseHeal=5. At v3.x (3× multiplier), this yields 15 HP per kill — significant but not overpowered given that kills are gated by enemy encounters. Document in vampire-v0.json template.

3. **Auto-Loader.msi interaction with Vent**
   - What we know: Auto-Loader allows move + Firmware in one turn (D-14), Vent costs a full turn (Phase 8 D-16)
   - What's unclear: Can Auto-Loader enable move + Vent in one turn? This would be very powerful (reposition while rapidly cooling).
   - Recommendation: **No** — Vent is not a Firmware ability, it's a special action. Auto-Loader's description says "move and use Firmware" specifically. Keep Vent as full-turn-cost even with Auto-Loader. Document in Auto-Loader JSON description: "Does not apply to Vent action."

4. **Software purchase stubbing approach**
   - What we know: SOFT-07 requires purchase option, but full economy system is Phase 13
   - What's unclear: How much stub implementation is needed in Phase 10 vs. deferring entirely to Phase 13
   - Recommendation: Phase 10 should create the `purchaseCost` field in SoftwareDef JSON templates (e.g., "cost": 50 Scrap). Phase 13 will implement the actual purchase transaction. No purchase UI or handler logic in Phase 10 — just the data model.

## Environment Availability

> Phase 10 has no external dependencies beyond the existing Node.js/TypeScript/npm stack. All implementation is code and JSON templates. No database, CLI tools, or services required beyond what's already verified in Phases 7-9.

**Environment audit:** SKIPPED (no new external dependencies)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.8 |
| Config file | vitest.config.ts |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOFT-01 | Software burns onto equipment slots consuming a turn | integration | `npm run test -- src/game/systems/software.test.ts -t "burn mechanic" --run` | ❌ Wave 0 |
| SOFT-02 | Software cleared on death, kept on extraction | integration | `npm run test -- src/shared/pipeline.test.ts -t "death clearing" --run` | ❌ Wave 0 |
| SOFT-03 | Software drops from enemy loot tables | integration | `npm run test -- src/game/systems/combat.test.ts -t "software loot drops" --run` | ❌ Wave 0 |
| SOFT-04 | Bleed DoT, Auto-Loader action economy, Vampire heal-on-kill | integration | `npm run test -- src/game/systems/software.test.ts -t "starter software effects" --run` | ❌ Wave 0 |
| SOFT-05 | Multiple Software stack within port limits, no duplicates | unit | `npm run test -- src/game/systems/software.test.ts -t "stacking rules" --run` | ❌ Wave 0 |
| SOFT-06 | Rarity tiers scale magnitude correctly | unit | `npm run test -- src/shared/components/software-def.test.ts -t "rarity scaling" --run` | ❌ Wave 0 |
| SOFT-07 | Software purchase cost defined in templates | unit | `npm run test -- src/game/entities/templates/software.test.ts -t "purchase cost" --run` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- src/game/systems/software.test.ts --run` (software-specific tests, ~5-10 seconds)
- **Per wave merge:** `npm run test -- --run` (full suite excluding coverage, ~30 seconds)
- **Phase gate:** `npm run test -- --run --coverage` (full suite with coverage report) before `/gsd:verify-work`

### Wave 0 Gaps

Phase 10 introduces new test files:

- [ ] `src/game/systems/software.test.ts` — covers SOFT-01, SOFT-04, SOFT-05 (burn mechanic, starter Software effects, stacking rules)
- [ ] `src/shared/components/software-def.test.ts` — covers SOFT-06 (rarity scaling calculations)
- [ ] `src/game/entities/templates/software.test.ts` — covers SOFT-07 (template validation, purchase cost presence)
- [ ] Extend `src/shared/pipeline.test.ts` — covers SOFT-02 (death clearing, extraction transfer)
- [ ] Extend `src/game/systems/combat.test.ts` — covers SOFT-03 (loot drop integration), refactored damage pipeline

**Test infrastructure status:** Vitest framework already configured and functional (Phase 7-9 tests exist). No framework installation needed.

**Shared fixtures needed:**
- Mock RunInventory factory
- Mock Software entity templates (lightweight v0.x variants for each type)
- Extended combat test fixtures to include BurnedSoftware component

## Sources

### Primary (HIGH confidence)

- **Existing codebase:**
  - `src/shared/components/status-effects.ts` — StatusEffects component schema and system (Phase 9)
  - `src/game/systems/combat.ts` — Current damage calculation pattern (lines 35-37)
  - `src/shared/systems/equipment.ts` — Equipment slot validation pattern
  - `src/shared/pipeline.ts` — Death clearing pattern (lines 196-210), action processing pattern
  - `src/game/entities/templates/neural-spike.json` — Firmware JSON template pattern
  - `src/shared/types.ts` — ActionIntent schema extension pattern

- **Phase context documents (user decisions):**
  - `.planning/phases/10-software-system-enhanced-combat/10-CONTEXT.md` — All implementation decisions (D-01 through D-16)
  - `.planning/phases/07-shell-equipment-data-model/07-CONTEXT.md` — Port architecture, equipment slot decisions
  - `.planning/phases/08-firmware-neural-heat-system/08-CONTEXT.md` — Firmware activation flow, turn cost patterns
  - `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md` — Status effect timing, stacking rules, payload resolution

- **Requirements:**
  - `.planning/REQUIREMENTS.md` — SOFT-01 through SOFT-07 (verified against context decisions)

### Secondary (MEDIUM confidence)

- **Training data knowledge (January 2025):**
  - Modifier list pattern for damage calculation — standard in roguelikes and RPGs (e.g., Slay the Spire, Hades)
  - DoT stacking approaches — concurrent instances vs. refresh duration (concurrent is standard in ARPGs like Path of Exile)
  - Rarity scaling systems — linear vs. exponential (linear is more predictable for players, matches D-07 decision)
  - Run-scoped inventory patterns — seen in roguelikes with extraction mechanics (Tarkov, Hunt: Showdown)

**Note:** All design patterns recommended align with user decisions in CONTEXT.md. No external web sources needed — phase decisions provide complete specification.

### Tertiary (LOW confidence)

None — no unverified web research used.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified
- Architecture: HIGH - Extends established Phase 7-9 patterns without new infrastructure
- Pitfalls: HIGH - Derived from explicit decision constraints and common ECS/roguelike development pitfalls
- Code examples: HIGH - Based on existing codebase patterns and user decisions
- Open questions: MEDIUM - Tuning parameters left to agent discretion per CONTEXT.md

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days — stable domain, no fast-moving dependencies)

---

*Research complete. Ready for planning.*
