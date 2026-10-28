# Task 1: Create EquipmentSlots component and rewrite combat stat pipeline

## Status
Completed.

## Summary
- Created `src/shared/components/equipment-slots.ts` to replace `BurnedSoftware`.
- Removed `BurnedSoftware` component and barrel export.
- Updated `src/shared/components/index.ts` registry to include `EquipmentSlots`.
- Rewrote `collectDamageModifiers` and `getEffectiveArmor` in `src/game/systems/combat.ts` to utilize hierarchy traversal for on-demand stat calculation.
- Resolved all type and dependency breakages from the `BurnedSoftware` removal across the codebase.
- Verified changes with `npx tsc` and `npx vitest`.
