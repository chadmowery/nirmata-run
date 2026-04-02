# Phase 13: Currency, Economy & Blueprint System - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Three-tier currency system (Scrap, Neural Blueprints, Flux) with a unified run inventory model, Blueprint discovery-compilation-installation lifecycle, weekly "Format C:" reset with Legacy Code degradation, server-validated economy with admin tooling, persistent player profiles, Software purchasing shop stub, and Shell upgrade transactions (Flux-based, reset weekly).

</domain>

<decisions>
## Implementation Decisions

### Currency Drop Model
- **D-01:** All currencies (Scrap, Blueprints, Flux) drop as **physical pickup entities** on the ground when enemies die. Consistent with existing item-pickup system. Player walks over to collect.
- **D-02:** All currencies **occupy run inventory slots** (5-slot shared inventory from Phase 10). Stack sizes are **uncapped** — a single Scrap stack can hold any amount. Currency competes with Software for inventory space.
- **D-03:** **Replace ScrapComponent** with inventory-based Scrap. Remove the Phase 12 `ScrapComponent` and migrate Scrap entirely into the run inventory system. Anchor interaction reads Scrap from run inventory instead of a dedicated component.
- **D-04:** **No extraction multipliers** — what you picked up is what you get. Depth-based loot tables already handle risk/reward (deeper floors drop more/better).
- **D-05:** Blueprints drop as **identified Locked Files** — the entity label shows exactly what Firmware/Augment it unlocks (e.g., "Locked: Phase_Shift.sh") before pickup. Enables informed inventory triage decisions.
- **D-06:** **Flux drops from both sources** — small Flux drops from Tier 2/3 enemies AND bonus Flux awarded on successful extraction. Two faucets for tuning flexibility.
- **D-07:** **Tier 1 enemies have a tiny Blueprint chance** (~2%). Tier 2/3 are the primary Blueprint/Flux sources per ECON-02, but Tier 1 can occasionally surprise. Teaches the mechanic early.
- **D-08:** Currency pickup feedback is **stack increment + message log entry** only ("Picked up 15 Scrap", "+1 Locked File: Neural_Spike.exe"). No visual flair differentiation by rarity.

### Blueprint Lifecycle
- **D-09:** Compilation happens **between-run only** — during a run, Locked Files sit in inventory as dead weight occupying precious slots. Extract to unlock your finds. Reinforces the extraction loop.
- **D-10:** Compiling a Blueprint **unlocks it permanently for the week** — install on any Shell, unlimited copies. The Locked File is consumed but the unlock persists in the library until weekly reset.
- **D-11:** **Duplicate Locked Files convert to Flux** — picking up a Blueprint for something already compiled auto-converts to a Flux bonus. Every Blueprint drop has value, no feel-bad moments.
- **D-12:** **Augments follow identical lifecycle** to Firmware — drop as Locked File, compile with Flux, install from library. Unified system, one mental model (BP-01 through BP-07 apply to both).
- **D-13:** **No player-facing compilation UI in Phase 13** — build the server-side compile action and test programmatically (API + test harness). Phase 15 adds the Neural Deck workshop UI.
- **D-14:** Blueprint library stored **server-side in player profile** (JSON file per session). API endpoints for compile/install/list operations. Client reads via API.
- **D-15:** **Two-gate installation** — compilation costs Flux, installation onto a Shell costs Scrap. Two currencies, two meaningful spending decisions.
- **D-16:** **Uninstall returns to library** — uninstalling Firmware/Augment from a Shell puts it back in the library. Can reinstall on a different Shell (paying Scrap again). Flexible loadout management.

