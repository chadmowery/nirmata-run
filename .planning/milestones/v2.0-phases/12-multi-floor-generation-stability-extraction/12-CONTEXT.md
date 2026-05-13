# Phase 12: Multi-Floor Generation & Stability/Extraction - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-floor dungeon descent with floor-specific seeded generation, floor transitions via staircase entities, Reality Stability bar with dual drain (per-floor chunk + per-turn bleed), Stability Anchors every 5 floors presenting the Extract/Descend decision via a full-fidelity System Handshake UI, depth-based content scaling (enemy/loot/tile themes), run results screen for both extraction and death, BSOD death screen, and minimal Scrap currency for Anchor costs.

</domain>

<decisions>
## Implementation Decisions

### Floor Transition Architecture
- **D-01:** Regenerate-on-descent — on floor transition, destroy all non-player entities, generate a new Grid via BSP with seed derived from `runSeed_floor_N`, place new entities via `placeEntities(depth=N)`. Player entity persists with all components. Systems stay alive, only the grid and non-player entities change.
- **D-02:** No backtracking — floors are one-way. Previous floors are not cached or preserved.
- **D-03:** Staircase spawns in the room furthest from the player's spawn room (greatest distance). Deterministic from room layout.
- **D-04:** Step-on + confirm interaction — moving onto the staircase tile prompts a descent confirmation dialog. Prevents accidental descent.
- **D-05:** Max floor depth is configurable in JSON, default 15. Matches depth-distribution.json range.
- **D-06:** Voluntary descent only — staircase is available from the start of each floor. No kill/explore quota required. Speed-runners can rush, thorough players can clear.
- **D-07:** Quick glitch fade transition — brief glitch/static effect (~200ms), fade to black with scanlines (~200ms), new floor generates, fade in (~200ms), floor number flashes ("FLOOR 06"). Fast and atmospheric.

### Stability System
- **D-08:** Dual drain model — Stability drains both as a per-floor chunk on entry AND a per-turn passive bleed. Maximum extraction pressure.
- **D-09:** Linear escalation curve — both the per-floor chunk and per-turn drain increase linearly with depth. Early floors drain gently, deep floors drain aggressively. Values configurable in JSON.
- **D-10:** Stability starts at 100% from floor 1. Drain is active from the very first floor.
- **D-11:** Zero stability = degraded state — when Stability hits zero, player takes HP damage each turn (bleeding out). Player might limp to an Anchor if close enough. Creates dramatic last-ditch extraction moments.
- **D-12:** Degraded state visual feedback: both HUD corruption (scanlines, flicker, text corruption) AND progressive screen desaturation. World loses color as stability drops, HUD glitches at zero.
- **D-13:** Stability bar always visible on HUD alongside Health and Heat.
- **D-14:** Floor number and depth band label always visible on HUD (e.g., "FLOOR 07 // DEPTH BAND: STATIC HORRORS").

### Stability Anchor & Extraction
- **D-15:** Anchors appear every 5 floors (floor 5, 10, 15) as interactable entities in normal rooms (not dedicated Anchor rooms). Enemies may be present.
- **D-16:** Risky interact — player can interact with the Anchor even with enemies present in the room. Game pauses during the decision overlay.
- **D-17:** React overlay + game pause — stepping on Anchor pauses the turn loop, PixiJS applies grayscale filter to the world, React `<AnchorOverlay>` mounts on top. Player decides, overlay unmounts, game resumes.
- **D-18:** Full visual fidelity for System Handshake UI in Phase 12 — complete desaturation transition, bold condensed sans-serif typography, exact cyan/pink color palette from VIS-07. Ships looking final, not deferred to Phase 16.
- **D-19:** Categorized inventory manifest with expandable sections — Firmware / Augments / Software / Currency, each showing individual items with names, rarity, and slot info.
- **D-20:** Full risk breakdown on Descend option — shows next floor number, estimated Stability after descent, enemy tier range expected, Scrap cost to stabilize.
- **D-21:** Extract transfers all unsecured items to Stash (per STAB-04). Brief de-rezz animation (~1-2 seconds) before transitioning to results screen.
- **D-22:** Anchor breaks after Descend (per STAB-05). Player cannot re-use it. Must reach the next Anchor.
- **D-23:** Descend costs Scrap (common currency). Cost configurable in JSON, scales with depth.

### Depth Content Scaling
- **D-24:** Both palette shifts AND structural BSP parameter changes per depth band. Floors 1-5 cool/cyan tones with large rooms, floors 5-10 warmer/amber with cramped corridors, floors 10-15 red/corrupted with open arenas.
- **D-25:** Four special room types: Treasure rooms (guaranteed high-value loot, no enemies), Challenge rooms (extra-dense enemies, locked exit, bonus loot on clear), Hazard rooms (damaging/restricting terrain), and guaranteed Anchor placement on floors 5/10/15.
- **D-26:** JSON depth-gated loot tables — same pattern as depth-distribution.json for enemies. Firmware drops only below floor 5, rare Augments below floor 10 (per FLOOR-05). Software rarity weighted by depth.

