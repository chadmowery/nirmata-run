# Phase 7: Shell & Equipment Data Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 7-Shell & Equipment Data Model
**Areas discussed:** Shell stat model, Port & slot architecture, Loadout data flow, Shell upgrade model

---

## Shell Stat Model

### Q1: How should Shell base stats feed into the combat pipeline?

| Option | Description | Selected |
|--------|-------------|----------|
| Shell component as stat source | `ShellComponent` holds base stats, seeds existing combat components at creation, serves as source of truth for upgrades | ✓ |
| Shell component as modifier layer | Keep existing combat components, ShellComponent stores base stat modifiers applied on top | |
| Direct replacement | No separate ShellComponent for stats; Shell templates just define different values for existing Health/Attack/Defense/Energy components | |

**User's choice:** Shell component as stat source
**Notes:** Clean separation of "what the Shell provides" from "what combat systems consume"

### Q2: When ShellComponent changes, how should the change propagate?

| Option | Description | Selected |
|--------|-------------|----------|
| Reactive system | ShellStatPropagationSystem watches for changes, re-computes derived values each tick | |
| Event-driven | SHELL_STATS_CHANGED event triggers handler to recalculate combat components | ✓ |
| On-demand at action time | No propagation; combat systems read ShellComponent base + modifiers directly at query time | |

**User's choice:** Event-driven
**Notes:** Aligns with existing EventBus pattern, avoids per-tick overhead

---

## Port & Slot Architecture

### Q3: How should Port configuration and slot system be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Slot-count component + flat entity array | PortConfigComponent stores counts, LoadoutComponent stores flat array of entity IDs, filtered by type | |
| Typed slot map | PortConfigComponent stores counts, LoadoutComponent uses structured map with typed arrays (`firmware: [id, id]`) | |
| Separate components per slot type | No single LoadoutComponent; FirmwareSlots, AugmentSlots, SoftwareSlots each as own ECS component | ✓ |

**User's choice:** Separate components per slot type
**Notes:** User chose maximum modularity despite recommendation for typed slot map. Each phase (8-10) owns its own slot component independently.

### Q4: How should "clear all equipment on death" coordinate across three slot components?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared utility function | `clearLoadout()` helper that knows all three component types | |
| Event-driven cascade | PLAYER_DIED event; each slot system independently listens and clears its own | ✓ |
| Tag-based query | All slot components share equipment tag; death handler clears generically | |

**User's choice:** Event-driven cascade
**Notes:** Mirrors the event-driven Shell stat decision; each slot system fully self-contained

### Q5: Should PortConfigComponent enforce slot limits via Zod or equip system?

| Option | Description | Selected |
|--------|-------------|----------|
| System-level enforcement | PortConfigComponent stores max counts; equip system validates business rule with error messages | ✓ |
| Both levels | Zod validates data shape AND equip system enforces business rule | |

**User's choice:** System-level enforcement
**Notes:** Zod validates data shape, but slot limit enforcement belongs in equip system for meaningful errors

---

## Loadout Data Flow

### Q6: Should the Shell be the player entity, or a separate entity referenced by the player?

| Option | Description | Selected |
|--------|-------------|----------|
| Shell IS the player entity | Player entity created from Shell template; on death, equipment cleared but entity persists | |
| Shell is a separate entity | Player and Shell are distinct entities with a reference link | |
| Shell is persistent record, player is ephemeral | Shell lives outside run World; data stamped onto fresh player entity per run | ✓ |

**User's choice:** Shell is persistent record, player is ephemeral
**Notes:** Clean separation of persistent Shell identity from ephemeral run entity. World is recreated per run via createGame() anyway.

### Q7: Where should persistent Shell records live for Phase 7?

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory Shell registry | ShellRegistry holds records in memory, resets on page refresh | ✓ |
| Session-scoped Shell storage | Extend SessionManager to hold Shell records across runs within a session | |
| Stub persistence API | Create api/shell/ routes with in-memory storage behind it | |

**User's choice:** In-memory Shell registry
**Notes:** Minimal scope — prove the data model works. Real persistence deferred to Phase 13-14.

---

## Shell Upgrade Model

### Q8: What should the upgrade model look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Flat stat purchases | Each stat independently upgradeable for flat cost (+2 Armor for 50 Flux) | |
| Tier/level system | Shell has upgrade levels 1-5 with predefined stat/port bumps per archetype | ✓ |
| Upgrade tree per archetype | Branching upgrade paths with specialization choices | |

**User's choice:** Tier/level system
**Notes:** Simpler UI, easier to balance, less player agency per upgrade but cleaner design

### Q9: Where should upgrade tier definitions live?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in Shell JSON templates | Each template includes `upgrades` array with per-level grants | ✓ |
| Separate upgrade config | Standalone upgrade JSON files independent from Shell templates | |
| Agent's discretion | Let planner decide based on conventions | |

**User's choice:** Inline in Shell JSON templates
**Notes:** Follows existing pattern where everything about an entity lives in one JSON file

---

## Agent's Discretion

- Exact Zod schema shapes for all new components
- Internal structure of ShellRegistry
- Shell selection UX before Neural Deck UI exists (Phase 15)
- Event tier classification for new events (per AGENTS.md)

## Deferred Ideas

None — discussion stayed within phase scope.