### Weekly Reset (Format C:)
- **D-17:** Installed Firmware becomes **Legacy Code with doubled Heat cost** — painful but usable in emergencies. Strong pressure to re-farm but Legacy is a safety net. No Version Patch effectiveness reduction (BP-06 dropped).
- **D-18:** Installed Augments **also become Legacy** — Legacy Augments have **halved payload magnitude** (e.g., Static_Siphon gives +2.5 HP shield instead of +5). Always trigger, just weaker.
- **D-19:** **Shell upgrades reset to base model weekly** — stat and Port slot upgrades purchased with Flux are wiped on Format C:. Shell upgrades are a weekly progression layer, not permanent.
- **D-20:** **Currency persists through reset** (Scrap and Flux carry over) but with a **configurable cap** per currency type. Cap is expandable (expansion mechanism deferred to a later phase). Prevents infinite hoarding.
- **D-21:** **Uncapped during runs, capped on extraction** — no cap enforcement while playing. Cap applied when currency transfers to persistent storage on extraction. Excess is lost.
- **D-22:** Winner's Item uses a **curated rotation** — pre-defined list of special Blueprints that rotate weekly. Not tied to player performance. Simpler, predictable for balance.
- **D-23:** Weekly reset triggered via **admin-only API endpoint** — manual trigger, not automatic scheduling. Not available to players. Full reset logic built, temporal scheduling deferred.

### Economy Pacing
- **D-24:** **Generous compilation tempo** — 1-2 successful extractions from floors 5-10 yield enough Flux to compile one Blueprint. Fast feedback loop.
- **D-25:** **Scrap sinks**: Anchor descend costs (Phase 12), Blueprint installation (D-15), and **Software purchasing** (new shop stub implementing SOFT-07).
- **D-26:** **Flux sinks**: Blueprint compilation (D-10) and **Shell upgrades** (stats + Port slots, SHELL-05 API). Both reset weekly, creating recurring demand.
- **D-27:** Death pity payout is **Scrap only** (25% per ECON-04). All Blueprints and Flux are lost on death. Death is punishing for premium currencies.
- **D-28:** All economy values defined in a **centralized `economy.json`** config file — drop rates per tier, Flux compilation costs, Scrap installation costs, currency caps, pity ratios, shop prices. One file to tune the entire economy.

### Software Shop
- **D-29:** **Rotating stock per week** — shop offers a fixed selection of Software tied to the weekly seed. All players see the same shop. Creates weekly meta around available Software.
- **D-30:** Shop sells **up to v2.x (rare) Software**. Legendary v3.x only from deep floor drops. Shop is for baseline preparation, not peak builds.
- **D-31:** Shop is **API-only in Phase 13** — no player-facing UI. Phase 15 adds the Neural Deck shop interface.

### Server Validation & Admin
- **D-32:** **Hybrid validation** — in-run operations (currency pickup, Anchor costs) go through the action pipeline. Between-run operations (compile, install, purchase, upgrade, reset) use dedicated REST API endpoints.
- **D-33:** **Full admin CRUD** — admin API endpoints for: trigger weekly reset, inspect player wallet/library/upgrade state, grant/revoke currency, force-compile blueprints, modify caps, set Legacy status. Complete control surface for testing and live ops.

### Player Profile Persistence
- **D-34:** **JSON file per player session** in `data/profiles/{sessionId}.json` (gitignored). Contains wallet balances, Blueprint library, Shell upgrade state, shop state. Simple, inspectable, no database dependency.

### Legacy Visual Identity
- **D-35:** Legacy items get a `legacy: true` flag + **"DEPRECATED" tag with desaturated icon** treatment. Clear at a glance. Consistent with the software/code theming.
- **D-36:** Legacy status **visible in HUD during runs** — Firmware hotkey bar shows Legacy items with desaturated treatment. Heat cost displays the doubled value. Player always knows which abilities are Legacy.

