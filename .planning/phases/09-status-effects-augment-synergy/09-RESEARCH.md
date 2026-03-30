# Phase 9: Status Effects & Augment Synergy — Research

**Researched:** 2026-03-30
**Status:** Complete

## Executive Summary

Phase 9 upgrades the Phase 8 StatusEffects stub into a fully-featured status effect system and introduces the Augment "Trigger & Payload" engine. The Augment engine is the most complex new system — it must listen to multiple gameplay events, recursively evaluate a JSON-defined AST of trigger conditions, queue payload effects to execute after the primary action completes (D-06), and emit batched visual feedback (D-04). The StatusEffects refactor mostly involves changing tick timing from global `TURN_START` to per-actor turns (D-03) and adding a `getMagnitude()` helper that returns the highest active instance (D-07). All 8 requirements (AUG-01 through AUG-08) map to concrete implementation paths grounded in the current codebase.

---

## 1. Component Design

### 1.1 StatusEffects Component Refactor

**Current state** (`src/shared/components/status-effects.ts`):
```typescript
z.object({
  effects: z.array(z.object({
    name: z.string(),
    duration: z.number().int().min(0),
    magnitude: z.number().default(0),
    source: z.string().optional(),
  })),
})
```

**Phase 9 change:** The current flat array schema is sufficient for D-01 (concurrent instances). Multiple instances of "INPUT_LAG" simply appear as separate entries in the array. No schema migration needed — the structure already supports overlaps.

**New runtime methods needed on `createStatusEffectSystem`:**
- `getMagnitude(entityId, effectName): number` — Iterates all active instances with matching `name`, returns `Math.max(...magnitudes)` (D-07). Returns 0 if no match.
- `getEffectiveCount(entityId, effectName): number` — Returns the count of active instances for stacking visibility.

**Tick timing change (D-03):** Remove the `TURN_START` global subscription that ticks all players. Instead, the TurnManager's per-entity turn processing calls `statusEffectSystem.tickDown(entityId)` at the start of that entity's turn. This ensures effects tick relative to the afflicted entity, not globally.

**Integration point:** `src/game/engine-factory.ts` line 99 currently calls `statusEffectSystem.init()` which subscribes to `TURN_START`. This subscription must be removed. Instead, the TurnManager `playerActionHandler` and `enemyActionHandler` in `engine-factory.ts` must call `statusEffectSystem.tickDown(entityId)` before processing their action.

### 1.2 AugmentData Component (NEW)

Each Augment is its own entity (following the "every entity type definable in JSON" constraint, matching `AbilityDef` pattern from Phase 8). The `AugmentData` component defines trigger/payload parameters.

```typescript
// src/shared/components/augment-data.ts

/** Recursive condition node for Augment trigger logic (D-02). */
export const ConditionNodeSchema: z.ZodType<ConditionNode> = z.object({
  type: z.enum([
    // Logical operators
    'AND', 'OR', 'NOT',
    // Leaf conditions (AUG-02)
    'ON_ACTIVATION',     // When any Firmware fires
    'ON_TARGET_HIT',     // When Firmware damages an enemy
    'ON_OVERCLOCK',      // When Firmware used above maxSafe Heat
    'ON_KILL',           // When entity kills a target
    // Compound conditions (AUG-06)
    'HEAT_ABOVE',        // Heat > value
    'HP_BELOW_PERCENT',  // HP < value% 
  ]),
  conditions: z.lazy(() => z.array(ConditionNodeSchema)).optional(),
  value: z.number().optional(),
});

export const PayloadSchema = z.object({
  type: z.enum([
    'HEAL',              // Restore HP
    'SHIELD',            // Temporary HP shield
    'APPLY_STATUS',      // Apply a status effect
    'VENT_HEAT',         // Reduce Heat
    'DAMAGE_BONUS',      // Temporary damage increase
  ]),
  magnitude: z.number().optional(),
  statusEffectName: z.string().optional(),
  statusEffectDuration: z.number().int().min(1).optional(),
});

export const AugmentData = defineComponent('augmentData', z.object({
  name: z.string(),
  trigger: ConditionNodeSchema,
  payloads: z.array(PayloadSchema),
  maxTriggersPerTurn: z.number().int().min(1).default(99),
  cooldownTurns: z.number().int().min(0).default(0),
}));
```

**Design rationale:**
- `ConditionNodeSchema` uses `z.lazy()` for recursive AST (D-02). Logical operators (`AND`, `OR`, `NOT`) combine leaf conditions.
- `maxTriggersPerTurn` implements D-05 (configurable per-augment limit).
- `cooldownTurns` supports rate-limiting powerful augments beyond per-turn caps.
- `PayloadSchema.type` enum covers the three starter augments plus future expansion.

