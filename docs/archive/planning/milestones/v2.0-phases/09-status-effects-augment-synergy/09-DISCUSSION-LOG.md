# Phase 9: Status Effects & Augment Synergy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the context of the conversation.

**Date:** 2026-03-30
**Phase:** 09-status-effects-augment-synergy
**Mode:** discuss

## Discussion

### Area 1: Status Effect Stacking
- **Question:** What happens when the same effect (e.g. INPUT_LAG) is applied to an entity who already has it?
- **Options:**
  1. Instances run concurrently (Recommended)
  2. Refresh duration only 
  3. Stack magnitude
- **Selected:** 1 (Instances run concurrently)

### Area 2: Augment Trigger Data Structure
- **Question:** How does the engine serialize trigger conditions for Augments in JSON?
- **Options:**
  1. Flat array implicitly joined by AND (Recommended)
  2. Nested AST structure supporting full AND/OR/NOT logic
- **Selected:** 2 (Nested AST structure supporting full AND/OR/NOT logic)

### Area 3: Status Effect Ticking Timing
- **Question:** When should the duration of a Status Effect count down?
- **Options:**
  1. At the start of the afflicted entity's turn (Recommended)
  2. Globally, at the start of a round
  3. At the start of the original caster's turn
- **Selected:** 1 (At the start of the afflicted entity's turn)

### Area 4: Visual Feedback Clutter
- **Question:** How should the engine handle visual feedback for simultaneous trigger events?
- **Options:**
  1. Batch the visual flash entirely, but write all events to the message log (Recommended)
  2. Flash individually strictly once per event
  3. Queue flashes to play back chronologically
- **Selected:** 1 (Batch the visual flash entirely, but write all events to the message log)

### Area 5: Augment Internal Cooldowns
- **Question:** How should Augment frequency be limited?
- **Options:**
  1. Configurable limit per Augment in JSON (Recommended)
  2. No limits — if the condition is met, it triggers
  3. Strictly one activation per turn for ALL augments
- **Selected:** 1 (Configurable limit per Augment in JSON)

### Area 6: Payload Resolution Sequence
- **Question:** When should Augment Payloads execute?
- **Options:**
  1. Queued: Resolve after the current action fully completes (Recommended)
  2. Immediate: Interrupt the current action logic and process instantly
- **Selected:** 1 (Queued: Resolve after the current action fully completes)

### Area 7: Status Effect Intensity
- **Question:** How should the engine calculate the potency of overlapping statuses?
- **Options:**
  1. Highest single magnitude active applies (Recommended)
  2. Magnitudes stack additively
- **Selected:** 1 (Highest single magnitude active applies)
