# Phase 11: Enemy Hierarchy - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Six distinct enemy types across 3 tiers (Corrupted Data, Static Horrors, Logic Breakers) with unique AI behaviors, per-type death effects, depth-based spawn distribution, and JSON entity templates. Creates varied tactical challenges per depth band.

</domain>

<decisions>
## Implementation Decisions

### AI Behavior Architecture
- **D-01:** Behavior key dispatch pattern — add a `behaviorType` field to `AIState` component (e.g., `'null_pointer'`, `'buffer_overflow'`, `'fragmenter'`, `'logic_leaker'`, `'system_admin'`, `'seed_eater'`). The AI system dispatches to per-type handler functions based on this key. Each handler has its own state transitions and actions. JSON-configurable, single AI system.
- **D-02:** The existing 3-state machine (IDLE/CHASING/ATTACKING) remains as the base. Per-type handlers extend or override specific transitions and behaviors.
- **D-03:** Per-type fixed energy speed in JSON templates — Null-Pointer fast (120), Buffer-Overflow moderate (80), Fragmenter slow (60), etc. No speed randomization.

### Pack AI (Buffer-Overflow)
- **D-04:** Shared pack ID via a `PackMember` component with a `packId` field. Pack leader coordinates movement — followers try to surround the player relative to leader position.
- **D-05:** Detonation is proximity-triggered: if 3+ pack members are adjacent to the player, all eligible pack members detonate for AOE damage + movement slow.
- **D-06:** Pack members always spawn together in the same room. PlacementConfig spawns 5-8 Buffer-Overflows in one room when the template is selected.

### Null-Pointer Teleport
- **D-07:** Instant reposition — Null-Pointer disappears from current tile and appears behind the player in the same turn. Simple position update. Visual feedback via brief flicker/static effect at origin and destination.

### Ranged AI (Logic-Leaker)
- **D-08:** Range threshold in handler — Logic-Leaker checks distance to player. If within attack range and has line of sight, fires a Corrupted Packet (ranged attack). If player gets too close, moves away (kiting). Uses existing FOV for LOS checks.
- **D-09:** Firmware cooldown on hit uses status effect approach — Logic-Leaker hit applies a `FIRMWARE_LOCK` status effect (Phase 9 infrastructure) to a random equipped Firmware for N turns. Firmware system checks for this effect and blocks activation.

### Fragmenter Dead Zones
- **D-10:** Dead Zone tiles are time-limited — persist for N turns (e.g., 5-8), then fade. Duration configurable in JSON template. Creates area denial without permanently cluttering the map.

### Death Effects & Damage Feedback
- **D-11:** Damage feedback uses sprite distortion — on damage, the enemy sprite visually glitches with horizontal tear/displacement for ~200ms and scanline effect. Requires PixiJS filter/shader on individual sprites.
- **D-12:** Per-type unique death effects — each of the 6 enemy types gets its own death effect (Null-Pointer flickers and vanishes, Buffer-Overflow explodes in pixel shrapnel, Fragmenter crumbles, etc.).
- **D-13:** Full death effect implementation in Phase 11 — all 6 unique death effects with full visual fidelity, not deferred to Phase 16.

### Depth-Based Spawning
- **D-14:** JSON spawn table configuration — a spawn-distribution config file maps depth ranges to weighted template lists. PlacementConfig reads from this table instead of a flat array. Tunable without code changes.
- **D-15:** Enemy count per room scales with depth — floors 1-5: 1-2, floors 5-10: 2-3, floors 10-15: 2-4. Configurable in the spawn table alongside template weights.