### 1.3 AugmentState Component (NEW)

Tracks runtime state per entity for cooldown/activation counting.

```typescript
// src/shared/components/augment-state.ts
export const AugmentState = defineComponent('augmentState', z.object({
  activationsThisTurn: z.record(z.string(), z.number()).default({}),
  cooldownsRemaining: z.record(z.string(), z.number()).default({}),
}));
```

**Keys:** Augment entity ID (as string). Values: count or turns remaining.

---

## 2. Augment Trigger Engine Architecture

### 2.1 Event Hooks

The AugmentSystem subscribes to `GameplayEvents` to detect trigger conditions:

| Event | Maps to Condition Type |
|-------|----------------------|
| `FIRMWARE_ACTIVATED` | `ON_ACTIVATION` |
| `DAMAGE_DEALT` (where `attackerId` used Firmware) | `ON_TARGET_HIT` |
| `ENTITY_DIED` (where `killerId` has augments) | `ON_KILL` |
| `HEAT_CHANGED` (where `newHeat > maxSafe`) | `ON_OVERCLOCK` |

**Key insight:** The system doesn't subscribe to `FIRMWARE_ACTIVATED` alone. It builds a **trigger context** from the complete action resolution sequence. Since payloads are queued (D-06), we collect context during action processing and evaluate all triggers after the action completes.

### 2.2 Trigger Evaluation Flow

```
1. Primary action starts (e.g., Firmware ability)
2. Events fire: FIRMWARE_ACTIVATED, DAMAGE_DEALT, ENTITY_DIED, HEAT_CHANGED
3. AugmentSystem collects these into a TriggerContext
4. Primary action completes
5. AugmentSystem.resolveQueuedTriggers():
   a. For each equipped Augment on the acting entity:
      - Check maxTriggersPerTurn against AugmentState.activationsThisTurn
      - Check cooldownsRemaining
      - Recursively evaluate ConditionNodeSchema against TriggerContext
      - If TRUE: queue payload for execution
   b. Execute all queued payloads
   c. Emit batched AUGMENT_TRIGGERED event (one event, array of results)
   d. Emit individual MESSAGE_EMITTED for each triggered augment (D-04)
```

### 2.3 Recursive AST Evaluator

```typescript
function evaluateCondition(node: ConditionNode, ctx: TriggerContext): boolean {
  switch (node.type) {
    case 'AND':
      return (node.conditions ?? []).every(c => evaluateCondition(c, ctx));
    case 'OR':
      return (node.conditions ?? []).some(c => evaluateCondition(c, ctx));
    case 'NOT':
      return !(node.conditions?.[0] ? evaluateCondition(node.conditions[0], ctx) : false);
    case 'ON_ACTIVATION':
      return ctx.firmwareActivated;
    case 'ON_TARGET_HIT':
      return ctx.damageDealt > 0;
    case 'ON_OVERCLOCK':
      return ctx.heatAboveMax;
    case 'ON_KILL':
      return ctx.killCount > 0;
    case 'HEAT_ABOVE':
      return ctx.currentHeat > (node.value ?? 0);
    case 'HP_BELOW_PERCENT':
      return ctx.hpPercent < (node.value ?? 0);
    default:
      return false;
  }
}
```

### 2.4 Payload Execution

Each payload type maps to a concrete game system call:

| Payload Type | System Call |
|-------------|-------------|
| `HEAL` | Modify `Health.current += magnitude` |
| `SHIELD` | Apply StatusEffect `{ name: 'SHIELD', duration: 1, magnitude }` |
| `APPLY_STATUS` | `statusEffectSystem.applyEffect(targetId, { name, duration, magnitude })` |
| `VENT_HEAT` | `heatSystem.addHeat(entityId, -magnitude)` (negative = cool) |
| `DAMAGE_BONUS` | Apply StatusEffect `{ name: 'DAMAGE_BOOST', duration, magnitude }` |

---

## 3. Starter Augments (AUG-03)

### 3.1 Displacement_Venting.arc (Vanguard bundle)