### Scrap Currency (Minimal Implementation)
- **D-27:** Minimal ScrapComponent (`{ amount: number }`) on the player entity. Enemies drop Scrap on death (flat amount from loot table). Anchor deducts Scrap for Descend. Phase 13 replaces with full WalletComponent.
- **D-28:** On extraction, Scrap transfers to stash. On death, player receives 25% of collected Scrap as pity payout.

### Run Results Screen
- **D-29:** Full results screen showing: extraction manifest (items kept), run stats (floors cleared, enemies killed, turns taken, peak Heat, Firmware activations), cause of end (specific details), and score breakdown (depth/kill/loot/speed bonuses).
- **D-30:** Different visual tone for extraction vs death — extraction gets clean cyan/success aesthetic, death gets BSOD treatment (Safety Orange, "FATAL_EXCEPTION").
- **D-31:** BSOD reason is context-specific — each death source maps to a unique error message (e.g., "KERNEL_PANIC_DURING_COMBAT", "REALITY_STABILITY_COLLAPSE", "TERMINATED_BY: SYSTEM_ADMIN", "BUFFER_OVERFLOW_DETONATION").

### Death Flow
- **D-32:** Death -> death animation (glitch dissolve, ~500ms) -> BSOD screen (2-3 sec with context-specific reason) -> results screen (death variant showing items lost, 25% Scrap pity) -> "REINITIALIZE" button returns to main menu / game entry point.
- **D-33:** Post-run destination is the current game entry point (main menu). Phase 15 will redirect to the Neural Deck Hub.

### Claude's Discretion
- Exact stability drain values per floor (chunk size, per-turn bleed rate, linear scaling formula)
- Exact Scrap drop amounts per enemy tier and Anchor Descend cost scaling
- Degraded state HP damage rate per turn
- BSP parameter values per depth band (room size ranges, corridor width, room count)
- Palette shift implementation (PixiJS tint vs color matrix filter vs tileset swap)
- Special room spawn probability per depth band
- Score formula components and weights
- Staircase and Anchor entity tile appearance
- De-rezz extraction animation implementation details
- BSOD screen layout, font sizes, animation timing
- Confirmation dialog style for staircase descent
- Floor number flash animation duration and style

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Stability & Extraction — STAB-01 through STAB-09 define Stability bar, Anchors, Extract/Descend, item loss, System Handshake UI
- `.planning/REQUIREMENTS.md` §Multi-Floor Dungeon — FLOOR-01 through FLOOR-07 define floor generation, transitions, depth scaling, environmental variety, special rooms
- `.planning/ROADMAP.md` §Phase 12 — Success criteria, plan breakdown (12-01 through 12-04), dependencies

### Direct Dependencies (Prior Phases)
- `.planning/phases/07-shell-equipment-data-model/07-CONTEXT.md` — Equipment slot system, death clearing (D-05), Shell persistence
- `.planning/phases/08-firmware-neural-heat-system/08-CONTEXT.md` — Full turn cost pattern (D-16 Vent), energy-based turn system, Heat system
- `.planning/phases/10-software-system-enhanced-combat/10-CONTEXT.md` — Run inventory (D-05), extraction event (EXTRACTION_TRIGGERED), Software loss on death
- `.planning/phases/11-enemy-hierarchy/11-CONTEXT.md` — Depth-based spawn distribution (D-14, D-15), depth-distribution.json, all 6 enemy types, enemy count per room scaling

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, data flow
- `.planning/codebase/STRUCTURE.md` — Directory layout, naming conventions
- `.planning/codebase/CONVENTIONS.md` — Code style, import organization