### System_Admin (Tier 3 — Invulnerable Stalker)
- **D-16:** No Health component — System_Admin has no Health component at all. Attacks never resolve damage. Stun comes from a special 'disrupt' interaction (Firmware ability or status effect) that pauses its movement for N turns. No health bar displayed.
- **D-17:** Either-direction run-end — any adjacency + movement into the other's tile triggers instant run-end. System_Admin walking into the player OR the player accidentally moving into System_Admin both cause it.
- **D-18:** Low energy speed for stalking feel — System_Admin has very low energy speed (30-40 vs player's 100). Takes a turn every 2-3 player turns through the existing energy/turn system. Always pathfinds toward the player.
- **D-19:** Ambient HUD warning when System_Admin is present on the floor — a subtle persistent indicator (flickering 'ADMIN_PROCESS_DETECTED' text or pulsing icon). Player knows it's there but not where.

### Seed_Eater (Tier 3 — Room Corruptor)
- **D-20:** Tile corruption spread — instead of full room rearrangement, Seed_Eater corrupts individual tiles (turning walkable tiles to walls and vice versa) in a spreading pattern. Simpler than full re-generation, still creates spatial chaos.
- **D-21:** Corruption pushes entities — when a tile corrupts to wall, any entity on it is pushed to the nearest walkable tile. Prevents softlocks. Seed_Eater's own tile is immune. Player gets a brief 'displaced' visual effect.
- **D-22:** Seed_Eater spawns full Tier 1 entities as sub-processes — actual Null-Pointer or Buffer-Overflow entities from existing JSON templates with full AI and loot drops.
- **D-23:** Seed_Eater is killable with high HP (mini-boss tier). Killing it stops corruption and sub-process spawning. Drops high-value loot. Rewards aggressive play.

### Claude's Discretion
- Exact stat values for all 6 enemy types (HP, attack power, defense, sight radius)
- Null-Pointer teleport range and "behind player" tile selection algorithm
- Buffer-Overflow detonation damage values and slow duration
- Dead Zone damage-over-time values and tick frequency
- Logic-Leaker attack range, Corrupted Packet damage, FIRMWARE_LOCK duration
- System_Admin stun duration and what can stun it (any Firmware? specific types?)
- Seed_Eater corruption rate (tiles per turn), spread pattern, sub-process spawn frequency
- Seed_Eater HP pool and loot drop table
- HUD warning visual style details for System_Admin presence
- Sprite distortion filter implementation details (displacement map, scanline shader, etc.)
- Exact spawn table weight values per depth band
- Energy speed values per enemy type (suggestions given but exact tuning is discretionary)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Enemy Requirements
- `.planning/REQUIREMENTS.md` §Enemy Hierarchy — ENEMY-01 through ENEMY-11 define tier structure, per-type behaviors, visual identity, depth distribution, and JSON templates
- `.planning/ROADMAP.md` §Phase 11 — Success criteria, plan breakdown (11-01 through 11-04), dependencies

### Direct Dependencies (Prior Phases)
- `.planning/phases/08-firmware-neural-heat-system/08-CONTEXT.md` — Firmware activation flow (D-05 hotkey dispatch, D-07 full turn cost), turn/energy system, targeting cursor
- `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md` — Status effect system (D-01 concurrent stacking, D-03 tick timing at turn start, D-06 payload resolution after action). FIRMWARE_LOCK uses this system.
- `.planning/phases/10-software-system-enhanced-combat/10-CONTEXT.md` — Combat damage pipeline (D-11 modifier list pattern), Software modifier integration, loot drop context

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, data flow
- `.planning/codebase/STRUCTURE.md` — Directory layout, naming conventions
- `.planning/codebase/CONVENTIONS.md` — Code style, import organization

### Key Source Files
- `src/game/systems/ai.ts` — Current AI system (3-state IDLE/CHASING/ATTACKING, A* pathfinding, FOV-based awareness). Extend with behaviorType dispatch.
- `src/shared/components/ai-state.ts` — AIState component (behavior enum, sightRadius). Extend with behaviorType field.
- `src/shared/components/hostile.ts` — Hostile marker component for bump-to-attack
- `src/game/entities/templates/goblin.json` — Existing enemy template pattern (mixin inheritance, component overrides)
- `src/game/generation/entity-placement.ts` — PlacementConfig, template selection, room-based spawning. Refactor for depth-based spawn table.
- `src/shared/components/loot-table.ts` — LootTable component for enemy drops
- `src/shared/components/status-effects.ts` — StatusEffects component for FIRMWARE_LOCK, HUD_GLITCH, slow effects
- `src/game/systems/combat.ts` — Combat system with modifier list pipeline
- `src/engine/turn/turn-manager.ts` — Energy-based turn system (enemy speed values feed into this)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createAISystem` in `ai.ts` — Base AI with A* pathfinding, FOV, state machine. Extend with behaviorType dispatch.
- `AIState` component — Add behaviorType field. Existing behavior enum (IDLE/CHASING/ATTACKING) stays as base states.
- `FovAwareness` component — Enemy FOV tracking, canSeePlayer, lastKnownPosition. Reuse for all enemy types.
- `goblin.json` template — Pattern for all 6 new enemy templates (mixins, component overrides)
- `PlacementConfig` in entity-placement.ts — Currently flat template array. Refactor for depth-weighted spawn tables.
- `LootTable` component — Already on enemies. Configure per-type drop tables.
- `StatusEffects` component — Apply HUD_GLITCH (Null-Pointer), movement slow (Buffer-Overflow), FIRMWARE_LOCK (Logic-Leaker).
- `defineComponent()` pattern — For new components (PackMember, DeadZone, etc.)
- PixiJS filter system — For sprite distortion on damage and death effects.

### Established Patterns
- One component per file in `src/shared/components/` with Zod schema
- JSON entity templates with mixin inheritance in `src/game/entities/templates/`
- System factory pattern: `createXSystem(world, grid, eventBus, ...)` returning `{ init(), dispose() }`
- Energy-based turn system in turn-manager.ts — enemy speed values determine turn frequency
- Action pipeline for server-validated mutations

### Integration Points
- `src/game/systems/ai.ts` — Refactor to dispatch per behaviorType
- `src/shared/components/ai-state.ts` — Add behaviorType field to schema
- `src/shared/components/index.ts` — Register new components (PackMember, DeadZone tile marker, etc.)
- `src/game/entities/templates/` — 6 new enemy JSON templates
- `src/game/generation/entity-placement.ts` — Depth-based spawn table integration
- `src/shared/events/types.ts` — New events (ENEMY_DETONATED, DEAD_ZONE_CREATED, ROOM_CORRUPTED, RUN_ENDED_SYSTEM_ADMIN, etc.)
- `src/rendering/render-system.ts` — Sprite distortion filters, death effect rendering

</code_context>

<specifics>
## Specific Ideas

- System_Admin's ambient HUD warning ("ADMIN_PROCESS_DETECTED") builds tension before the player even sees it — the player knows death is stalking somewhere on the floor.
- Buffer-Overflow's pack detonation threshold (3+ adjacent) creates a tactical puzzle: the player should try to pick off isolated pack members before they converge, or use area denial to prevent clustering.
- Seed_Eater's tile corruption spread (not full room regen) is simpler and works without Phase 12's multi-floor system, while still creating the intended spatial chaos.
- Full death effects in Phase 11 (not deferred to Phase 16) means enemies feel visually complete when this phase ends. Sprite distortion on damage uses PixiJS filters/shaders.
- Logic-Leaker's FIRMWARE_LOCK via the status effect system keeps the implementation clean and consistent with the Phase 9 infrastructure — no special-case cooldown fields.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-enemy-hierarchy*
*Context gathered: 2026-03-30*
