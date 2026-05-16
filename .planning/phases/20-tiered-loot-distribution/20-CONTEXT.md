# Phase 20: Tiered Loot Distribution - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Updating enemy drop tables and the reward drop system to distribute tiered Weapons, Armor, and Software items corresponding to the 3-tier enemy hierarchy.

</domain>

<decisions>
## Implementation Decisions

### Loot Table Structure
- **D-01:** **Hardcoded in Enemy Templates** — Tiered drops will be mapped directly in each enemy's JSON template by updating their `LootTable.drops` array, keeping it simple and consistent with the current design.

### Drop Mechanics
- **D-02:** **Guaranteed + Chance** — Higher-tier enemies (Elites/Bosses) will always drop at least 1 equipment piece, plus chances for more, rather than relying purely on percentage rolls.

### Item Generation
- **D-03:** **Static Templates** — Tiered weapons and armor will be generated using static JSON templates (e.g., `rifle-v1.json`), consistent with the current software `v0-v3` pattern.

### Enemy Tier Identification
- **D-04:** **Existing LootTable.tier** — The system will use the existing `LootTable.tier` property (1-3) to identify the 3-tier hierarchy instead of introducing a new component.

### Claude's Discretion
- Implementation details for guaranteeing the equipment drop in `reward-drop.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Defines LMC-01 (Enemy drop tables updated for tiered items).

### Drop Configuration
- `src/game/generation/loot-distribution.json` — Existing depth-gated loot definitions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RewardDropSystem` (`src/game/systems/reward-drop.ts`): Handles currency and equipment drops on entity death. Will need modification to support guaranteed drops for higher tiers.
- `LootTable` component (`src/shared/components/loot-table.ts`): Existing schema with a `tier` property (1-3) and `drops` array.

### Established Patterns
- **Entity Drops:** Handled in the `CLEANUP` phase by iterating over entities with the `Dying` and `LootTable` components.
- **Rarity scaling:** Existing software templates use a `v0`, `v1`, `v2`, `v3` suffix convention for tiered versions.

### Integration Points
- Update `createRewardDropSystem` in `src/game/systems/reward-drop.ts` to implement guaranteed drops for tier 2+.
- Add/update enemy template JSON files in `src/game/entities/templates/` to include new weapon/armor templates in their `LootTable.drops`.

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

*Phase: 20-tiered-loot-distribution*
*Context gathered: 2026-05-16*
