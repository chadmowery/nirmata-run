# Phase 10: Software System & Enhanced Combat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 10-software-system-enhanced-combat
**Areas discussed:** Burn mechanic, Rarity & scaling, Stacking rules, Damage pipeline

---

## Burn Mechanic

### Burn Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-run only | Burn at Neural Deck before run. Loadout locked in-dungeon. | |
| Pre-run + mid-run | Burn at Neural Deck or at Stability Anchors. | |
| Anytime in-run | Burn found Software at any point during a run. | ✓ |

**User's choice:** Anytime in-run
**Notes:** Maximum flexibility -- player can Burn Software whenever they find it during a run.

### Burn Target

**User's choice:** Software should be burned onto equipment only (weapon, armor, etc.)
**Notes:** User provided this as free text, rejecting Shell-level and Firmware-level targeting. Software modifier is scoped to what the equipment piece does.

### Equipment Entity Model

| Option | Description | Selected |
|--------|-------------|----------|
| Introduce equipment now | Create weapon/armor as full equippable item entities. | |
| Burn onto Shell slots | Software targets named slots ("weapon", "armor") as burn targets. | ✓ |
| You decide | Agent's discretion. | |

**User's choice:** Burn onto Shell slots (Recommended)
**Notes:** Keeps Phase 10 focused on Software while establishing the burn-target pattern.

### Overwrite Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite allowed | Player can Burn new Software over existing. Old is destroyed. | ✓ |
| Permanent once Burned | Locked for rest of run once Burned. | |

**User's choice:** Overwrite allowed

### Loot Pickup Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Run inventory | Found Software goes to temporary run-scoped bag. | ✓ |
| Auto-Burn on pickup | Software immediately Burns onto best available slot. | |

**User's choice:** Run inventory

### Run Inventory Size

| Option | Description | Selected |
|--------|-------------|----------|
| Small (5 slots) | Forces frequent Burn decisions. | ✓ |
| Medium (10 slots) | Comfortable buffer. | |
| Unlimited | No inventory pressure. | |

**User's choice:** Small (5 slots)

---

## Rarity & Scaling

### Tier Count

| Option | Description | Selected |
|--------|-------------|----------|
| 3 tiers | Common / Uncommon / Rare | |
| 4 tiers | Common / Uncommon / Rare / Legendary | ✓ |

**User's choice:** 4 tiers

### Naming Convention

| Option | Description | Selected |
|--------|-------------|----------|
| Data-themed | Patch / Update / Build / Kernel | |
| Classic RPG | Common / Uncommon / Rare / Legendary | |
| Version-themed | v0.x / v1.x / v2.x / v3.x | ✓ |

**User's choice:** Version-themed

### Scaling Curve

| Option | Description | Selected |
|--------|-------------|----------|
| Linear (1x/1.5x/2x/3x) | Predictable flat scaling | ✓ |
| Exponential (1x/2x/4x/8x) | Dramatic power spikes | |

**User's choice:** Linear

---

## Stacking Rules

### Duplicate Policy

| Option | Description | Selected |
|--------|-------------|----------|
| No duplicates | Each Software type active once across all slots | ✓ |
| Duplicates allowed | Same Software on different slots, effects stack | |

**User's choice:** No duplicates

### Multi-Effect Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| All fire independently | Each effect resolves on its own, additive | ✓ |
| Priority queue | Effects have priority order, may block each other | |

**User's choice:** All fire independently

---

## Damage Pipeline

### Pipeline Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Modifier list pattern | Ordered list of modifiers transforming damage value in sequence | ✓ |
| Event-driven hooks | Software/Augments listen for DAMAGE_CALCULATING events | |

**User's choice:** Modifier list pattern

### Math Model

| Option | Description | Selected |
|--------|-------------|----------|
| Additive (flat bonuses) | Predictable, prevents runaway scaling | ✓ |
| Multiplicative | Dramatic scaling, compounds quickly | |
| Mixed | Flat first, then single multiplicative pass | |

**User's choice:** Additive

### Slot Restrictions

| Option | Description | Selected |
|--------|-------------|----------|
| Any slot | Any Software on any equipment slot | |
| Typed slots | Offensive on weapons, defensive on armor | ✓ |

**User's choice:** Typed slots

### Auto-Loader.msi Effect

| Option | Description | Selected |
|--------|-------------|----------|
| Reduced Heat cost | Flat Heat cost reduction per rarity | |
| Bonus action chance | % chance for free bonus action after Firmware | |
| Move + Firmware | Player can move AND use Firmware same turn | ✓ |

**User's choice:** Move + Firmware
**Notes:** Deliberately breaks Phase 8 D-07 (move OR act). Intended as the premier offensive Software.

### Vampire.exe Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both (bump + Firmware kills) | Any kill triggers heal | ✓ |
| Bump-attack only | Only melee kills trigger heal | |

**User's choice:** Both

---

## Claude's Discretion

- Zod schema shapes for new components
- Equipment slot data model specifics
- Bleed.exe DoT values, Vampire.exe heal amounts
- Auto-Loader.msi interaction edge cases
- Run inventory UI representation (data model focus for Phase 10)

## Deferred Ideas

None -- discussion stayed within phase scope.
