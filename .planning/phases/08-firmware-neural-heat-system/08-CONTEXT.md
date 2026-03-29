# Phase 8: Firmware & Neural Heat System - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Active abilities (Firmware) with Heat resource costs, overclock risk (Kernel Panic), and Heat management (passive dissipation + active Venting) integrated into the turn-based action pipeline. Players equip Firmware to Shell ports and activate abilities during their turn via hotkeys, targeting tiles with a cursor system. Heat accumulates with use, creates escalating risk above 100, and dissipates passively each turn. Three starter Firmware abilities demonstrate distinct ability archetypes (movement, damage, sustained utility).

</domain>

<decisions>
## Implementation Decisions

### Heat Accumulation & Dissipation Model
- **D-01:** Heat dissipation occurs at the **start of the player's turn**, before any action is taken. The player sees their current Heat after dissipation, then decides whether to push further.
- **D-02:** Base dissipation rate is **5 Heat per turn**. This means ~8 turns to fully cool from one Neural_Spike (40 Heat cost). Rate is stored as a configurable value on a Heat component, not hardcoded.
- **D-03:** The **Stability stat on ShellComponent influences dissipation rate**. Higher Stability = faster Heat dissipation. This gives Stability its first combat role and creates clear Shell archetype trade-offs: Striker (fast, overheats easily) vs Bastion (slow, thermally stable). The exact formula is agent's discretion (e.g., `baseDissipation + stability * modifier`).
- **D-04:** Heat **persists across floors**. The HeatComponent value carries over when the player descends to the next dungeon floor (Phase 12). Heat does NOT reset on floor transition. Data model should not assume per-floor reset.

### Firmware Ability Activation Flow
- **D-05:** Firmware abilities are activated via **indexed hotkeys**: keys `1`, `2`, `3` map directly to `FirmwareSlots.equipped[0]`, `[1]`, `[2]`. New `GameAction` enum entries: `USE_FIRMWARE_0`, `USE_FIRMWARE_1`, `USE_FIRMWARE_2`. The input manager maps `Digit1`/`Digit2`/`Digit3` keycodes to these actions.
- **D-06:** Targeting uses a **cursor-based tile selection** system supporting **both keyboard and mouse input**. After pressing a hotkey, a targeting cursor appears at the player's position. The player moves it via arrow/WASD keys OR hovers/clicks with the mouse. Enter/Space/click confirms the target tile. Escape cancels targeting mode. Valid target tiles within ability range are visually highlighted.
- **D-07:** Using a Firmware ability consumes the player's **full turn**. You can move OR use Firmware, not both. This is consistent with how WAIT already works — Firmware activation is another action type that consumes the turn through `TurnManager.submitAction()`.
- **D-08:** Firmware abilities are defined as **JSON entity templates** with an `AbilityDef` component. Each Firmware is its own entity template (e.g., `phase-shift.json`, `neural-spike.json`) containing: `heatCost`, `range`, `effectType`, `damageAmount`, and other ability-specific fields. The FirmwareSystem reads `AbilityDef` from the equipped entity to determine behavior. Consistent with the project constraint: "Every entity type definable in JSON, no hardcoded entity classes."

### Kernel Panic Consequence Resolution
- **D-09:** Kernel Panic effects are represented as a **lightweight status effect stub**. A minimal `StatusEffects` component is created in Phase 8 containing an array of `{ name: string, duration: number, magnitude: number }` entries. A simple tick-down system removes expired effects each turn. Phase 9 replaces this with the full `StatusEffectSystem` — the component schema should be designed with forward-compatibility in mind.
- **D-10:** Kernel Panic rolls happen **after the ability resolves**. The Firmware fires, deals damage/moves/reveals, THEN the overclock check triggers. The player gets the benefit but pays the price afterward. "It worked, but at what cost?"
- **D-11:** CRITICAL_REBOOT (161%+ Heat tier) causes the player to **skip their next N turns** (stunned, enemies get free attacks) and **forces a Heat vent to 0**. This is the "nuclear option" — devastating but self-correcting. Prevents infinite overclock stacking. The exact number of skipped turns is agent's discretion (suggest 2-3).
- **D-12:** Kernel Panic probability is **modified by Shell stats and equipment**. The base percentages from FIRM-04 (15%/30%/50%/75%) are starting points. Stability stat reduces the roll chance (e.g., `effectiveChance = baseChance - stabilityModifier`). This pairs with D-03 — Stability becomes THE defensive stat against Heat risk, covering both dissipation rate and Kernel Panic probability. Equipment modifiers (FIRM-10) can further reduce chances in later phases.

### Vent Action Economy
- **D-13:** Venting removes **50% of current Heat** (percentage-based). More useful when very hot, less useful at moderate Heat. Creates a "sweet spot" where players Vent at peak Heat for maximum value. The percentage is stored as a configurable value for future equipment modification.
- **D-14:** Venting applies a **vulnerability flag** — the player's defense is reduced (e.g., armor halved or set to 0) until their next turn. Enemies deal bonus or unmitigated damage while the player is venting. This creates tactical positioning decisions: don't Vent when enemies are adjacent.
- **D-15:** Venting **always succeeds** once committed. No interruption mechanic. The risk is in the decision to Vent (exposing yourself via vulnerability), not in whether the Vent resolves.
- **D-16:** Venting has **no cooldown**. The player can Vent every turn if they choose, but each Vent turn is a turn not moving, attacking, or using Firmware. The turn cost is the natural gating mechanism.

