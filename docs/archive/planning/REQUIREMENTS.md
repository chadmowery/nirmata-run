# Requirements: Milestone v2.1 Equipment & Inventory System

## Overview
This milestone transitions the game from a stubbed software system to a full hierarchical equipment model. Players will manage Weapons, Armor, and Software through a new in-run UI, with every item contributing to a dynamic combat stat pipeline.

## Milestone Requirements

### Core Equipment (EQP)
- [x] **EQP-01**: User can equip Weapons and Armor into dedicated slots on their Shell archetype.
- [ ] **EQP-02**: Equipment items are implemented as full ECS entities capable of hosting nested component slots (e.g., Software slots on a Weapon).
- [ ] **EQP-03**: Swapping equipment or modifying software costs the player 1 turn, enforced by the Turn Manager.

### Inventory & UI (UI)
- [ ] **UI-01**: User can access a dedicated in-run inventory management screen to view all carried items.
- [x] **UI-02**: User can move items between inventory and equipment slots via a custom-built drag-and-drop interaction.
- [ ] **UI-03**: User can view detailed item stats, heat costs, and installed software modifiers via hover-tooltips.

### Software Systems (SW)
- [x] **SW-01**: User can install Software items into available slots on equipped Weapons and Armor to modify their behavior.
- [x] **SW-02**: User can uninstall Software from gear to return it to the inventory, allowing for tactical re-configuration during a run.

### Loot & Mechanics (LMC)
- [ ] **LMC-01**: Enemy drop tables are updated to include tiered Weapons, Armor, and Software items corresponding to the 3-tier enemy hierarchy.
- [ ] **LMC-02**: The combat engine dynamically calculates effective stats (Damage, Armor, Heat) by traversing the equipment hierarchy, ensuring no permanent stat mutation on the player entity.

## Future Requirements (Deferred)
- **AUG-01**: Augment "Trigger & Payload" synergy engine (Deferred to v2.2).
- **MKT-01**: In-run trade/merchant system for equipment.

## Out of Scope
- **Audio Effects**: Sound feedback for inventory actions (v3.0).
- **Persistent Stash**: Managing equipment between runs (this milestone focuses on the in-run loop).
- **Multiplayer Trading**: System remains strictly single-player.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EQP-01 | Phase 22 | Passed |
| EQP-02 | Phase 18 | Pending |
| EQP-03 | Phase 19 | Pending |
| UI-01 | Phase 21 | Pending |
| UI-02 | Phase 22 | Passed |
| UI-03 | Phase 21 | Pending |
| SW-01 | Phase 22 | Passed |
| SW-02 | Phase 22 | Passed |
| LMC-01 | Phase 20 | Pending |
| LMC-02 | Phase 19 | Pending |
