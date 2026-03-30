# Phase 9: Status Effects & Augment Synergy - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

The Augment Synergy and generic Status Effect engine that enables combat customization via passive "Trigger & Payload" combinations.

</domain>

<decisions>
## Implementation Decisions

### Status Effect Stacking
- **D-01:** Instances run concurrently — the engine pushes to an array, allowing overlaps.

### Augment Trigger Data Structure
- **D-02:** Nested AST structure supporting full AND/OR/NOT logic for trigger serialization.

### Status Effect Ticking Timing
- **D-03:** Effects tick down at the start of the afflicted entity's turn ensuring duration maps accurately to their action time.

### Visual Feedback Clutter
- **D-04:** Batch visual flash on multiple triggers but write all events individually to the message log.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md.
</canonical_refs>
