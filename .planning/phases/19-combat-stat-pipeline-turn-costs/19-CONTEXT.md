# Phase 19: Combat Stat Pipeline & Turn Costs - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Making equipped gear dynamically affect combat stats (Damage/Armor) without permanently mutating the player entity's base components, and making all equipment management actions (Equip, Uninstall) cost one game turn via the standard turn/intent pipeline.

</domain>

<decisions>
## Implementation Decisions

### Stat Pipeline Design
- **D-01:** **Calculation trigger** — On-demand at combat time. The hierarchy traversal runs inside `collectDamageModifiers` (and its defensive counterpart) each time damage is resolved. No cached derived stat. Satisfies LMC-02's "no permanent stat mutation" constraint.
- **D-02:** **Traversal anchor** — The player entity gets an `EquipmentSlots` component `{ weapon: EntityId | null, armor: EntityId | null }`. `collectDamageModifiers` walks `EquipmentSlots.weapon` → weapon entity → `SlotComponent` children → `SoftwareDef`/modifier data. Armor stat is read from `EquipmentSlots.armor` entity + its children.
- **D-03:** **Slot shape** — Weapon + Armor only. No additional slots in this phase.

### Turn Cost Mechanism
- **D-04:** **Intent type** — Equipment actions are submitted as named intent types: `EquipIntent` and `UninstallIntent` (or a single `EquipmentActionIntent` with an `action` discriminant). Routed through `TurnManager.submitAction(...)` like all other player actions.
- **D-05:** **Turn cycle behavior** — When the intent resolves (Phase.ACTION), the equipment slot updates, then the standard turn cycle continues normally — enemies take their turns. The player spent their action on gear management; enemies respond.

### Software Modifier Source
- **D-06:** **Hierarchy traversal replaces BurnedSoftware** — `collectDamageModifiers` is updated to walk the entity hierarchy (via `EquipmentSlots` → weapon children) instead of reading `BurnedSoftware`. The `BurnedSoftware` component is removed entirely — no shim, no dead code.

### Claude's Discretion
- Exact naming and structure of the intent types (`EquipIntent` vs. `EquipmentActionIntent`).
- Whether `collectDamageModifiers` and the new armor-traversal logic are co-located in `combat.ts` or extracted into a `stat-pipeline.ts` helper.
- How `SlotComponent` children are queried — exact component names from Phase 18 output.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Defines LMC-02 (dynamic stat calculation, no permanent mutation) and EQP-03 (equipment actions cost 1 turn).

### Prior Phase Context
- `.planning/phases/18-hierarchical-entity-foundation/18-CONTEXT.md` — Defines the entity hierarchy shape: bi-directional references (D-04), cascading destruction (D-03), Zod slot validation (D-06), flat delta serialization (D-05). Phase 19 builds directly on this output.

### Architecture
- `.planning/codebase/ARCHITECTURE.md` — Engine/Game layer separation; TurnManager patterns; system phase execution order (PRE_TURN → ACTION → REACTION → CLEANUP).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `collectDamageModifiers` (`src/game/systems/combat.ts:49`): Already assembles damage modifiers at combat time from `BurnedSoftware` and `AugmentSlots`. Phase 19 replaces the `BurnedSoftware` read with a hierarchy walk via `EquipmentSlots`.
- `resolveDamage` (`src/game/systems/combat.ts:26`): Pure function; no changes needed — it accepts modifiers array and defense value.
- `ShellStatsSystem` / `propagateShellStats` (`src/game/systems/shell-stats.ts`): Shows the dirty-tag pattern for stat sync. Phase 19 does NOT use this pattern (on-demand instead), but it's a reference for how stat propagation is done elsewhere.
- `TurnManager.submitAction` (`src/engine/turn/turn-manager.ts`): Entry point for all player actions. New intent types hook in here.

### Established Patterns
- **Intent-driven actions:** All player actions attach an intent component (e.g., `AttackIntent`, `MoveIntent`) and are processed by a system in the appropriate phase. `EquipIntent`/`UninstallIntent` follow this pattern.
- **Component-level validation:** Zod schemas on all component definitions (`src/shared/components`). New `EquipmentSlots` component needs a schema.
- **`Attack`/`Defense` as player base stats:** These components hold the Shell's base values and must NOT be mutated by equipment — gear bonuses are calculated on top at combat time.

### Integration Points
- `collectDamageModifiers` in `src/game/systems/combat.ts` — update traversal source.
- New system (e.g., `EquipmentSystem`) registered at `Phase.ACTION` to handle `EquipIntent`/`UninstallIntent`.
- `src/shared/components/index.ts` — add `EquipmentSlots` component; remove `BurnedSoftware`.
- `src/shared/components/intents.ts` (or equivalent) — add new intent component definitions.
- Player entity initialization — add `EquipmentSlots` component on spawn.

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

*Phase: 19-combat-stat-pipeline-turn-costs*
*Context gathered: 2026-05-15*
