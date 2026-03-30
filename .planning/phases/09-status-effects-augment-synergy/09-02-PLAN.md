---
wave: 2
depends_on: ["09-01"]
files_modified:
  - src/shared/components/augment-data.ts
  - src/shared/components/augment-state.ts
  - src/shared/components/index.ts
  - src/game/systems/augment.ts
  - src/game/systems/augment.test.ts
autonomous: true
requirements: ["AUG-01", "AUG-02", "AUG-05", "AUG-06"]
---

# Phase 9 - Plan 02: Augment Components & Trigger Engine

<objective>
Create the AugmentData and AugmentState components with recursive AST trigger schema (D-02), then build the AugmentSystem with condition evaluation, per-turn activation limits (D-05), and a queued payload dispatcher.
</objective>

<task type="auto">
  <read_first>
    - src/engine/ecs/types.ts
    - src/shared/components/ability-def.ts
    - src/shared/components/augment-slots.ts
  </read_first>
  <action>
    Create `src/shared/components/augment-data.ts` with `AugmentData` component using `defineComponent()`.

    Define the recursive condition node schema first as a separate interface + Zod type:

    ```typescript
    import { z } from 'zod';
    import { defineComponent } from '@engine/ecs/types';

    export interface ConditionNode {
      type: 'AND' | 'OR' | 'NOT' | 'ON_ACTIVATION' | 'ON_TARGET_HIT' | 'ON_OVERCLOCK' | 'ON_KILL' | 'HEAT_ABOVE' | 'HP_BELOW_PERCENT';
      conditions?: ConditionNode[];
      value?: number;
    }

    export const ConditionNodeSchema: z.ZodType<ConditionNode> = z.object({
      type: z.enum([
        'AND', 'OR', 'NOT',
        'ON_ACTIVATION', 'ON_TARGET_HIT', 'ON_OVERCLOCK', 'ON_KILL',
        'HEAT_ABOVE', 'HP_BELOW_PERCENT',
      ]),
      conditions: z.lazy(() => z.array(ConditionNodeSchema)).optional(),
      value: z.number().optional(),
    });

    export const PayloadSchema = z.object({
      type: z.enum(['HEAL', 'SHIELD', 'APPLY_STATUS', 'VENT_HEAT', 'DAMAGE_BONUS']),
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

    export type AugmentDataType = z.infer<typeof AugmentData.schema>;
    export type PayloadType = z.infer<typeof PayloadSchema>;
    ```

    Export `AugmentData`, `AugmentDataType`, `ConditionNode`, `ConditionNodeSchema`, `PayloadSchema`, `PayloadType`.
  </action>
  <acceptance_criteria>
    - `grep -q "export const AugmentData = defineComponent" src/shared/components/augment-data.ts` exits 0
    - `grep -q "ConditionNodeSchema" src/shared/components/augment-data.ts` exits 0
    - `grep -q "z.lazy" src/shared/components/augment-data.ts` exits 0
    - `grep -q "PayloadSchema" src/shared/components/augment-data.ts` exits 0
    - `grep -q "maxTriggersPerTurn" src/shared/components/augment-data.ts` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <read_first>
    - src/engine/ecs/types.ts
  </read_first>
  <action>
    Create `src/shared/components/augment-state.ts` with `AugmentState` component using `defineComponent()`.

    ```typescript
    import { z } from 'zod';
    import { defineComponent } from '@engine/ecs/types';

    /**
     * Runtime state for Augment activation tracking per entity.
     * Keys are augment entity IDs (as strings). Values are counts/turns.
     */
    export const AugmentState = defineComponent('augmentState', z.object({
      /** Number of times each augment has activated this turn. Reset at turn start. */
      activationsThisTurn: z.record(z.string(), z.number()).default({}),
      /** Remaining cooldown turns for each augment. Decremented at turn start. */
      cooldownsRemaining: z.record(z.string(), z.number()).default({}),
    }));

    export type AugmentStateData = z.infer<typeof AugmentState.schema>;
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "export const AugmentState = defineComponent" src/shared/components/augment-state.ts` exits 0
    - `grep -q "activationsThisTurn" src/shared/components/augment-state.ts` exits 0
    - `grep -q "cooldownsRemaining" src/shared/components/augment-state.ts` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <read_first>
    - src/shared/components/index.ts
  </read_first>
  <action>
    Update `src/shared/components/index.ts`:
    1. Add imports: `import { AugmentData } from './augment-data';` and `import { AugmentState } from './augment-state';`
    2. Add `AugmentData` and `AugmentState` to the `COMPONENTS_REGISTRY` array (after `StatusEffects`)
    3. Add barrel exports: `export * from './augment-data';` and `export * from './augment-state';`
  </action>
  <acceptance_criteria>
    - `grep -q "AugmentData" src/shared/components/index.ts` exits 0
    - `grep -q "AugmentState" src/shared/components/index.ts` exits 0
    - `grep -q "export \* from './augment-data'" src/shared/components/index.ts` exits 0
    - `grep -q "export \* from './augment-state'" src/shared/components/index.ts` exits 0
  </acceptance_criteria>
</task>

