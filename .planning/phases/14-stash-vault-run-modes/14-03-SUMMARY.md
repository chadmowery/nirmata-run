# Plan 14-03 Summary: Run Modes & Leaderboards

## Objective
Implement run launch API, mode-aware death handling, leaderboard system, and attempt tracking enforcement.

## Changes
- **Run Launch API**: Implemented `POST /api/run-mode/launch` with validation for vault overflow, attempt tracking for daily/weekly modes, and session registration.
- **Availability API**: Implemented `GET /api/run-mode/available` to check attempt status and eligibility.
- **Leaderboard System**:
    - **Submission**: `POST /api/leaderboard/submit` calculates scores server-side from run stats and persists them in period-specific JSON files.
    - **Retrieval**: `GET /api/leaderboard/daily` and `GET /api/leaderboard/weekly` return top 50 rankings.
- **Mode-Aware Run Ender**: Updated `RunEnderSystem` and `EngineInstance` to propagate `runMode`, enabling future mode-specific death logic (e.g., shell reset in Weekly One-Shot).
- **Scoring Logic**: Implemented `calculateScore` in `src/game/systems/run-mode-config.ts` using weights from `economy.json`.
- **Verification**: Created integration tests for run launch and attempt tracking in `src/app/api/run-mode/__tests__/launch.test.ts`.

## Self-Check
- [x] Run launch API validates attempt eligibility, returns mode config with seed
- [x] Run-ender propagates runMode for penalties
- [x] Leaderboard scores are server-calculated from run stats
- [x] Daily/Weekly leaderboards stored as JSON files per period
- [x] Attempt tracking prevents multiple launches per period
- [x] Overflow blocks run launch
- [x] SUMMARY.md created
