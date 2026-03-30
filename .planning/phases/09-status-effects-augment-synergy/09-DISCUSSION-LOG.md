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