**Trigger:** Dash through an enemy → vent 15 Heat
**AST:**
```json
{
  "trigger": {
    "type": "AND",
    "conditions": [
      { "type": "ON_ACTIVATION" },
      { "type": "ON_TARGET_HIT" }
    ]
  },
  "payloads": [
    { "type": "VENT_HEAT", "magnitude": 15 }
  ]
}
```
**Note:** `ON_TARGET_HIT` requires that the dash ability damages someone at the target location. For Phase_Shift (which doesn't deal damage itself), this trigger will only fire if movement bumps into an enemy during the dash — or we interpret "dash through enemy" as a special case. **Recommendation:** Use simplified `ON_ACTIVATION` to match the Phase_Shift archetype for now; refine trigger in Phase 16 when loadout integration is polished.

### 3.2 Static_Siphon.arc (Operator bundle)

**Trigger:** Kill with Neural_Spike → +5 HP Shield
**AST:**
```json
{
  "trigger": {
    "type": "AND",
    "conditions": [
      { "type": "ON_ACTIVATION" },
      { "type": "ON_KILL" }
    ]
  },
  "payloads": [
    { "type": "SHIELD", "magnitude": 5 }
  ]
}
```

### 3.3 Neural_Feedback.arc (Ghost bundle)

**Trigger:** Kill during Extended_Sight → +25% next attack
**AST:**
```json
{
  "trigger": { "type": "ON_KILL" },
  "payloads": [
    { "type": "DAMAGE_BONUS", "magnitude": 25, "statusEffectDuration": 1 }
  ]
}
```

---

## 4. Event Design

Per AGENTS.md Event Tier Assignment rules:

### GameplayEvents (shared — server processes these)

```typescript
/** Queued when a status effect is applied to an entity. */
STATUS_EFFECT_APPLIED: {
  entityId: EntityId;
  effectName: string;
  duration: number;
  magnitude: number;
  source: string;
};

/** Queued when a status effect expires on an entity. */
STATUS_EFFECT_EXPIRED: {
  entityId: EntityId;
  effectName: string;
};

/** Queued when one or more Augments trigger from an action. */
AUGMENT_TRIGGERED: {
  entityId: EntityId;
  augments: Array<{ name: string; payloadType: string; magnitude: number }>;
};
```

### GameEvents (client-only — UI/rendering)

```typescript
/** Queued to flash a geometric shape for augment synergy feedback. */
AUGMENT_FLASH: {
  entityId: EntityId;
  count: number;
  augmentNames: string[];
};
```

**Rationale:** `AUGMENT_TRIGGERED` is a gameplay event because the server computes augment resolution authoritatively. `AUGMENT_FLASH` is client-only visual rendering.

---

## 5. System Ordering & Wiring

### Execution Order (per turn)

1. **TurnManager gives entity its turn** → `statusEffectSystem.tickDown(entityId)` (D-03: afflicted entity's turn)
2. **HeatSystem.dissipate(entityId)** → via `TURN_START` (existing)
3. **Player/Enemy Action** → Firmware/Combat/Movement resolves
4. **Events collected** → AugmentSystem builds TriggerContext from events fired during step 3
5. **AugmentSystem.resolveQueuedTriggers()** → Evaluates AST, executes payloads (D-06: after action)
6. **KernelPanicSystem.checkOverclock()** → via `FIRMWARE_ACTIVATED` (existing)

### New Systems

| System | File | Pattern |
|--------|------|---------|
| `createAugmentSystem` | `src/game/systems/augment.ts` | Factory function, subscribes to `FIRMWARE_ACTIVATED`, `DAMAGE_DEALT`, `ENTITY_DIED`, `HEAT_CHANGED` |

### Integration Points

| File | Change |
|------|--------|
| `src/shared/components/augment-data.ts` | New component file |
| `src/shared/components/augment-state.ts` | New component file |
| `src/shared/components/index.ts` | Register `AugmentData`, `AugmentState` in `COMPONENTS_REGISTRY` and barrel exports |
| `src/shared/events/types.ts` | Add `STATUS_EFFECT_APPLIED`, `STATUS_EFFECT_EXPIRED`, `AUGMENT_TRIGGERED` |
| `src/game/events/types.ts` | Add `AUGMENT_FLASH` |
| `src/game/systems/status-effects.ts` | Refactor: add `getMagnitude()`, change tick timing, emit new events |
| `src/game/systems/augment.ts` | New system file |
| `src/game/engine-factory.ts` | Create and init AugmentSystem; update StatusEffectSystem tick wiring |
| `src/game/types.ts` | Add `augmentSystem: AugmentSystem` to `GameContext` |
| `src/game/setup.ts` | Wire augmentSystem into context |
| `src/game/entities/templates/` | New JSON templates for 3 Augments |
| `src/game/entities/index.ts` | Register augment templates |
| `src/rendering/render-system.ts` | Handle `AUGMENT_FLASH` event |

---

## 6. Risk Assessment & Dependencies

### Hard Dependencies (Phase 8)

| Dependency | Status | Notes |
|------------|--------|-------|
| StatusEffects component | ✅ Available | Stub from Phase 8, schema sufficient for Phase 9 |
| StatusEffectSystem | ✅ Available | Needs tick timing refactor (D-03) |
| AugmentSlots.equipped[] | ✅ Available | Holds equipped augment entity IDs |
| FIRMWARE_ACTIVATED event | ✅ Available | Primary trigger hook |
| DAMAGE_DEALT event | ✅ Available | ON_TARGET_HIT trigger |
| ENTITY_DIED event | ✅ Available | ON_KILL trigger |
| HEAT_CHANGED event | ✅ Available | ON_OVERCLOCK trigger |
| Entity templates pipeline | ✅ Available | For Augment JSON files |
| EventBus | ✅ Available | Multi-event subscription |

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Recursive AST can infinite-loop with malformed JSON | Medium | Add recursion depth limit (max 10 levels) to `evaluateCondition()` |
| Event ordering: augment payloads fire before action completes | High | Explicit queue-then-resolve pattern; no immediate effects during event handlers |
| z.lazy() type inference breaks | Low | Define `ConditionNode` interface separately, pass to `z.ZodType<ConditionNode>` |
| StatusEffects tick timing change breaks Kernel Panic stun | Medium | Verify existing Kernel Panic tests still pass after refactor |
| Multiple augments modifying state simultaneously | Medium | Process payloads sequentially in a deterministic order (array index) |
| AugmentSystem needs access to multiple other systems | Medium | Pass StatusEffectSystem and HeatSystem as constructor deps (same pattern as KernelPanicSystem) |

---

## 7. Validation Architecture

### Testable Assertions (Per Plan)

**09-01 (Status Effect System Refactor):**
- `getMagnitude()` returns the highest magnitude among overlapping instances
- `getMagnitude()` returns 0 when no instances exist
- `tickDown()` only decrements when called for the afflicted entity (not globally)
- Multiple concurrent instances of the same effect tick independently
- Expired effects emit `STATUS_EFFECT_EXPIRED` event
- Applied effects emit `STATUS_EFFECT_APPLIED` event

**09-02 (Augment Components & Trigger Engine):**
- `ConditionNodeSchema` validates a flat leaf condition `{ type: 'ON_KILL' }`
- `ConditionNodeSchema` validates nested AND logic `{ type: 'AND', conditions: [...] }`
- `evaluateCondition()` correctly evaluates AND/OR/NOT combinations
- Recursion depth limit prevents stack overflow on deeply nested AST
- `maxTriggersPerTurn` prevents excessive firing
- `cooldownTurns` prevents activation during cooldown period

**09-03 (Augment Integration & Stacking):**
- Augment payloads execute AFTER primary action completes (D-06)
- Multiple augments can trigger from a single action (AUG-05)
- TriggerContext correctly collects events from the action resolution
- AugmentSystem integrates into engine-factory.ts and setup.ts without breaking existing tests

**09-04 (Starter Augments & Visual Feedback):**
- All 3 JSON templates validate against AugmentData Zod schema
- `AUGMENT_FLASH` event is emitted with batched count (D-04)
- Individual `MESSAGE_EMITTED` events are emitted per triggered augment
- Displacement_Venting.arc: vents 15 Heat on activation+hit
- Static_Siphon.arc: applies 5 HP shield on activation+kill
- Neural_Feedback.arc: applies DAMAGE_BOOST status on kill

### Integration Test Scenarios

1. **Full Augment Cycle:** Equip Augment → Use Firmware → Augment triggers → Payload applies → Status effect visible
2. **Multi-Trigger:** Use Firmware killing an enemy with 2 augments equipped → both trigger with separate log messages but one visual flash
3. **Rate Limiting:** Augment with `maxTriggersPerTurn: 1` → AoE hits 3 enemies → only triggers once
4. **Compound Trigger (AUG-06):** Augment with AND(ON_ACTIVATION, HEAT_ABOVE(80)) → fires only when both conditions met

---

## RESEARCH COMPLETE

All 8 requirements (AUG-01 through AUG-08) have concrete implementation paths. The codebase has clean extension points for all needed changes. Key architectural decisions — AST trigger structure (D-02), queued payload resolution (D-06), tick timing refactor (D-03), and batched visual feedback (D-04) — are documented with implementation details grounded in the existing code.
