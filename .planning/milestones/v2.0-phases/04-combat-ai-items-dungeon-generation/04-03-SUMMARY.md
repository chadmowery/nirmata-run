# Phase 4, Plan 03 Summary: Item Pickup System

## Objective
Implement a walk-over item pickup system with immediate effects (heal).

## Requirements Addressed
- **ITEM-01**: Items are entities on the grid.
- **ITEM-02**: Player picks up items by walking over them.
- **ITEM-03**: Immediate-effect items apply effects on pickup.

## Key Changes
- **New Components**: `Item` (marker) and `PickupEffect` (effect definition).
- **New System**: `ItemPickupSystem` subscribed to `ENTITY_MOVED`.
- **System Logic**:
    - Validates mover is player.
    - Queries `grid.getItemsAt(toX, toY)`.
    - Applies `HEAL` effect to player's `Health` component.
    - Emits `ITEM_PICKED_UP` event.
    - Removes item from grid and destroys entity.
- **Wiring**:
    - `MovementSystem` now emits `ENTITY_MOVED` on success.
    - `ItemPickupSystem` initialized in `setup.ts`.
- **Data**: Updated `health-potion.json` template with `item` and `pickupEffect` components.

## Verification
- **Automated Tests**: `src/game/systems/item-pickup.test.ts` (6 tests, 100% pass).
- **Integration**: `src/game/setup.test.ts` and other game tests pass (67 total).
- **TypeScript**: `tsc --noEmit` clean.
- **ESLint**: New files are lint-free.
