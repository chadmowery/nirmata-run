# Plan 14-04 Summary: Vault Rituals & Reset Integration

## Objective
Complete the Vault-to-Shell Ritual flow, admin tooling for seed/attempt management, and weekly reset integration for attempt tracking.

## Changes
- **Vault Rituals**:
    - `POST /api/vault/move-to-vault`: Implemented batch movement from overflow limbo to persistent Vault.
    - `POST /api/vault/equip-from-vault`: Implemented pre-run Ritual action to equip Firmware/Augments from Vault onto a Shell.
- **Admin Tooling**:
    - `GET/POST /api/admin/seed-rotation`: Added management endpoints for seed rotation.
    - `POST /api/admin/reset-attempts`: Added endpoint to reset player attempt tracking.
- **Weekly Reset Integration**: Updated `executeWeeklyReset` in `src/game/systems/weekly-reset.ts` to reset `attemptTracking` status during Format C: (D-15).
- **Verification**: Created a comprehensive integration test in `src/game/systems/__tests__/run-mode-integration.test.ts` verifying the full run lifecycle (launch -> extraction -> overflow block -> move to vault -> relaunch).

## Self-Check
- [x] Players can move overflow items to Vault
- [x] Players can equip items from Vault onto Shell as pre-run Ritual
- [x] Admin can manually rotate seeds and reset attempt tracking
- [x] Weekly reset resets weekly attempt tracking
- [x] Integration test verifies full run lifecycle
- [x] SUMMARY.md created
