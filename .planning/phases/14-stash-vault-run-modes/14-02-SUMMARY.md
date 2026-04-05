# Plan 14-02 Summary: Run Mode Config & Seed Rotation

## Objective
Create run mode configuration system with seed rotation for deterministic competitive runs.

## Changes
- **RunModeConfig**: Implemented `src/game/systems/run-mode-config.ts` with distinct configurations for Simulation, Daily Challenge, and Weekly One-Shot modes, including death penalties and attempt rules.
- **SeedRotation**: Implemented `src/game/systems/seed-rotation.ts` to handle server-side seed generation and automated rotation (24h for daily, 7 days for weekly).
- **Economy Scoring**: Added `scoring` weights to `src/game/entities/templates/economy.json` to support competitive mode evaluation.
- **Persistence**: Seeds and rotation timestamps are persisted in `data/seeds/rotation.json`.
- **Verification**: Implemented unit tests for run mode selection and seed rotation logic in `src/game/systems/run-mode-config.test.ts`.

## Self-Check
- [x] Three run modes (simulation, daily, weekly) have distinct config objects
- [x] Simulation uses random seed, unlimited attempts, real gear
- [x] Daily/Weekly use server-generated shared seeds from rotation file
- [x] Each mode specifies correct death penalties
- [x] Scoring formula weights are configurable in economy.json
- [x] SUMMARY.md created
