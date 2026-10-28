---
wave: 1
depends_on: []
files_modified:
  - "src/components/ui/inventory/BackpackGrid.tsx"
  - "src/components/ui/inventory/EquipmentPanel.tsx"
  - "src/game/ui/store.ts"
autonomous: true
requirements:
  - EQP-01
  - UI-02
  - SW-01
  - SW-02
---

# Phase 22 Plan: Equipment Interaction (Drag & Drop)

<objective>
Implement manual drag-and-drop interactions to allow players to equip items, install software, and uninstall items using the native HTML5 Drag and Drop API. This includes optimistic UI updates and submitting actions through the `TurnManager`.
</objective>

<task>
<id>22-01-01</id>
<title>Add Drag and Drop functionality to BackpackGrid</title>
<read_first>
- src/components/ui/inventory/BackpackGrid.tsx
- src/components/ui/inventory/EquipmentPanel.tsx
- src/game/ui/store.ts
</read_first>
<action>
Modify `src/components/ui/inventory/BackpackGrid.tsx` to handle dragging items out and dropping items back in.
- Add `draggable={!!entityId}` to the item slots.
- Implement `onDragStart` to set `e.dataTransfer.setData('application/json', JSON.stringify({ source: 'inventory', entityId }))`.
- Implement `onDragOver` with `e.preventDefault()` to allow dropping.
- Implement `onDrop` to handle items dragged from equipment slots. When an item is dropped here, it should trigger an optimistic UI update (e.g. moving it out of the equipment slot) and submit the appropriate action (e.g. `UnequipIntent` or similar unequip action) via `TurnManager` or `eventBus` (whichever bridge is used in `gameStore` for other intents).
- Add double-click handling to auto-equip an item if only one valid slot is available.
</action>
<acceptance_criteria>
- `BackpackGrid.tsx` contains `draggable={!!entityId}`
- `BackpackGrid.tsx` contains `onDragStart` setting the data transfer payload.
- `BackpackGrid.tsx` contains `onDrop` handling the unequip/uninstall scenario.
</acceptance_criteria>
</task>

<task>
<id>22-01-02</id>
<title>Add Drop functionality to EquipmentPanel for Equipping and Installing</title>
<read_first>
- src/components/ui/inventory/EquipmentPanel.tsx
- src/game/ui/store.ts
</read_first>
<action>
Modify `src/components/ui/inventory/EquipmentPanel.tsx` to act as drop targets.
- Implement `onDragOver` (with `e.preventDefault()`), `onDragEnter`, and `onDragLeave` to provide visual feedback (e.g., adding a highlight class when hovered, using Accent color `#00F0FF` for valid, Destructive `#FF0055` for invalid as per UI-SPEC).
- Implement `onDrop` on the Weapon and Armor slots. When an item with `source: 'inventory'` is dropped, check compatibility.
- If it's a Weapon/Armor, trigger `EquipIntent` via the game bridge.
- If it's Software and dropped on a Weapon/Armor slot (or its nested software indicator), trigger the appropriate installation intent.
- Ensure the items inside the `EquipmentPanel` are themselves `draggable={true}` and set their source as `'equipment'` so they can be dragged back to the Backpack.
</action>
<acceptance_criteria>
- `EquipmentPanel.tsx` contains `onDragOver` and `e.preventDefault()`.
- `EquipmentPanel.tsx` contains `onDrop` logic for handling equipped items and software.
- `EquipmentPanel.tsx` items are `draggable={true}`.
</acceptance_criteria>
</task>

<task>
<id>22-01-03</id>
<title>Implement Optimistic Updates in UI Store</title>
<read_first>
- src/game/ui/store.ts
</read_first>
<action>
Modify `src/game/ui/store.ts` to support optimistic equipment changes during drag-and-drop.
- Add store actions like `optimisticEquipItem(entityId: number, slot: string)` and `optimisticUnequipItem(slot: string)` that temporarily mask the inventory and equipment state.
- Ensure that the store calls `incrementInventoryRevision()` to prompt UI refreshes.
- Note: Since we rely on server reconciliation, if the action is invalid, the server delta will naturally revert these optimistic states.
</action>
<acceptance_criteria>
- `store.ts` contains optimistic update functions for equipment/inventory.
- `incrementInventoryRevision` is called when these functions execute.
</acceptance_criteria>
</task>
