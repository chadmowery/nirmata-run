# Phase 21-01 Summary

## Summary of Changes
- Added `gridIndex` to `RunInventoryItemSchema` in `src/shared/components/run-inventory.ts` to support item placement in the inventory grid.
- Expanded `gameStore` in `src/game/ui/store.ts` with `inventoryVisible` and `inventoryRevision` state, along with actions to toggle visibility and increment the revision.
- Added `TOGGLE_INVENTORY` action to `GameAction` and bound it to the 'I' key in `src/game/input/actions.ts`.
- Integrated `TOGGLE_INVENTORY` handling in `src/game/setup.ts`.
- Updated `src/game/ui/sync-bridge.ts` to increment `inventoryRevision` on `RUN_INVENTORY_SYNCED` events.

## Verification
- Verified schema modifications with unit tests.
- Verified store functionality, input bindings, and setup integration with existing test suites.
- Confirmed type safety with `tsc`.
