# Architecture Patterns

**Domain:** Equipment System and Dynamic Software Inventories (v2.1)
**Researched:** 2026-05-14

## Recommended Architecture

To integrate full Weapons and Armor with the existing ECS, the system must transition from the Phase 10 "Stub" model (where Software "burned" directly onto a player's `BurnedSoftware` component) to a **Hierarchical Equipment Model**. 

Items (Weapons, Armor, Software) are full ECS entities. The Player entity holds references to equipped items, and those equipped items can, in turn, hold references to installed Software. This cleanly decouples Player base stats from Equipment stats, prevents stat bloat on the Player entity, and allows Software to be installed or uninstalled dynamically.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `RunInventory` | Stores generic unequipped `RunInventoryItem` records (Weapons, Armor, Software). | `ItemPickupSystem`, `EquipmentSystem`, UI |
| `WeaponSlots` / `ArmorSlots` | Attached to the Player. Stores entity IDs of currently equipped Weapon and Armor entities. | `EquipmentSystem`, `CombatSystem`, UI |
| `WeaponDef` / `ArmorDef` | Attached to Item entities. Defines base combat properties (e.g., base damage, damage type, base armor). | `CombatSystem` |
| `SoftwareSlots` | Attached to Item entities (Weapons/Armor). Stores entity IDs of Software installed in that specific item. | `EquipmentSystem`, `CombatSystem` |
| `EquipmentSystem` | Processes intents (`EquipIntent`, `UnequipIntent`, `InstallIntent`, `UninstallIntent`) to move entities between `RunInventory` and equipment/software slots. | `RunInventory`, Slot Components |
| `CombatSystem` | Resolves attacks by traversing the hierarchy: Player -> Equipped Weapon -> WeaponDef & Installed Software. | `WeaponSlots`, `ArmorSlots`, `SoftwareSlots` |

### Data Flow

1. **Loot Generation**: `RewardDropSystem` spawns Weapon/Armor/Software entities on the `Grid` with `Item`, `Position`, and definition components (`WeaponDef`, `SoftwareDef`).
2. **Pickup**: `ItemPickupSystem` removes the `Position` component (removing it from the map) and adds an item record to the Player's `RunInventory.items` array. The item entity is **not** destroyed.
3. **Equipping**: Client sends `EQUIP` action. Input bridge queues `EquipIntent`. `EquipmentSystem` removes the item from `RunInventory` and adds its Entity ID to the Player's `WeaponSlots.equipped` array.
4. **Software Installation**: Client sends `INSTALL` action. Input bridge queues `InstallIntent` with the Software ID and target Item ID. `EquipmentSystem` removes the Software from `RunInventory` and adds it to the target Weapon/Armor's `SoftwareSlots.equipped` array.
5. **Combat Resolution**: `CombatSystem` calculates damage by querying the Player's `WeaponSlots` -> fetching the Weapon entity -> reading `WeaponDef.damage` -> reading `SoftwareSlots` -> fetching attached Software entities to apply active modifiers.

## Patterns to Follow

### Pattern 1: Hierarchical Entity Composition
**What:** Equipment items are entities that themselves contain slot components pointing to other entities.
**When:** Whenever an equippable item can be customized with sub-items (like Software in Weapons).
**Example:**
```typescript
// Player Entity
world.addComponent(playerId, WeaponSlots, { equipped: [weaponEntityId] });

// Weapon Entity
world.addComponent(weaponEntityId, WeaponDef, { baseDamage: 15, damageType: 'physical' });
world.addComponent(weaponEntityId, SoftwareSlots, { equipped: [softwareEntityId] }); // Installed software
```

### Pattern 2: Unified Intent Queuing for Inventory Actions
**What:** All inventory mutations (Equip, Unequip, Install, Uninstall, Drop) must be processed through discrete ECS Intent components (e.g., `InstallIntent`) applied during `Phase.INPUT` and resolved in `Phase.ACTION`.
**When:** Processing UI actions from the In-Run Inventory Management Screen.
**Why:** Maintains server-authoritative validation and aligns with the existing turn-based state machine and reconciliation logic.

### Pattern 3: Generalized RunInventory
**What:** Refactoring `RunInventory` to hold generic items rather than strictly `software`.
**When:** Updating the core inventory storage.
**Example:**
```typescript
export const RunInventoryItemSchema = z.object({
  entityId: z.number(),
  templateId: z.string(),
  rarityTier: z.string(),
  itemType: z.enum(['weapon', 'armor', 'software']), // Generalized type
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mutating `BurnedSoftware` on the Player
**What:** Continuing to use the Phase 10 `BurnedSoftware` component on the player entity to track software.
**Why bad:** If a player swaps their Weapon, the Software remains "burned" onto their player entity, which violates the requirement that Software modifies the *item*, not the *shell*.
**Instead:** Software must be nested under the specific Item entity's `SoftwareSlots` component. When a weapon is unequipped to inventory, its installed software stays with the weapon.

### Anti-Pattern 2: Orphaned Inventory Entities
**What:** Destroying an entity (`addComponent(id, Dying)`) that is still referenced by an inventory array or an equipment slot.
**Why bad:** Systems like `CombatSystem` will attempt to fetch definitions for destroyed IDs, leading to fatal errors during combat calculation.
**Instead:** Ensure the `DropIntent` handler strictly validates the item is unequipped and removed from all inventory arrays before applying the `Dying` component.

### Anti-Pattern 3: Fat Player Stats
**What:** Updating the Player's core `Defense` or `Health` component permanently when Armor is equipped.
**Why bad:** Creates syncing issues on unequip and risks stat desyncs across server/client round-trips.
**Instead:** `CombatSystem` should compute the *effective* stats dynamically on-the-fly by reading the `ShellComponent` base stats + `ArmorDef` + `SoftwareDef`s during `Phase.ACTION`.

## Scalability Considerations

| Concern | Resolution |
|---------|--------------|
| **Nested Component Queries** | ECS lookup times for `world.getComponent` are O(1). Querying Player -> Weapon -> Software adds negligible overhead (max 3-4 lookups per attack). |
| **Inventory UI Sync** | The UI needs full state of inventory + equipped items + installed software. Ensure `json-diff-ts` serialization correctly captures the nested state without excessive deep-cloning of unchanged entities. |
| **Garbage Collection** | When an Item with installed Software is permanently dropped or destroyed, the system must cascade the `Dying` component to all nested Software entities to prevent ID leaks. |

## Recommended Build Order

1. **Generalized Inventory:** Refactor `RunInventory` and `ItemPickupSystem` to support generalized items (`itemType`). Update `inventory-util.ts`.
2. **Item Entities:** Create `WeaponDef`, `ArmorDef`, `WeaponSlots`, and `ArmorSlots` components.
3. **Hierarchical Refactor:** Deprecate `BurnedSoftware`. Move `SoftwareSlots` onto Weapon/Armor entities. Add Install/Uninstall intents.
4. **Combat Refactor:** Update `CombatSystem` and `resolveDamage` pipeline to source values from the new equipment hierarchy.
5. **Drop Tables:** Update `RewardDropSystem` and enemy templates to drop Weapons and Armor.
6. **UI Integration:** Build the In-Run Inventory Management Screen utilizing Zustand `ui/store.ts` bound to the new structures.

## Sources
- `.planning/PROJECT.md` (HIGH) - Core architecture mandates and Next Milestone requirements.
- `.planning/milestones/v2.0-phases/10-software-system-enhanced-combat/10-RESEARCH.md` (HIGH) - Historical context for Phase 10 "Stub" implementation (`BurnedSoftware`).
- `src/game/systems/item-pickup.ts` (HIGH) - Current item ingestion flow.
- `src/game/systems/equipment.ts` (HIGH) - Existing equipment intent mechanics.