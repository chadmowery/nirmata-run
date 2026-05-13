# Feature Landscape

**Domain:** Extraction Roguelike (Sci-Fi)
**Researched:** 2024-05-24

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slot-based Equipment | Core RPG/roguelike expectation. Players need visual representation of what is equipped where (Weapon, Armor, Firmware, Augments). | Medium | Dictated by the "Shell" archetype port configurations (e.g., number of available slots). |
| In-Run Inventory Interface | Players must be able to view, manage, and discard looted items versus equipped items. Must have capacity limits. | Medium | Needs descriptive tooltips detailing stat changes, Heat costs, and effects. |
| Equipment Stat Application | Equipping an item must alter ECS Component values (e.g., changing attack damage, granting abilities). | High | Requires robust ECS entity composition handling to dynamically add/remove components from the player entity. |
| Tiered Enemy Drop Tables | Standard roguelike loot loop. Tougher enemies drop better gear/software. | Low | Integrates with existing 3-tier enemy hierarchy (Corrupted Data, Static Horrors, Logic Breakers). |
| Contextual Item Actions | Right-click or action menu (Equip, Drop, Install) in inventory. | Low | Essential for basic usability without "inventory tetris". |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Neural Heat Equipment Costs | Gear isn't just "better stats"; powerful gear/firmware generates more Neural Heat. Creates risk/reward loadout puzzles. | High | Deeply ties the inventory into the core gameplay loop (Overclocking/Kernel Panic). |
| Trigger & Payload Augments | Augments are conditional (e.g., "On Overclock -> Vent 10 Heat"), creating emergent synergies rather than flat passive buffs. | High | Requires an event-bus driven interrupt system in the ECS engine. |
| Turn-Cost Inventory Management | Swapping gear or installing software *during* combat costs turns, adding tactical weight to preparation vs. adaptation. | Medium | Standard in classic roguelikes, ensures players can't freely optimize mid-firefight. |
| Hardware-Burn Software | Software installs directly onto specific gear, altering its properties for the run. Lost on death, but keeps the underlying Shell intact. | Medium | Makes gear highly modular but ephemeral. Requires entity parent/child relationships in ECS. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time Inventory Tetris | Breaks the turn-based pacing. It's a tactical game, not a reflex or spatial puzzle game. | Simple slot/weight limits with 1-click equip/drop actions. |
| Infinite Stash Mid-Run | Removes the tension of extraction. Players must choose what to keep and what to leave. | Strict inventory caps based on Shell archetype base stats. |
| Permanent Global Stat Buffs | Project constraints state Software is "burned onto equipment" and "lost on death." | Keep Software strictly scoped to modifying specific equipment entities only for the duration of the run. |
| Universal Gear Slots | Prevents balancing and class distinction. Every shell shouldn't be able to equip everything. | Enforce strict Shell "Port Configurations" (e.g., Vanguard has 2 Weapon ports, 1 Augment port). |

## Feature Dependencies

```
Shell Archetypes (Base) → Port Configurations (Defines available equipment slots)
Port Configurations → Equipment System (Equipping gear onto valid slots)
Equipment System → Neural Heat Engine (Weapons/Firmware interactions with Heat)
Event Bus (Engine) → Trigger/Payload Augments (Listening for discrete combat/movement events)
In-Run Inventory → Software Installation (Targeting specific items in inventory)
Enemy Tiers → Drop Tables (Rarity and drop pool mapping)
```

## MVP Recommendation

Prioritize:
1. **Slot-based Equipment System**: Basic Weapons and Armor mapping to ECS components, constrained by basic Shell ports.
2. **Simple In-Run Inventory**: List/Grid view with max item capacity and basic Equip/Drop actions.
3. **Updated Drop Tables**: Basic Scrap, Currencies, and standard Weapon drops mapped to the 3-tier enemy hierarchy.

Defer:
- **Trigger & Payload Augments**: High complexity, requires deep Event Bus integration. Start with basic stat-modifiers for Firmware/Weapons before adding conditional triggers.
- **Hardware-Burn Software**: Defer until the base equipment system and component composition are fully stable and tested.

## Sources

- `.planning/PROJECT.md` (Project Context & Constraints)
- Industry Standard Roguelike/Extraction Conventions (e.g., Cogmind, Caves of Qud, Escape from Tarkov)