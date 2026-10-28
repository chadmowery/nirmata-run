# Phase 19: Combat Stat Pipeline & Turn Costs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 19-combat-stat-pipeline-turn-costs
**Areas discussed:** Stat pipeline trigger, Turn cost mechanism, Software modifier source

---

## Stat Pipeline Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand at combat time | Extend collectDamageModifiers to traverse equipment hierarchy. No cached state — calculated fresh each resolution. Aligns with LMC-02. | ✓ |
| Pre-turn dirty-tag cache | Add EquipmentTag like ShellUpdateTag, cache derived stats at Phase.PRE_TURN. More complex, enables UI stat reads. | |
| You decide | Claude picks based on existing patterns. | |

**User's choice:** On-demand at combat time

| Option | Description | Selected |
|--------|-------------|----------|
| From EquipmentSlots on player entity | EquipmentSlots component { weapon, armor }. Traversal walks equipped weapon -> children. Mirrors Phase 18 D-04. | ✓ |
| From existing Attack/Defense components | Mutate Attack.power/Defense.armor on equip, undo on unequip. Violates LMC-02. | |
| You decide | Claude picks traversal anchor. | |

**User's choice:** From EquipmentSlots on player entity

| Option | Description | Selected |
|--------|-------------|----------|
| Weapon + Armor only | { weapon: EntityId \| null, armor: EntityId \| null }. Phase 19 scope is Damage and Armor. | |
| Weapon + Armor + extras | Additional slots for future expansion. | ✓ (then walked back) |

**Notes:** User initially selected "Weapon + Armor + extras" then corrected to Weapon + Armor only. Final decision: two slots only.

---

## Turn Cost Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| New intent type: EquipIntent / UninstallIntent | Equipment actions as named intents routed through TurnManager.submitAction. Server-authoritative, consistent with existing patterns. | ✓ |
| Direct TurnManager call | Equipment logic calls turnManager.advanceTurn() directly. Simpler but bypasses validation flow. | |
| Reuse WAIT action cost | Submit action='WAIT', system detects change and applies it. Semantically wrong. | |

**User's choice:** New intent type (EquipIntent / UninstallIntent)

| Option | Description | Selected |
|--------|-------------|----------|
| Swap equipment, enemies act normally | Intent resolves in Phase.ACTION, standard turn cycle continues. | ✓ |
| Swap equipment only, no enemy actions | Gear swaps skip enemy turns — contradicts EQP-03 intent. | |

**User's choice:** Swap the equipment, then enemies act normally

---

## Software Modifier Source

| Option | Description | Selected |
|--------|-------------|----------|
| Update traversal to walk entity hierarchy | collectDamageModifiers reads EquipmentSlots -> weapon entity -> SlotComponent children -> SoftwareDef. Replaces BurnedSoftware read. | ✓ |
| Keep BurnedSoftware as a shim | Sync BurnedSoftware on equip/uninstall. combat.ts unchanged. Risk of drift. | |
| You decide | Claude picks approach. | |

**User's choice:** Update traversal to walk entity hierarchy

| Option | Description | Selected |
|--------|-------------|----------|
| Remove BurnedSoftware entirely | Pre-production — no live saves. Keeps codebase clean. Tests get updated. | ✓ |
| Keep BurnedSoftware but unused | Leave component definition, nothing reads it. Dead code. | |
| You decide | Claude decides based on what tests use. | |

**User's choice:** Remove BurnedSoftware entirely

---

## Claude's Discretion

- Exact naming and structure of the intent types (EquipIntent vs. EquipmentActionIntent with discriminant).
- Whether collectDamageModifiers and armor-traversal logic stay in combat.ts or are extracted to a stat-pipeline.ts helper.
- How SlotComponent children are queried — exact component names depend on Phase 18 implementation output.

## Deferred Ideas

None — discussion stayed within phase scope.