<task type="tdd">
  <read_first>
    - src/game/systems/kernel-panic.ts
    - src/game/systems/heat.ts
    - src/game/systems/status-effects.ts
    - src/shared/components/augment-data.ts
    - src/shared/events/types.ts
  </read_first>
  <action>
    Create `src/game/systems/augment.ts` with `createAugmentSystem()` factory function.

    Constructor parameters: `world: World<T>`, `eventBus: EventBus<T>`, `statusEffectSystem: StatusEffectSystem`, `heatSystem: HeatSystem`

    **Internal types:**
    ```typescript
    interface TriggerContext {
      firmwareActivated: boolean;
      damageDealt: number;
      killCount: number;
      heatAboveMax: boolean;
      currentHeat: number;
      hpPercent: number;
    }
    ```

    **Core methods:**

    1. `evaluateCondition(node: ConditionNode, ctx: TriggerContext, depth?: number): boolean`
       - Recursive AST evaluator with depth limit of 10 to prevent infinite loops
       - `AND`: all children must be true
       - `OR`: any child must be true
       - `NOT`: single child must be false
       - Leaf conditions check TriggerContext fields
       - Returns false if depth > 10

    2. `resolvePayloads(entityId: EntityId, payloads: PayloadType[])`
       - Executes each payload:
         - `HEAL`: Modify `Health.current += magnitude`
         - `SHIELD`: `statusEffectSystem.applyEffect(entityId, { name: 'SHIELD', duration: 1, magnitude })`
         - `APPLY_STATUS`: `statusEffectSystem.applyEffect(entityId, { name: statusEffectName, duration: statusEffectDuration, magnitude })`
         - `VENT_HEAT`: `heatSystem.addHeat(entityId, -(magnitude ?? 0))`
         - `DAMAGE_BONUS`: `statusEffectSystem.applyEffect(entityId, { name: 'DAMAGE_BOOST', duration: statusEffectDuration ?? 1, magnitude })`

    3. `processTriggersForEntity(entityId: EntityId, ctx: TriggerContext)`
       - Gets `AugmentSlots.equipped[]` from entity
       - For each equipped augment entity ID:
         - Gets `AugmentData` component from the augment entity
         - Checks `AugmentState.activationsThisTurn[augmentId] < augmentData.maxTriggersPerTurn`
         - Checks `AugmentState.cooldownsRemaining[augmentId] <= 0`
         - Calls `evaluateCondition(augmentData.trigger, ctx)`
         - If true: call `resolvePayloads()`, increment activations, set cooldown
       - After all augments evaluated:
         - If any triggered: emit one `AUGMENT_TRIGGERED` event with all triggered augment names (D-04 batching)
         - Emit individual `MESSAGE_EMITTED` for each triggered augment: `"{augmentName} TRIGGERED: {payloadDescription}"`

    4. `resetTurnState(entityId: EntityId)` — Clears `activationsThisTurn`, decrements `cooldownsRemaining`.

    **Event subscriptions in `init()`:**
    - Subscribe to `FIRMWARE_ACTIVATED` → build TriggerContext, call `processTriggersForEntity()`
    - Subscribe to `DAMAGE_DEALT` → update running context (damageDealt, killCount if entity died)
    - The system needs to defer evaluation until after the action completes (D-06). Use a microtask queue or `setTimeout(0)` to defer to end of event flush cycle.

    **Alternative approach (simpler, recommended):** Instead of complex event collection, listen to `FIRMWARE_ACTIVATED` as the sole trigger point. At that moment, read current world state to determine:
    - `firmwareActivated: true` (always, since FIRMWARE_ACTIVATED fired)
    - `heatAboveMax`: check HeatComponent
    - For `ON_TARGET_HIT` and `ON_KILL`: these are evaluated reactively. Listen to `DAMAGE_DEALT` and `ENTITY_DIED` events that fire during the same action resolution flush, collecting into a per-action context buffer. Then evaluate triggers after the EventBus flush completes.

    Create `src/game/systems/augment.test.ts` with tests:
    - `evaluateCondition` with simple leaf `ON_ACTIVATION` returns true when `firmwareActivated` is true
    - `evaluateCondition` with `AND(ON_ACTIVATION, ON_KILL)` returns false when only activation happened
    - `evaluateCondition` with `OR(ON_ACTIVATION, ON_KILL)` returns true when either happened
    - `evaluateCondition` with `NOT(ON_OVERCLOCK)` returns true when not overclocked
    - `evaluateCondition` with depth > 10 returns false (stack overflow protection)
    - `maxTriggersPerTurn` prevents excessive firing
    - `cooldownTurns` prevents activation during cooldown
    - `resetTurnState` clears activation counts and decrements cooldowns
  </action>
  <acceptance_criteria>
    - `grep -q "export function createAugmentSystem" src/game/systems/augment.ts` exits 0
    - `grep -q "evaluateCondition" src/game/systems/augment.ts` exits 0
    - `grep -q "resolvePayloads" src/game/systems/augment.ts` exits 0
    - `grep -q "processTriggersForEntity" src/game/systems/augment.ts` exits 0
    - `grep -q "AUGMENT_TRIGGERED" src/game/systems/augment.ts` exits 0
    - `grep -q "depth" src/game/systems/augment.ts` exits 0
    - `npx vitest run src/game/systems/augment.test.ts` exits 0
  </acceptance_criteria>
</task>

<verification>
After completing all tasks:
1. `npx vitest run src/game/systems/augment.test.ts` — all augment system tests pass
2. `npx vitest run` — full suite passes (no regressions from component additions)
3. `npx tsc --noEmit` — TypeScript compiles clean
</verification>

<must_haves>
- AugmentData component with recursive ConditionNodeSchema using z.lazy() (D-02, AUG-06)
- AugmentState tracks per-turn activations and cooldowns (D-05)
- evaluateCondition() recursively evaluates AND/OR/NOT with depth limit (AUG-01)
- Three trigger types supported: ON_ACTIVATION, ON_TARGET_HIT, ON_OVERCLOCK (AUG-02)
- processTriggersForEntity() evaluates all equipped augments and fires matching payloads
- maxTriggersPerTurn limits excessive augment firing (D-05)
- Single AUGMENT_TRIGGERED event emitted for batched triggers (D-04)
- Individual MESSAGE_EMITTED per triggered augment for log output (D-04)
- Components registered in COMPONENTS_REGISTRY
</must_haves>
