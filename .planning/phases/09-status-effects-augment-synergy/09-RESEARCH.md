# Phase 9: Status Effects & Augment Synergy - Research

## Context and Requirements
This phase introduces the generic Status Effect system and the Augment "Trigger & Payload" engine.

### Decisions from CONTEXT.md
- **D-01 & D-07 (Status Effect Stacking/Intensity):** Instances run concurrently (array push) but only the highest magnitude active applies for stat calculations.
- **D-02 (Augment Logic):** Nested AST structure to support complex conditions (AND/OR/NOT).
- **D-03 (Ticking Timing):** Effects tick at the start of the afflicted entity's turn.
- **D-04 (Visual Feedback):** Batch visual flashes for simultaneous triggers but log individually.
- **D-05 (Augment Cooldowns):** Configurable limit per Augment via JSON `maxTriggersPerTurn` / `cooldownTurns`.
- **D-06 (Payload Sequence):** Payloads execute queued via ECS events AFTER primary actions finish.

## Gameplay Event Hooks
To support Trigger evaluation, we need to inspect `GameplayEvents` in `types.ts`. Key hooks needed:
- `DAMAGE_DEALT`, `FIRMWARE_ACTIVATED`, `HEALED`, `ENTITY_DIED`.
The Augment system will likely listen to these events on the EventBus. When an event occurs, it checks if any entity with equipped Augments meets the trigger conditions.

## New ECS Components Needed
- `AugmentData`: A structured component on the Augment entity representing the `trigger` AST and the `payload` array.
- `AugmentState`: Tracks cooldowns or "activations this turn" per entity.

## Validation Architecture
- Unit tests for the Augment engine parsing AST logic accurately.
- Network sync tests ensuring the delayed/queued payloads reconcile correctly between predict/server.
- StatusEffect system tick-down tests (start of turn accuracy + magnitude max calculation).
