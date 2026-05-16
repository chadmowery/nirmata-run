# 20-01-SUMMARY.md

## Objective
Update the reward drop system to use deterministic RNG and implement guaranteed equipment drops for higher-tier enemies.

## Accomplishments
- Refactored `src/game/systems/reward-drop.ts` to use `rot-js`'s `RNG.getUniform()` instead of `Math.random()` for deterministic behavior.
- Implemented guaranteed equipment drop logic for entities with `LootTable.tier >= 2`.
- Added comprehensive unit tests in `src/game/systems/reward-drop.test.ts` to verify deterministic RNG usage and drop guarantees.
- All tests pass, ensuring requirement LMC-01 is satisfied.
