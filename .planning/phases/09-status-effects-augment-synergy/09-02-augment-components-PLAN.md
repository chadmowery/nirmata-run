---
wave: 2
depends_on: ["09-01"]
files_modified: ["src/shared/components/augments.ts", "src/game/systems/augment-trigger.ts", "src/game/systems/__tests__/augment-trigger.test.ts"]
autonomous: true
requirements_addressed: ["AUG-01", "AUG-02", "AUG-06"]
---

# Plan 09-02: Augment Components & Trigger Engine

<objective>
Implement the JSON-driven Augment logic (AST trigger schema and payload system), enabling entities to possess passive combat augmentations.
</objective>

<tasks>
  <task>
    <description>Define Augments Schema Structure</description>
    <read_first>
      - `src/shared/components/augment-slots.ts`
      - `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md`
    </read_first>
    <action>
      Create `src/shared/components/augments.ts`.
      Define the JSON structure for Trigger logic using a recursive AST (D-02):
      ```typescript
      export const ConditionSchema = z.object({
        type: z.enum(['AND', 'OR', 'NOT', 'HIT', 'KILL', 'OVERCLOCK', 'HP_DROPS_BELOW']),
        conditions: z.lazy(() => z.array(ConditionSchema)).optional(),
        value: z.number().optional()
      });
      export const AugmentData = defineComponent('augmentData', z.object({
        name: z.string(),
        trigger: ConditionSchema,
        cooldownTurns: z.number().default(0),
        maxTriggersPerTurn: z.number().default(99),
        payload: z.array(z.object({
           type: z.string(),
           magnitude: z.number().optional(),
           statusEffectId: z.string().optional()
        }))
      }));
      ```
    </action>
    <acceptance_criteria>
      - `src/shared/components/augments.ts` contains `ConditionSchema` with `z.lazy` recursive rules.
    </acceptance_criteria>
  </task>

  <task>
    <description>Create Augment Trigger Engine System</description>
    <read_first>
      - `src/game/systems/augment-trigger.ts`
      - `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md`
    </read_first>
    <action>
      Create `src/game/systems/augment-trigger.ts`.
      Listen to EventBus logic on hooks. For every equipped augment on the triggering entity, recursively evaluate the Trigger AST. 
      If TRUE, emit a delayed internal system task indicating a pending payload queue resolution `evaluatePayloads()`.
      Track per-turn limits for every Augment using its `maxTriggersPerTurn` configuration (D-05).
    </action>
    <acceptance_criteria>
      - `src/game/systems/augment-trigger.ts` evaluates nested AST logic tree recursively.
    </acceptance_criteria>
  </task>
</tasks>
