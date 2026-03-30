---
wave: 4
depends_on: ["09-03"]
files_modified: ["src/game/entities/augments.json", "src/rendering/render-system.ts", "src/game/systems/augment-trigger.ts"]
autonomous: true
requirements_addressed: ["AUG-04"]
---

# Plan 09-04: Starter Augments & Visual Feedback

<objective>
Configure exactly 3 working Starter Augments bridging Status Effects and Trigger logic using the JSON definition arrays, and display geometric batched flashes for simultaneous triggers.
</objective>

<tasks>
  <task>
    <description>Starter Augments Data</description>
    <read_first>
      - `src/game/entities/augments.json` (create if needed)
    </read_first>
    <action>
      Add exactly 3 Starter Augments bridging Status Effects and Trigger logic using the `AugmentData` schema:
      1. Siphon.arc: Type "KILL" condition -> Payload "HEAL 5".
      2. Overdrive.exe: Condition AND(Type "OVERCLOCK", "HIT") -> Payload Apply DAMAGE_BOOST status for 1 turn.
      3. Freeze.sys: Type "HIT" -> Payload Apply INPUT_LAG.
    </action>
    <acceptance_criteria>
      - `src/game/entities/augments.json` contains `Siphon.arc`, `Overdrive.exe`, and `Freeze.sys` with valid AST data.
    </acceptance_criteria>
  </task>

  <task>
    <description>Visual Feedback Batching</description>
    <read_first>
      - `src/rendering/render-system.ts`
      - `src/game/systems/augment-trigger.ts`
      - `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md`
    </read_first>
    <action>
      In `augment-trigger.ts`, during payload resolution: if multiple triggers fire for a single root event, emit exactly ONE `AUGMENT_FLASH_TRIGGERED` event (D-04).
      However, emit `MESSAGE_EMITTED` (`"system"`) X times for each individual augment that just procced to show details in the console.
      In `render-system.ts`, listen to `AUGMENT_FLASH_TRIGGERED` and execute geometric screen/tile flash.
    </action>
    <acceptance_criteria>
      - `src/game/systems/augment-trigger.ts` batches flash emissions properly (D-04).
      - `src/rendering/render-system.ts` triggers visual flashes upon `AUGMENT_FLASH_TRIGGERED`.
    </acceptance_criteria>
  </task>
</tasks>
