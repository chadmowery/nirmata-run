# Phase 7: Shell & Equipment Data Model - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Equipment system data backbone — Shell archetypes with base stats, Port configurations, and Loadouts can be created, configured, and persisted through the existing ECS and JSON entity template pipeline. Players can select Shells, equip items to slots within Port limits, and upgrade Shells through a tier/level system. Shells persist across death; equipment does not.

</domain>

<decisions>
## Implementation Decisions

### Shell Stat Model
- **D-01:** `ShellComponent` is the source of truth for base stats (Speed, Stability, Armor, MaxHealth). At entity creation, these values seed the existing `Energy`, `Defense`, `Health` combat components. Combat systems continue reading the existing components — `ShellComponent` is not queried during combat resolution.
- **D-02:** When `ShellComponent` changes (upgrades, equipment modifiers), propagation to combat components is event-driven via a `SHELL_STATS_CHANGED` event. No per-tick propagation system. The handler recalculates derived combat component values only when something actually mutates Shell state.

### Port & Slot Architecture
- **D-03:** Equipment slots are separate ECS components per slot type: `FirmwareSlots`, `AugmentSlots`, `SoftwareSlots`. Each component holds an array of equipped entity IDs. Phases 8-10 each own their respective slice of the loadout independently.
- **D-04:** Slot limit enforcement is a business rule in the equip system, not Zod schema validation. `PortConfigComponent` stores max slot counts per type. The equip system checks `currentSlots.length < portConfig.maxFirmware` and returns meaningful error messages through the action pipeline on invalid attempts.
- **D-05:** Equipment clearing on death uses event-driven cascade — each slot system independently listens for `PLAYER_DIED` and clears its own slots. No shared utility function. Adding a new slot type in the future just means adding a new listener.

### Loadout Data Flow
- **D-06:** Shell is a persistent record that lives outside the per-run `World`. When a run starts, the Shell's data is stamped onto a fresh player entity. On run end, results (upgrade progress, etc.) are written back to the Shell record. The in-run player entity is ephemeral and disposable.
- **D-07:** For Phase 7, persistence uses an in-memory `ShellRegistry` (similar to `EntityRegistry`). No server-side persistence — resets on page refresh. Phase 13-14 adds real persistence. This keeps Phase 7 scope minimal while proving the data model works.

### Shell Upgrade Model
- **D-08:** Shell upgrades follow a tier/level system (levels 1-5). Each level unlocks a predefined stat bump and/or Port expansion specific to that archetype. Example: "STRIKER-v1 Level 3 → +1 Firmware slot, +5 Speed." Simpler to balance and present than freeform stat purchasing.
- **D-09:** Upgrade tier definitions are inline in Shell JSON templates. Each Shell template includes an `upgrades` array defining what each level grants. Everything about a Shell lives in one file, consistent with the existing pattern where `goblin.json` defines everything about a goblin.

### Agent's Discretion
- Exact Zod schema shapes for `ShellComponent`, `PortConfigComponent`, and slot components
- Internal structure of the `ShellRegistry` (Map vs array, lookup keys)
- How Shell selection is exposed before the Neural Deck UI exists (Phase 15)
- Whether `SHELL_STATS_CHANGED` is a `GameplayEvent` or `GameEvent` (follow AGENTS.md tier classification)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Shell & Equipment Requirements
- `.planning/REQUIREMENTS.md` §Shell & Loadout — SHELL-01 through SHELL-07 define Shell archetype features, Port configs, persistence rules, and upgrade requirements
- `.planning/ROADMAP.md` §Phase 7 — Success criteria, plan breakdown (07-01, 07-02, 07-03), and dependencies

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries (engine vs game vs shared), data flow, key abstractions
- `.planning/codebase/STRUCTURE.md` — Where to add new code, naming conventions, directory purposes
- `.planning/codebase/CONVENTIONS.md` — File naming, code style, import organization

### ECS & Entity Template System
- `src/engine/ecs/types.ts` — `defineComponent()` function and `ComponentDef` type (canonical component creation pattern)
- `src/engine/entity/registry.ts` — `EntityRegistry` class (pattern for `ShellRegistry`)
- `src/game/entities/index.ts` — `registerGameTemplates()` shows how JSON templates are registered
- `src/game/entities/templates/player.json` — Current player entity template (will be extended/replaced by Shell templates)
- `src/game/entities/templates/goblin.json` — Example of full entity template with mixins, components, and overrides

### Existing Components
- `src/shared/components/` — All existing game components (Health, Attack, Defense, Energy, etc.) that Shell stats will feed into

### Event System
- `AGENTS.md` §Event Tier Assignment — Classification rules for where new events belong (EngineEvents vs GameplayEvents vs GameEvents)

### Research
- `.planning/research/SUMMARY.md` — v2.0 research findings, risk flags, recommended build order

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `defineComponent()` from `src/engine/ecs/types.ts` — Use to create `ShellComponent`, `PortConfigComponent`, `FirmwareSlots`, `AugmentSlots`, `SoftwareSlots`
- `EntityRegistry` from `src/engine/entity/registry.ts` — Pattern for building `ShellRegistry` (register, lookup, list operations)
- `EventBus` from `src/engine/events/event-bus.ts` — Wire `SHELL_STATS_CHANGED` and `PLAYER_DIED` event-driven patterns
- Existing components (`Health`, `Attack`, `Defense`, `Energy`) in `src/shared/components/` — Propagation targets for Shell stats

### Established Patterns
- JSON entity templates with mixin inheritance (`"mixins": ["physical", "combatant"]`) — Shell templates should follow this pattern
- One component per file in `src/shared/components/` with Zod schema — new Shell components follow this
- `registerGameTemplates()` barrel registration — Shell templates registered the same way
- Action pipeline for server-validated mutations — equip/unequip/upgrade actions go through this

### Integration Points
- `src/game/setup.ts` — `createGame()` will need to accept Shell selection and stamp Shell data onto the player entity
- `src/game/engine-factory.ts` — World generation will need Shell-aware player entity creation
- `src/shared/components/index.ts` — New components exported through barrel
- `src/app/api/action/route.ts` — New action types (equip, unequip, upgrade) processed here

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-shell-equipment-data-model*
*Context gathered: 2026-03-29*