### Agent's Discretion
- Exact Zod schema shapes for `HeatComponent`, `AbilityDef`, and `StatusEffects` components
- Cursor rendering implementation (PixiJS overlay vs separate sprite layer)
- Exact Stability-to-dissipation and Stability-to-Kernel-Panic-chance formulas
- CRITICAL_REBOOT stun duration (2-3 turns recommended)
- How targeting mode state is managed in the input system (state machine extension, new flag, etc.)
- Whether `USE_FIRMWARE_N` actions are validated client-side before sending to server or only server-side
- Mouse click targeting integration with PixiJS event system
- How the "vulnerability" flag during Vent is implemented (status effect entry, temporary component modification, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Firmware & Heat Requirements
- `.planning/REQUIREMENTS.md` §Firmware & Neural Heat — FIRM-01 through FIRM-11 define Heat bar, Kernel Panic table, dissipation, venting, starter abilities, drops, and equipment modifiers
- `.planning/ROADMAP.md` §Phase 8 — Success criteria, plan breakdown (08-01 through 08-04), and dependencies

### Phase 7 Context (Direct Dependency)
- `.planning/phases/07-shell-equipment-data-model/07-CONTEXT.md` — Shell stat model, Port architecture, Loadout data flow, equipment slot decisions that Phase 8 builds upon

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries (engine vs game vs shared), data flow, key abstractions
- `.planning/codebase/STRUCTURE.md` — Where to add new code, naming conventions, directory purposes
- `.planning/codebase/CONVENTIONS.md` — File naming, code style, import organization

### ECS & Entity Template System
- `src/engine/ecs/types.ts` — `defineComponent()` function and `ComponentDef` type (canonical component creation pattern)
- `src/shared/components/shell.ts` — `ShellComponent` with Stability stat (influences Heat dissipation and Kernel Panic chance per D-03, D-12)
- `src/shared/components/port-config.ts` — `PortConfig` with `maxFirmware` slot limits
- `src/shared/components/firmware-slots.ts` — `FirmwareSlots` component (equipped entity ID array, indexed by hotkey per D-05)
- `src/shared/components/index.ts` — Component barrel exports and `COMPONENTS_REGISTRY` array

### Action Pipeline & Input System
- `src/game/input/actions.ts` — `GameAction` enum and `DEFAULT_BINDINGS` (extend with `USE_FIRMWARE_0/1/2` per D-05)
- `src/game/input/input-manager.ts` — Input handling (extend for targeting mode per D-06)
- `src/app/api/action/route.ts` — Server-side action processing (extend for Firmware action types)

### Event System
- `src/shared/events/types.ts` — `GameplayEvents` interface (add Heat/Firmware/Kernel Panic events)
- `AGENTS.md` §Event Tier Assignment — Classification rules for where new events belong

### Combat System
- `src/game/systems/combat.ts` — Damage resolution pattern (model for Firmware damage abilities)

### Existing Game Systems
- `src/game/systems/` — Movement, AI, item-pickup systems (pattern reference for new Firmware/Heat systems)
- `src/game/entities/templates/` — JSON entity template examples (pattern for Firmware ability templates)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `defineComponent()` from `src/engine/ecs/types.ts` — Use to create `HeatComponent`, `AbilityDef`, `StatusEffects`
- `FirmwareSlots` from `src/shared/components/firmware-slots.ts` — Already holds `equipped: number[]` array indexed by hotkey
- `ShellComponent` from `src/shared/components/shell.ts` — Has `stability` field ready to influence Heat dissipation and Kernel Panic probability
- `PortConfig` from `src/shared/components/port-config.ts` — `maxFirmware` enforces slot limits
- `EventBus` from `src/engine/events/event-bus.ts` — Wire Heat/Firmware/Kernel Panic events
- `createCombatSystem` pattern — Model for creating `createHeatSystem`, `createFirmwareSystem`, `createKernelPanicSystem`
- `GameAction` enum from `src/game/input/actions.ts` — Extend with `USE_FIRMWARE_0/1/2` and `VENT`

### Established Patterns
- One component per file in `src/shared/components/` with Zod schema — new components follow this
- JSON entity templates with mixin inheritance — Firmware templates follow this pattern
- `COMPONENTS_REGISTRY` array in barrel export — new components registered here
- `GameplayEvents` interface in `src/shared/events/types.ts` — new events added here (Heat/Firmware are gameplay-meaningful, not client-only)
- System factory pattern: `createXSystem(world, grid, eventBus, ...)` returning `{ init(), dispose() }`
- Server action processing in `route.ts` with `ActionRequestSchema` validation

### Integration Points
- `src/game/input/actions.ts` — New `GameAction` entries for Firmware hotkeys and Vent
- `src/game/input/input-manager.ts` — Targeting mode state management
- `src/app/api/action/route.ts` — New action type branches for Firmware use and Vent
- `src/shared/components/index.ts` — Register `HeatComponent`, `AbilityDef`, `StatusEffects`
- `src/game/setup.ts` — Wire new systems (HeatSystem, FirmwareSystem, KernelPanicSystem)
- `src/shared/events/types.ts` — New gameplay events (HEAT_CHANGED, FIRMWARE_ACTIVATED, KERNEL_PANIC_TRIGGERED, VENT_STARTED)
- `src/game/entities/templates/` — New Firmware ability JSON templates

</code_context>

<specifics>
## Specific Ideas

- Stability stat pulls double duty: influences both Heat dissipation rate AND Kernel Panic roll probability. This is a deliberate design choice to make Stability the central defensive stat against overclock risk.
- Cursor targeting must support both keyboard and mouse — this is more complex than the simpler direction-based option, but gives players flexibility and sets up the targeting infrastructure for future abilities.
- The lightweight StatusEffects stub should be designed with Phase 9 forward-compatibility in mind — the component schema should accommodate the full trigger/payload system without requiring a breaking migration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-firmware-neural-heat-system*
*Context gathered: 2026-03-29*
