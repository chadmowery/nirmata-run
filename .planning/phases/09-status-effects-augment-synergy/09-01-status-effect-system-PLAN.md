---
wave: 1
depends_on: []
files_modified: ["src/shared/components/status-effects.ts", "src/game/systems/status-effects.ts", "src/game/systems/__tests__/status-effects.test.ts"]
autonomous: true
requirements_addressed: ["AUG-07", "AUG-08"]
---

# Plan 09-01: Status Effect System

<objective>
Implement a robust Status Effects component and system supporting concurrent overlapping durations, magnitude selection, and turn-based ticking relative to the afflicted entity.
</objective>

<tasks>
  <task>
    <description>Refactor StatusEffectsComponent Schema</description>
    <read_first>
      - `src/shared/components/status-effects.ts`
      - `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md`
    </read_first>
    <action>
      Update the StatusEffects component schema to support tracking an array of concurrent `.duration` instances per unique status effect name (D-01). 
      Format exactly:
      ```typescript
      export const StatusEffects = defineComponent(
        'statusEffects',
        z.object({
          effects: z.record(
            z.string(),
            z.array(z.object({
              duration: z.number().int().min(0),
              magnitude: z.number().default(0),
              source: z.string().optional()
            }))
          )
        })
      );
      ```
    </action>
    <acceptance_criteria>
      - `src/shared/components/status-effects.ts` contains `z.record(z.string(), z.array(`
    </acceptance_criteria>
  </task>
  
  <task>
    <description>Update StatusEffectSystem Tick Logic</description>
    <read_first>
      - `src/game/systems/status-effects.ts`
      - `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md`
    </read_first>
    <action>
      Update `applyEffect` to append to the instances array. 
      Update `tickDown` to iterate logic per-instance and decrement duration ONLY when it is the exact afflicted entity's turn.
      Implement `getMagnitude(entityId, effectName)` that iterates any active instances and returns the HIGHEST single magnitude among them for that effect (D-07).
    </action>
    <acceptance_criteria>
      - `src/game/systems/status-effects.ts` contains `getMagnitude`
      - `src/game/systems/status-effects.ts` properly cleans up 0-duration overlapping instances.
    </acceptance_criteria>
  </task>

  <task>
    <description>Update Status Effects Unit Tests</description>
    <read_first>
      - `src/game/systems/__tests__/status-effects.test.ts`
    </read_first>
    <action>
      Update the test suite to verify concurrent overlapping instances don't throw, and `getMagnitude` returns max instead of additive stacking.
    </action>
    <acceptance_criteria>
      - Test suite runs green (`npm run test`)
    </acceptance_criteria>
  </task>
</tasks>

<verification>
Unit test for StatusEffects logic guarantees the D-01 and D-07 context constraints.
</verification>
<must_haves>
- Status magnitude relies on absolute highest active duration effect.
</must_haves>