### Claude's Discretion
- Exact Zod schema shapes for WalletComponent, BlueprintLibrary, PlayerProfile, ShopState
- Currency drop amounts per enemy tier (within economy.json)
- Flux compilation cost formula per Blueprint rarity
- Scrap installation cost scaling
- Default currency cap values
- Software shop stock size and rotation algorithm
- Shell upgrade cost formulas and max upgrade levels
- Admin API authentication/authorization mechanism
- Duplicate Blueprint → Flux conversion amount
- Extraction Flux bonus calculation
- Run inventory migration details (integrating currency with existing 5-slot system)
- Player profile read/write patterns and file locking strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Currency & Economy — ECON-01 through ECON-06 define 3-tier currency, drop rules, server validation, faucet/sink balance
- `.planning/REQUIREMENTS.md` §Blueprint & Weekly Reset — BP-01 through BP-07 define Blueprint lifecycle, compilation, weekly reset, Legacy Code, Winner's Item
- `.planning/REQUIREMENTS.md` §Software — SOFT-07 defines Software purchasing with Scrap (shop stub)
- `.planning/REQUIREMENTS.md` §Shell & Loadout — SHELL-05 defines Shell upgrades (Flux cost, stats + Port slots)
- `.planning/ROADMAP.md` §Phase 13 — Success criteria, plan breakdown (13-01 through 13-04), dependencies

### Direct Dependencies (Prior Phases)
- `.planning/phases/07-shell-equipment-data-model/07-CONTEXT.md` — Shell stat model, Port architecture, equipment slots, ShellComponent with Stability/Speed/Armor stats
- `.planning/phases/08-firmware-neural-heat-system/08-CONTEXT.md` — Firmware activation flow, Heat system, FirmwareSlots, AbilityDef JSON templates, Kernel Panic. TODO at `src/game/systems/firmware.ts:23` for Flux compilation gate
- `.planning/phases/10-software-system-enhanced-combat/10-CONTEXT.md` — Run inventory (5 slots, D-05), Software rarity tiers (v0.x-v3.x, D-06), BurnedSoftware, extraction/death rules
- `.planning/phases/12-multi-floor-generation-stability-extraction/12-CONTEXT.md` — ScrapComponent (D-27, to be replaced), Anchor descend cost (D-23), extraction pipeline, death pity (D-28), depth-based loot tables (D-26)

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, data flow, action pipeline
- `.planning/codebase/STRUCTURE.md` — Directory layout, naming conventions
- `.planning/codebase/CONVENTIONS.md` — Code style, import organization

