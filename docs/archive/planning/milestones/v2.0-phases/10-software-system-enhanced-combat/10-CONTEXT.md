# Phase 10: Software System & Enhanced Combat - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Software consumable modifiers that can be "Burned" onto equipment (weapon, armor), providing stat bonuses or special effects for one run. Establishes the unified damage pipeline integrating all four customization layers: Shell stats, Firmware abilities, Augment synergies, and Software modifiers. Three starter Software types demonstrate offensive, utility, and sustain archetypes across a 4-tier version-themed rarity system.

</domain>

<decisions>
## Implementation Decisions

### Burn Mechanic
- **D-01:** Software Burns onto specific equipment pieces (weapon, armor) — not the Shell or Firmware directly. The modifier is scoped to what that equipment does.
- **D-02:** Software targets named slots on the Shell ("weapon", "armor") as burn targets. The slot is the anchor even if the underlying equipment entity is minimal/stub for Phase 10. Full equipment item entities come later.
- **D-03:** Software can be Burned **anytime during a run**, not just pre-run. Burning consumes the player's **full turn** (consistent with Vent costing a turn from Phase 8 D-16).
- **D-04:** Overwriting is allowed — player can Burn new Software over existing Software on a slot. The old Software is destroyed. Enables upgrading with better finds mid-run.
- **D-05:** Found Software goes into a **temporary run-scoped inventory** (5 slots max). Player chooses when to Burn. Unburned Software is lost on death, transferred to Stash on extraction.

### Rarity & Scaling
- **D-06:** 4 rarity tiers with **version-themed naming**: v0.x (common), v1.x (uncommon), v2.x (rare), v3.x (legendary).
- **D-07:** Linear magnitude scaling: v0.x = 1x, v1.x = 1.5x, v2.x = 2x, v3.x = 3x base effect value.
- **D-08:** v3.x (legendary) Software only drops from deep floors (10+) or Tier 3 enemies.

### Stacking Rules
- **D-09:** No duplicate Software types — each Software type can only be active once across all equipment slots. Forces build diversity.
- **D-10:** When multiple different Software effects trigger on the same action, all fire independently (additive, no conflicts). Consistent with Augment stacking (Phase 9 D-05).

### Damage Pipeline
- **D-11:** Damage calculation uses a **modifier list pattern** — collects all active modifiers (Software + Augments) into an ordered list. Each modifier transforms the damage value in sequence. Resolution order: base attack -> Software modifiers -> Augment payloads -> defense -> final damage.
- **D-12:** Software modifiers are **additive** (flat bonuses), not multiplicative. Predictable scaling, prevents runaway compounding.

### Starter Software Types
- **D-13:** Software has **typed slot restrictions** — offensive Software (Bleed.exe, Auto-Loader.msi) only burns onto weapons, defensive Software (Vampire.exe) only onto armor.
- **D-14:** **Auto-Loader.msi** allows the player to move AND use Firmware in the same turn (overrides the normal move-OR-act constraint from Phase 8 D-07). This is the premier offensive Software — dramatically increases action economy.
- **D-15:** **Vampire.exe** heal-on-kill triggers from any kill source (bump attacks and Firmware kills). Simple rule: if an enemy dies from your damage, you heal.
- **D-16:** **Bleed.exe** applies damage-over-time on physical attacks. DoT ticks at the target's turn start (consistent with Phase 9 D-03 status effect timing).

### Claude's Discretion
- Exact Zod schema shapes for SoftwareComponent, BurnedSoftware, RunInventory
- How "weapon" and "armor" slots are represented in the data model (extension of PortConfig, separate component, etc.)
- Bleed.exe DoT duration and base damage values
- Vampire.exe heal amount per kill by rarity
- Auto-Loader.msi interaction details (does it work with Vent? With targeting mode?)
- Run inventory UI representation (Phase 10 focuses on data model; full UI is Phase 15)
- Software purchase with Scrap at Neural Deck — stubbed for Phase 10, full implementation Phase 13

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Software Requirements
- `.planning/REQUIREMENTS.md` &sect;Software -- SOFT-01 through SOFT-07 define burn mechanic, death/extraction rules, starter types, stacking, rarity, purchase
- `.planning/ROADMAP.md` &sect;Phase 10 -- Success criteria, plan breakdown (10-01, 10-02, 10-03), dependencies

