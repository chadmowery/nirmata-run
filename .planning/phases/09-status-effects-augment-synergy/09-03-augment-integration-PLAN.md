---
wave: 3
depends_on: ["09-02"]
files_modified: ["src/engine/turn/turn-manager.ts", "src/game/systems/__tests__/augment-integration.test.ts"]
autonomous: true
requirements_addressed: ["AUG-03", "AUG-05"]
---

# Plan 09-03: Augment Integration & Stacking

<objective>
Wire up the payload execution step into the primary game loop processing safely to prevent mid-cycle ECS state corruption.
</objective>

<tasks>
  <task>
    <description>Integrate Queued Payload Execution</description>
    <read_first>
      - `src/engine/turn/turn-manager.ts` (or equivalent loop container managing action queue)
      - `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md`
    </read_first>
    <action>
      Ensure the Game Engine evaluates `augmentSystem.resolveQueuedPayloads()` at the absolute end of the primary atomic action resolution step (D-06). 
      Dispatch the payload resolutions directly.
    </action>
    <acceptance_criteria>
      - Action evaluation queues payload rather than processing immediately (D-06).
    </acceptance_criteria>
  </task>
</tasks>