### Key Source Files
- `src/shared/components/scrap.ts` — Existing ScrapComponent to be removed and replaced with inventory-based currency
- `src/shared/pipeline.ts` — Action pipeline with EXTRACTION_TRIGGERED handler, death clearing logic. Extend for currency pickup actions, Anchor Scrap deduction from inventory
- `src/game/systems/firmware.ts` — Contains TODO(Phase 13) for Flux compilation gate. Firmware drop mechanic needs Locked File treatment
- `src/game/systems/item-pickup.ts` — Existing item pickup system. Extend for currency entity pickup and inventory stacking
- `src/game/systems/run-inventory.ts` — Run inventory registry (5 slots). Integrate currency stacking with uncapped stack size
- `src/game/entities/templates/scrap.json` — Existing Scrap entity template. Extend pattern for Blueprint and Flux entity templates
- `src/game/entities/templates/spawn-tables/depth-distribution.json` — Enemy spawn tables by depth. Pattern for currency drop tables
- `src/game/systems/anchor-interaction.ts` — Anchor system reads ScrapComponent for descend cost. Must migrate to inventory-based Scrap
- `src/app/api/action/route.ts` — Server action processing. Add new action types for economy operations
- `src/shared/components/index.ts` — Component registry. Add new economy components, remove ScrapComponent

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Scrap` component (`src/shared/components/scrap.ts`) — Pattern reference, but will be removed. Replacement is inventory-based.
- `runInventoryRegistry` (`src/game/systems/run-inventory.ts`) — 5-slot run inventory. Extend for currency stacking (uncapped).
- `item-pickup` system — Handles walking over entities and collecting. Extend for currency pickup with stack increment.
- `depth-distribution.json` — Existing depth-based spawn tables. Follow pattern for `economy.json` drop rate configuration.
- `scrap.json` entity template — Existing Scrap drop entity. Clone pattern for Blueprint and Flux entity templates.
- `EXTRACTION_TRIGGERED` handler in pipeline — Already handles item transfer on extraction. Extend for currency cap enforcement.
- Death clearing in pipeline — Already wipes FirmwareSlots, AugmentSlots, SoftwareSlots. Extend for Scrap pity payout from inventory.
- `defineComponent()` pattern — Use for new WalletComponent (persistent), BlueprintLibrary, etc.
- `anchor-interaction.ts` — Anchor descend cost logic. Migrate from ScrapComponent to inventory read.

### Established Patterns
- One component per file in `src/shared/components/` with Zod schema
- JSON entity templates with mixin inheritance in `src/game/entities/templates/`
- System factory pattern: `createXSystem(world, grid, eventBus, ...)` returning `{ init(), dispose() }`
- Action pipeline for server-validated mutations
- REST API routes in `src/app/api/` for server endpoints
- Event-driven architecture (eventBus.emit/on)

### Integration Points
- `src/shared/components/scrap.ts` — Remove, replace with inventory-based currency
- `src/game/systems/anchor-interaction.ts` — Migrate Scrap reading from component to inventory
- `src/shared/pipeline.ts` — New action types for currency operations, extraction cap enforcement
- `src/game/systems/run-inventory.ts` — Currency stacking support, uncapped stack sizes
- `src/game/systems/item-pickup.ts` — Currency entity recognition and stack increment
- `src/app/api/` — New endpoints: compile, install, uninstall, purchase, upgrade, admin CRUD, shop stock
- `data/profiles/` — New directory for player profile JSON persistence (gitignored)
- `src/game/entities/templates/` — New Blueprint and Flux entity templates, economy.json config
- `src/shared/components/` — New components for persistent economy state (used by API layer)
- `src/game/systems/firmware.ts` — Remove TODO stub, implement Locked File compilation gate

</code_context>

<specifics>
## Specific Ideas

- Currency occupying inventory slots creates constant triage pressure — with 5 shared slots for Software AND currency, players must choose: carry more loot or more spending power? This is the Phase 10 run inventory decision amplified.
- The two-gate system (Flux to compile, Scrap to install) creates a satisfying dual-resource loop where both currencies feel meaningful. Scrap isn't just "the boring one."
- Shell upgrades resetting weekly alongside Blueprints makes Flux the central weekly progression currency — compile Blueprints AND upgrade your Shell, both from the same pool, both wiped on Monday. Forces prioritization.
- Legacy Augments with halved payload (not halved trigger chance) means they're reliably weaker, not randomly unreliable. Players can plan around reduced numbers rather than gambling on procs.
- Duplicate Blueprints converting to Flux eliminates the worst roguelike loot moment (duplicate rare drop) and turns it into progression. Every Blueprint drop advances the player.
- The admin CRUD API is essential for economy tuning — being able to grant currency, force-compile, and trigger resets enables rapid iteration on economy.json balance values without playing through full runs.

</specifics>

<deferred>
## Deferred Ideas

- Currency cap expansion mechanism — caps are configurable in JSON, expansion logic deferred to a later phase
- Automatic weekly reset scheduling (cron/calendar-based) — Phase 13 builds reset logic, scheduling deferred
- Player-facing compilation and shop UI — deferred to Phase 15 (Neural Deck Hub)
- Version Patch effectiveness reduction (BP-06) — dropped from scope, Legacy penalty is Heat/magnitude doubling only
- Software shop UI — API-only in Phase 13, full shop interface in Phase 15

</deferred>

---

*Phase: 13-currency-economy-blueprint-system*
*Context gathered: 2026-04-02*