### Key Source Files
- `src/game/generation/dungeon-generator.ts` — Current single-floor BSP generation. Extend for floor-specific seeds and depth-based BSP parameters.
- `src/game/generation/entity-placement.ts` — Already supports `depth` parameter and depth-based spawn tables via `depth-distribution.json`. Extend for special room types and Anchor/staircase placement.
- `src/game/engine-factory.ts` — Creates one dungeon per call. Needs floor transition architecture (regenerate grid + entities, persist player).
- `src/game/entities/templates/spawn-tables/depth-distribution.json` — Existing depth-based enemy spawn tables (3 depth bands). Extend for loot tables.
- `src/shared/pipeline.ts` — Action pipeline with existing EXTRACTION_TRIGGERED handler and death clearing logic. Extend for Anchor actions and Scrap operations.
- `src/game/events/types.ts` — GameEvents interface. Add ANCHOR_INTERACTION, FLOOR_TRANSITION, STABILITY_CHANGED, RUN_ENDED events.
- `src/shared/components/` — Component directory. Add StabilityComponent, ScrapComponent, StaircaseMarker, AnchorMarker.
- `src/rendering/render-system.ts` — PixiJS rendering. Needs grayscale filter for Anchor overlay, desaturation for stability drain, glitch transition for floor changes.
- `src/rendering/filters/glitch-effects.ts` — Existing glitch effect filters. Reuse for floor transitions and degraded state HUD corruption.
- `src/engine/turn/turn-manager.ts` — Turn manager. Needs pause/resume for Anchor interaction.
- `src/game/ui/sync-bridge.ts` — UI state sync. Extend for Stability bar, floor number, Anchor overlay state.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateDungeon()` — BSP generation with seed, retry logic, connectivity validation. Extend with depth-based BSP parameters.
- `placeEntities()` with `depth` parameter — Already dispatches to depth-distribution.json spawn tables. Extend for staircase/Anchor entity placement and special room types.
- `depth-distribution.json` — 3-band enemy spawn configuration. Pattern to follow for loot tables.
- `EXTRACTION_TRIGGERED` event handler in pipeline.ts — Stub exists for run inventory transfer. Extend for full extraction logic.
- Death clearing in pipeline.ts (`ENTITY_DIED` handler) — Already wipes FirmwareSlots, AugmentSlots, SoftwareSlots, BurnedSoftware, run inventory. Extend for Scrap pity payout.
- `glitch-effects.ts` — Existing PixiJS filter pipeline for glitch rendering. Reuse for floor transitions, degraded state, BSOD effects.
- `createRunEnderSystem()` — Existing run-end system (System_Admin touch). Extend for stability-zero and extraction run-end triggers.
- `RNG.setSeed()` from rot-js — Seeded RNG. Use for floor-specific seed derivation.
- `DungeonConfig`/`DungeonResult` interfaces — Extend for depth-specific BSP parameters.

### Established Patterns
- One component per file in `src/shared/components/` with Zod schema
- JSON entity templates with mixin inheritance in `src/game/entities/templates/`
- System factory pattern: `createXSystem(world, grid, eventBus, ...)` returning `{ init(), dispose() }`
- Energy-based turn system — enemy speed determines turn frequency
- Action pipeline for server-validated mutations
- `defineComponent()` pattern for new components
- PixiJS filter system for visual effects
- Event-driven architecture (eventBus.emit/on)

### Integration Points
- `src/game/engine-factory.ts` — Major refactor: extract floor generation into a reusable function, add `descendToFloor()` method that regenerates grid/entities while preserving player and systems
- `src/game/generation/dungeon-generator.ts` — Accept depth-specific BSP config parameters
- `src/game/generation/entity-placement.ts` — Add staircase and Anchor entity placement, special room type selection
- `src/shared/components/` — New components: StabilityComponent, ScrapComponent, StaircaseMarker, AnchorMarker, FloorState
- `src/game/systems/` — New systems: stability (drain/tick), floor-manager (transitions), anchor-interaction
- `src/components/` — New React components: AnchorOverlay, RunResultsScreen, BSODScreen, StabilityBar, FloorIndicator
- `src/rendering/render-system.ts` — Grayscale filter, desaturation, floor transition effects
- `src/shared/pipeline.ts` — ANCHOR_EXTRACT, ANCHOR_DESCEND, DESCEND_FLOOR action types
- `src/game/input/actions.ts` — New GameAction entries for Anchor interaction

</code_context>

<specifics>
## Specific Ideas

- The dual drain model (per-floor chunk + per-turn bleed) with linear escalation creates a naturally increasing pressure curve where early floors feel relaxed and deep floors feel desperate — perfectly complementing the Anchor every-5-floors rhythm.
- Degraded state (HP bleed at stability zero) instead of instant death creates dramatic "limping to the Anchor" moments that will become stories players share. Combined with HUD corruption + desaturation, it's the game's most atmospheric mechanic.
- System Handshake at full visual fidelity in Phase 12 (not deferred to Phase 16) means this signature UX moment is complete when the phase ships. The Anchor interaction is the emotional core of the extraction loop.
- Anchors in normal rooms with risky interact (enemies may be present) creates a tactical layer: rush to the Anchor while enemies close in, or clear the room first and spend precious turns/stability.
- Context-specific BSOD messages ("TERMINATED_BY: SYSTEM_ADMIN", "REALITY_STABILITY_COLLAPSE") make each death feel unique and reinforce the sci-fi fiction. Players will screenshot these.
- The minimal ScrapComponent is a deliberate stub — just enough to make the Anchor cost work without over-building the economy before Phase 13.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-multi-floor-generation-stability-extraction*
*Context gathered: 2026-03-31*
