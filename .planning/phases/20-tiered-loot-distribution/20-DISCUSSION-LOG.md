# Phase 20: Tiered Loot Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 20-Tiered Loot Distribution
**Areas discussed:** Loot Table Structure, Drop Mechanics, Item Generation, Enemy Tier Identification

---

## Loot Table Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded in Enemy Templates | Update LootTable.drops in each enemy's JSON. Simple, consistent with current design. | ✓ |
| Global Drop Tables | Define master tables by tier in a new JSON file, enemy just references its tier. | |

**User's choice:** Hardcoded in Enemy Templates (Recommended)
**Notes:** 

---

## Drop Mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Chance-based only | Everything is a % roll, even bosses. Consistent with current reward-drop.ts. | |
| Guaranteed + Chance | Elites/Bosses always drop at least 1 equipment piece, plus chances for more. | ✓ |

**User's choice:** Guaranteed + Chance
**Notes:** 

---

## Item Generation

| Option | Description | Selected |
|--------|-------------|----------|
| Static Templates | e.g., rifle-v1.json. Consistent with current software v0-v3 pattern. | ✓ |
| Base Template + Tier Scaling | e.g., rifle.json + runtime scaling based on dropped tier. | |

**User's choice:** Static Templates (Recommended)
**Notes:** 

---

## Enemy Tier Identification

| Option | Description | Selected |
|--------|-------------|----------|
| Existing LootTable.tier | Use the existing 1-3 tier value on the LootTable component. | ✓ |
| New EnemyTier Component | Explicit component. Good for AI/Behavior logic later, aligning with "3-tier enemy hierarchy" requirement. | |

**User's choice:** Existing LootTable.tier (Recommended)
**Notes:** 

---

## Claude's Discretion

- Implementation details for guaranteeing the equipment drop in `reward-drop.ts`.

## Deferred Ideas

None
