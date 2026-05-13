---
wave: 4
depends_on: ["09-01", "09-02", "09-03"]
files_modified:
  - src/game/entities/templates/displacement-venting.json
  - src/game/entities/templates/static-siphon.json
  - src/game/entities/templates/neural-feedback.json
  - src/game/entities/index.ts
  - src/game/events/types.ts
  - src/game/entities/templates/__tests__/augment-templates.test.ts
autonomous: true
requirements: ["AUG-03", "AUG-04"]
---

# Phase 9 - Plan 04: Starter Augments & Visual Feedback

<objective>
Create the three starter Augment JSON entity templates (Displacement_Venting.arc, Static_Siphon.arc, Neural_Feedback.arc), register them in the entity pipeline, add the client-only AUGMENT_FLASH event for geometric visual feedback, and verify end-to-end template parsing.
</objective>

<task type="auto">
  <read_first>
    - src/game/entities/templates/phase-shift.json
    - src/game/entities/templates/neural-spike.json
    - src/shared/components/augment-data.ts
  </read_first>
  <action>
    Create three Augment JSON entity templates in `src/game/entities/templates/`, following the same pattern as Firmware ability templates:

    1. `displacement-venting.json`:
    ```json
    {
      "name": "displacement_venting",
      "components": {
        "augmentData": {
          "name": "Displacement_Venting.arc",
          "trigger": {
            "type": "ON_ACTIVATION"
          },
          "payloads": [
            { "type": "VENT_HEAT", "magnitude": 15 }
          ],
          "maxTriggersPerTurn": 1,
          "cooldownTurns": 0
        }
      }
    }
    ```

    2. `static-siphon.json`:
    ```json
    {
      "name": "static_siphon",
      "components": {
        "augmentData": {
          "name": "Static_Siphon.arc",
          "trigger": {
            "type": "AND",
            "conditions": [
              { "type": "ON_ACTIVATION" },
              { "type": "ON_KILL" }
            ]
          },
          "payloads": [
            { "type": "SHIELD", "magnitude": 5 }
          ],
          "maxTriggersPerTurn": 1,
          "cooldownTurns": 0
        }
      }
    }
    ```

    3. `neural-feedback.json`:
    ```json
    {
      "name": "neural_feedback",
      "components": {
        "augmentData": {
          "name": "Neural_Feedback.arc",
          "trigger": {
            "type": "ON_KILL"
          },
          "payloads": [
            { "type": "DAMAGE_BONUS", "magnitude": 25, "statusEffectDuration": 1 }
          ],
          "maxTriggersPerTurn": 1,
          "cooldownTurns": 0
        }
      }
    }
    ```
  </action>
  <acceptance_criteria>
    - `test -f src/game/entities/templates/displacement-venting.json` exits 0
    - `test -f src/game/entities/templates/static-siphon.json` exits 0
    - `test -f src/game/entities/templates/neural-feedback.json` exits 0
    - `grep -q "Displacement_Venting.arc" src/game/entities/templates/displacement-venting.json` exits 0
    - `grep -q '"type": "AND"' src/game/entities/templates/static-siphon.json` exits 0
    - `grep -q "DAMAGE_BONUS" src/game/entities/templates/neural-feedback.json` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <read_first>
    - src/game/entities/index.ts
    - src/engine/entity/registry.ts
  </read_first>
  <action>
    Update `src/game/entities/index.ts` (or wherever `registerGameTemplates()` is defined) to register the three new Augment templates.

    Add imports for the JSON files:
    ```typescript
    import displacementVentingTemplate from './templates/displacement-venting.json';
    import staticSiphonTemplate from './templates/static-siphon.json';
    import neuralFeedbackTemplate from './templates/neural-feedback.json';
    ```

    Register them in `registerGameTemplates()`:
    ```typescript
    registry.register(displacementVentingTemplate);
    registry.register(staticSiphonTemplate);
    registry.register(neuralFeedbackTemplate);
    ```

    This follows the existing pattern used for `phase-shift`, `neural-spike`, and `extended-sight` templates.
  </action>
  <acceptance_criteria>
    - `grep -q "displacement.venting\|displacementVenting" src/game/entities/index.ts` exits 0
    - `grep -q "static.siphon\|staticSiphon" src/game/entities/index.ts` exits 0
    - `grep -q "neural.feedback\|neuralFeedback" src/game/entities/index.ts` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <read_first>
    - src/game/events/types.ts
    - AGENTS.md
  </read_first>
  <action>
    Add the client-only visual feedback event to `GameEvents` in `src/game/events/types.ts`:

    ```typescript
    /** Queued to flash a geometric shape for augment synergy feedback (D-04). */
    AUGMENT_FLASH: {
      entityId: EntityId;
      count: number;
      augmentNames: string[];
    };
    ```

    This is a GameEvent (not GameplayEvent) because it is a rendering-specific signal that the server never emits or consumes (per AGENTS.md: "CAMERA_SHAKE → GameEvents — Rendering effect, client-only"). The import for `EntityId` should already be available via the `GameplayEvents` parent interface.

    Add the import for `EntityId` if not already inherited:
    ```typescript
    import { EntityId } from '@engine/ecs/types';
    ```
  </action>
  <acceptance_criteria>
    - `grep -q "AUGMENT_FLASH" src/game/events/types.ts` exits 0
    - `grep -q "augmentNames" src/game/events/types.ts` exits 0
  </acceptance_criteria>