### Direct Dependencies (Prior Phases)
- `.planning/phases/07-shell-equipment-data-model/07-CONTEXT.md` -- Shell stat model, Port architecture, equipment slot decisions (D-03 SoftwareSlots, D-04 slot limits, D-05 death clearing)
- `.planning/phases/08-firmware-neural-heat-system/08-CONTEXT.md` -- Firmware activation flow (D-07 full turn cost), Heat system, Kernel Panic (Auto-Loader overrides D-07)
- `.planning/phases/09-status-effects-augment-synergy/09-CONTEXT.md` -- Status effect system (D-01 concurrent stacking, D-03 tick timing), Augment trigger engine (D-06 payload resolution sequence)

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` -- Layer boundaries, data flow
- `.planning/codebase/STRUCTURE.md` -- Directory layout, naming conventions
- `.planning/codebase/CONVENTIONS.md` -- Code style, import organization

### Key Source Files
- `src/shared/components/software-slots.ts` -- Existing SoftwareSlots component (equipped entity ID array)
- `src/game/systems/combat.ts` -- Current combat system (simple attack-armor, needs modifier pipeline)
- `src/shared/systems/equipment.ts` -- Equipment equip/unequip logic (handles Software slot type)
- `src/shared/pipeline.ts` -- Death clearing logic (already wipes SoftwareSlots on ENTITY_DIED)
- `src/shared/components/port-config.ts` -- PortConfig with maxSoftware slot limits

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SoftwareSlots` component (`src/shared/components/software-slots.ts`) -- Already holds `equipped: number[]`, will need extension for burn-target tracking
- Equipment system (`src/shared/systems/equipment.ts`) -- Handles equip/unequip for Software slot type via PortConfig limits
- Death clearing in `src/shared/pipeline.ts` -- Already wipes SoftwareSlots on ENTITY_DIED event
- `LootTable` component -- Enemies already have drop tables; Software templates can be added to existing drop system
- Status effect system (Phase 9) -- Bleed.exe DoT can reuse the status effect apply/tick/expire infrastructure
- `defineComponent()` pattern -- All new components follow this

### Established Patterns
- One component per file in `src/shared/components/` with Zod schema
- JSON entity templates with mixin inheritance for Software item definitions
- System factory pattern: `createXSystem(world, grid, eventBus, ...)` returning `{ init(), dispose() }`
- Action pipeline for server-validated mutations (Burn action goes through this)
- `GameplayEvents` interface for new events (SOFTWARE_BURNED, SOFTWARE_MODIFIER_APPLIED)

### Integration Points
- `src/game/systems/combat.ts` -- Refactor from simple damage calc to modifier list pipeline
- `src/shared/components/index.ts` -- Register new Software-related components
- `src/game/entities/templates/` -- New Software JSON templates (bleed.json, auto-loader.json, vampire.json)
- `src/shared/events/types.ts` -- New gameplay events for Software actions
- `src/game/input/actions.ts` -- New BURN_SOFTWARE action type

</code_context>

<specifics>
## Specific Ideas

- Auto-Loader.msi is deliberately overpowered by design -- it breaks the fundamental move-OR-act constraint. This is intentional to make it the most sought-after offensive Software and create interesting loot excitement.
- Version-themed rarity (v0.x through v3.x) reinforces the "software updates" fiction. "Found Bleed v3.0" reads naturally in the game's universe.
- The 5-slot run inventory creates constant triage decisions -- with high-frequency Software drops from all enemy tiers, players will frequently need to Burn or discard.
- Typed slot restrictions (offensive on weapon, defensive on armor) prevent degenerate builds while keeping the system simple.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 10-software-system-enhanced-combat*
*Context gathered: 2026-03-30*
