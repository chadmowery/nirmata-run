# Phase 12 - Plan 02 Summary: Stability System Core

## Completed Tasks
- Created `Stability` and `Scrap` components.
- Implemented `StabilitySystem` to handle per-turn and per-floor stability drain.
- Integrated low-stability damage logic into the turn loop.
- Extended `src/shared/pipeline.ts` to handle Scrap pity payouts on death and secure scrap on extraction.
- Updated `src/game/ui/store.ts` and `src/game/ui/sync-bridge.ts` to track and sync stability and scrap values.

## Verification Results
- Stability drain logic implemented and listening to `PLAYER_ACTION`.
- Scrap secure logic added to `EXTRACTION_TRIGGERED`.
- Pity payout added to `ENTITY_DIED`.