</task>

<task type="tdd">
  <read_first>
    - src/shared/components/augment-data.ts
    - src/game/entities/templates/displacement-venting.json
    - src/game/entities/templates/static-siphon.json
    - src/game/entities/templates/neural-feedback.json
    - src/engine/entity/registry.ts
    - src/engine/entity/factory.ts
    - src/game/entities/templates/__tests__/firmware-templates.test.ts
  </read_first>
  <action>
    Create `src/game/entities/templates/__tests__/augment-templates.test.ts` with tests following the firmware-templates test pattern:

    1. **Template parsing**: Each JSON template validates against the AugmentData Zod schema
       - Parse displacement-venting.json → `AugmentData.schema.parse(template.components.augmentData)`
       - Parse static-siphon.json → same
       - Parse neural-feedback.json → same

    2. **Entity creation**: Each template creates a valid entity via EntityFactory
       - Register all templates in a test EntityRegistry
       - Call `entityFactory.create(world, 'displacement_venting', componentRegistry)` → entity has AugmentData component
       - Verify created entity's AugmentData data matches template values

    3. **Specific augment trigger values**:
       - Displacement_Venting.arc: trigger.type='ON_ACTIVATION', payload[0].type='VENT_HEAT', magnitude=15
       - Static_Siphon.arc: trigger.type='AND' with 2 conditions, payload[0].type='SHIELD', magnitude=5
       - Neural_Feedback.arc: trigger.type='ON_KILL', payload[0].type='DAMAGE_BONUS', magnitude=25

    4. **Compound trigger validation**: Static_Siphon's AND node has exactly 2 children: ON_ACTIVATION and ON_KILL
  </action>
  <acceptance_criteria>
    - `test -f src/game/entities/templates/__tests__/augment-templates.test.ts` exits 0
    - `npx vitest run src/game/entities/templates/__tests__/augment-templates.test.ts` exits 0
  </acceptance_criteria>
</task>

<verification>
After completing all tasks:
1. `npx vitest run src/game/entities/templates/__tests__/augment-templates.test.ts` — all template tests pass
2. `npx vitest run` — full suite passes (including Phase 8 firmware template tests)
3. `npx tsc --noEmit` — TypeScript compiles clean
4. Manual: Start the game, verify the entity pipeline initializes without errors
</verification>

<must_haves>
- Displacement_Venting.arc: ON_ACTIVATION trigger, VENT_HEAT 15, maxTriggersPerTurn=1 (AUG-03, LOAD-01)
- Static_Siphon.arc: AND(ON_ACTIVATION, ON_KILL) trigger, SHIELD 5, maxTriggersPerTurn=1 (AUG-03, LOAD-02)
- Neural_Feedback.arc: ON_KILL trigger, DAMAGE_BONUS 25 for 1 turn, maxTriggersPerTurn=1 (AUG-03, LOAD-03)
- All templates registered in EntityRegistry and creatable via EntityFactory
- All templates validate against AugmentData Zod schema (including recursive ConditionNodeSchema)
- AUGMENT_FLASH event added to GameEvents for rendering (AUG-04)
- Visual flash rendering deferred to Phase 16 (stubbed event emission only)
</must_haves>
