# Plan 14-01 Summary: Persistent Vault & Extraction Pipeline

## Objective
Implement persistent Vault storage and extraction-to-Vault pipeline with overflow management.

## Changes
- **Extended PlayerProfile Schema**: Added `vault`, `overflow`, and `attemptTracking` to the persistent player profile in `src/game/systems/profile-persistence.ts`.
- **VaultManager**: Implemented `VaultManager` in `src/game/systems/vault-manager.ts` to handle item deposits, discards, sales, and overflow-to-vault movement.
- **Extraction Pipeline**: Updated `src/game/systems/run-ender.ts` to include extracted software items in the `RUN_ENDED` event payload.
- **Server Persistence**: Updated `src/app/api/action/route.ts` to capture `RUN_ENDED` events and store extracted items in the player's profile overflow limbo.
- **API Endpoints**:
    - `GET /api/vault/overflow`: List items currently in overflow.
    - `POST /api/vault/discard`: Discard an item from overflow.
    - `POST /api/vault/sell`: Sell an overflow item for Scrap.
- **Verification**: Created and verified unit tests for `VaultManager` in `src/game/systems/vault-manager.test.ts`.

## Self-Check
- [x] Extracted items persist in Vault between runs and sessions via PlayerProfile JSON
- [x] Vault enforces 30-slot cap via overflow limbo — extraction always succeeds, overflow managed before next run
- [x] Players can discard or sell overflow items via API endpoints
- [x] Vault items are usable in ANY run mode
- [x] All tasks committed individually (or grouped logically)
- [x] SUMMARY.md created
