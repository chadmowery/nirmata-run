# Task 3: Migrate remaining consumers and finalize BurnedSoftware removal

## Status
Completed.

## Summary
- Migrated `software-effects.ts`, `run-ender.ts`, and `sync-bridge.ts` to read from `EquipmentSlots` and `Children` hierarchy instead of `BurnedSoftware`.
- Removed the `BurnedSoftware` component file and references from the codebase.
- Initialized `EquipmentSlots` for the player entity in `engine-factory.ts`.
- Updated existing `software.test.ts` test setups to use `EquipmentSlots` + `Children` component pattern.
- Verified removal and migration with `npx tsc` and `npx vitest` (all tests passed).
- Final `grep` confirmed zero remaining `BurnedSoftware` references in `src/`.
