# Phase 22: Equipment Interaction (Drag & Drop) - Research

## Context and Goal
The goal of this phase is to allow users to manage their loadout using manual drag-and-drop interactions. Users should be able to drag items between the inventory backpack grid and equipment slots (weapons, armor, software). It requires an optimistic UI update, relying on native HTML5 Drag and Drop APIs, and interacting with the TurnManager to submit actions (`EquipIntent` and `UninstallIntent`), costing 1 turn as specified by Phase 19.

## Architecture & Code Insights

### UI State and Optimistic Updates
The `gameStore` in `src/game/ui/store.ts` manages the UI state. We need to handle dragged item state. We already have:
- `draggedItem`
- `dragOverSlot`
Currently these are typed as `VaultItem` (for Hub). We need to extend this for in-run drag-and-drop, likely using the entity IDs (`number`) for dragged items and a string/identifier for target slots.

For optimistic updates:
- When an item is dragged and dropped, the UI store should immediately reflect the change (e.g. moving an entity ID from the backpack slot to the weapon slot).
- Then, submit the action via the Turn Manager. If it's invalid, the server reconciliation will automatically roll back the UI state to the authoritative server state.

### HTML5 Drag and Drop API
- **Draggable elements**: Add `draggable={true}` and `onDragStart` to inventory items in `BackpackGrid.tsx` and slots in `EquipmentPanel.tsx`.
- **Drop targets**: Add `onDragOver` (must call `e.preventDefault()` to allow dropping), `onDragEnter`, `onDragLeave`, and `onDrop` to the target slots.
- **Data Transfer**: Use `e.dataTransfer.setData('text/plain', entityId.toString())` to pass the entity ID being dragged.

### Connecting to the Turn Manager
- In the `GameContext` available on `window` (or via React context if refactored), we can access `gameContext.world` or `gameContext.eventBus` / `turnManager` to dispatch the intent.
- `TurnManager.submitAction({ type: 'EQUIP', entity: playerId, item: entityId, slot: 'weapon' })` (or similar depending on `actions.ts`).

### UI Elements to modify
- `src/components/ui/inventory/BackpackGrid.tsx`
- `src/components/ui/inventory/EquipmentPanel.tsx`
- Add a new nested Software slot display to Weapons and Armor in `EquipmentPanel.tsx` if not already present.

## Pitfalls & Edge Cases
- **Invalid Targets**: Prevent highlighting or dropping into incompatible slots. The native API allows checking compatibility via standard logic in `onDragOver`, but the drop feedback relies on `onDragOver`'s `preventDefault`.
- **Nested Software Installation**: Dropping a software on a Weapon vs a specific software slot on that weapon.
- **Click Fallback**: Double-clicking an item in `BackpackGrid` needs to intelligently find the first valid empty slot and auto-equip it if there's no ambiguity.

## Validation Architecture
- **V-01**: Dragging an item sets the appropriate `dataTransfer` payload.
- **V-02**: Dropping an item on a valid slot triggers an optimistic update in the UI state and submits an `EquipIntent` to the game engine.
- **V-03**: Dropping an item on an invalid slot provides negative feedback and resets the state.
- **V-04**: Double-clicking an item in the backpack triggers an `EquipIntent` if there is exactly one valid slot.
- **V-05**: Dropping an equipped item back into the backpack triggers an `UninstallIntent`.
