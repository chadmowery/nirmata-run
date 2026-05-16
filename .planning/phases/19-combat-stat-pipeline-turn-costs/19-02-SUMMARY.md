# Task 2: Wire equipment management actions

## Status
Completed.

## Summary
- Extended `EquipIntent`, `UnequipIntent`, `EquipActionSchema`, and `UnequipActionSchema` to support `weapon` and `armor` slot types.
- Updated `EquipmentSystem` in `src/game/systems/equipment.ts` to handle equip/unequip for `weapon` and `armor` slots by patching `EquipmentSlots`.
- Added integration tests in `src/shared/__tests__/pipeline.test.ts` verifying the action round-trip for weapon and armor gear.
- Verified changes with `npx vitest` and `npx tsc`.
