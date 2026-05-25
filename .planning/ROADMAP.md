# Roadmap

- [v2.0 Milestone Completed](milestones/v2.0-ROADMAP.md) - [2026-05-11]

## Phases

- [ ] **Phase 18: Hierarchical Entity Foundation** - Implement Items as full ECS entities capable of hosting Software.
- [ ] **Phase 19: Combat Stat Pipeline & Turn Costs** - Implement dynamic stat calculation and turn-cost for gear changes.
- [ ] **Phase 20: Tiered Loot Distribution** - Update enemy drop tables with tiered Weapons, Armor, and Software.
- [ ] **Phase 21: Inventory & Item Tooltips** - Create the in-run inventory overlay and manual hover-tooltip system.
- [x] **Phase 22: Equipment Interaction (Drag & Drop)** - Implement manual drag-and-drop loadout management. (completed 2026-05-25)

## Phase Details

### Phase 18: Hierarchical Entity Foundation

**Goal**: Items are first-class entities that can contain other entities (Software).
**Depends on**: None (Initial v2.1 phase)
**Requirements**: EQP-02
**Success Criteria**:

  1. Items (Weapons/Armor) can be instantiated from JSON as entities with IDs and component data.
  2. Item entities possess "slots" (references) that can hold Software entity IDs.
  3. Picking up a complex item correctly moves the parent entity and all child software entities into the `RunInventory`.

**Plans**: TBD

### Phase 19: Combat Stat Pipeline & Turn Costs

**Goal**: Gear affects combat and changing it takes time.
**Depends on**: Phase 18
**Requirements**: LMC-02, EQP-03
**Success Criteria**:

  1. Combat system calculates effective Damage/Armor by summing Player base + Equipped gear + Installed software.
  2. Stat calculation is performant and dynamic, avoiding permanent stat mutations on the player entity.
  3. Every equipment action (Equip, Uninstall, etc.) increments the game turn counter via the Turn Manager.

**Plans**: 3 plans
Plans:
**Wave 1**

- [ ] 19-01-PLAN.md — EquipmentSlots component + combat stat pipeline rewrite

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 19-02-PLAN.md — Turn cost wiring via intent/pipeline extension
- [ ] 19-03-PLAN.md — BurnedSoftware removal sweep + player entity initialization

### Phase 20: Tiered Loot Distribution

**Goal**: Populate the world with varied equipment tied to enemy tiers.
**Depends on**: Phase 18
**Requirements**: LMC-01
**Success Criteria**:

  1. Enemy tiers (Swarm, Elite, Boss) drop appropriate tiered Software, Weapons, and Armor.
  2. Item drops on the map preserve their internal entity state (e.g., pre-installed software).
  3. The `rot-js` RNG is utilized to balance drop rates across dungeon floors.

**Plans**: TBD

### Phase 21: Inventory & Item Tooltips

**Goal**: User can inspect their gear and stats via a new UI layer.
**Depends on**: Phase 18
**Requirements**: UI-01, UI-03
**Success Criteria**:

  1. User can toggle a full-screen inventory overlay that lists all carried and equipped items.
  2. Hovering over items displays a custom-built tooltip (no external libraries) showing stats and descriptions.
  3. Tooltips dynamically list modifiers granted by installed Software.

**Plans**: TBD
**UI hint**: yes

### Phase 22: Equipment Interaction (Drag & Drop)

**Goal**: User can manage loadout via manual drag-and-drop interaction.
**Depends on**: Phase 19, Phase 21
**Requirements**: EQP-01, UI-02, SW-01, SW-02
**Success Criteria**:

  1. User can drag items from inventory to compatible equipment slots on their Shell.
  2. User can drag Software entities onto Weapon/Armor entities to "Burn" (install) them.
  3. User can drag items out of slots to return them to inventory or drop them.
  4. All drag interactions are manually implemented (no `dnd-kit`) and sync state with the server.

**Plans**: TBD
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Hierarchical Entity Foundation | 0/0 | Not started | - |
| 19. Combat Stat Pipeline & Turn Costs | 0/3 | Planning complete | - |
| 20. Tiered Loot Distribution | 0/0 | Not started | - |
| 21. Inventory & Item Tooltips | 0/0 | Not started | - |
| 22. Equipment Interaction (Drag & Drop) | 0/0 | Complete    | 2026-05-25 |
