# Plan 13-04 Summary - Weekly Reset & Legacy Code

## Implementation Highlights
- **Weekly Reset (Format C:):** Implemented `src/game/systems/weekly-reset.ts` which performs the end-of-week progression wipe:
  - Deletes all uninstalled Blueprints from the library.
  - Resets all Shell stat upgrades to base models.
  - Enforces currency caps (10,000 Scrap, 1,000 Flux).
  - Rotates the week seed and selects a Winner's Item from a curated rotation.
  - Ensures reset is idempotent per week seed.
- **Legacy Code System:** Developed `src/game/systems/legacy-code.ts` to manage the degradation of installed items:
  - Installed Firmware/Augments become "Legacy" rather than being deleted.
  - **Firmware Penalties:** Heat costs are doubled for Legacy firmware.
  - **Augment Penalties:** Payload magnitudes are halved for Legacy augments.
- **System Integration:**
  - Updated `src/game/systems/firmware.ts` to apply doubling penalties during activation.
  - Updated `src/game/systems/augment.ts` to apply halving penalties during payload resolution.
  - Enabled `isLegacy` fields in `AbilityDef` and `AugmentData` components.
- **Admin Reset Endpoint:** Fully implemented `POST /api/admin/reset` to trigger the weekly reset logic.

## Verification Results
- `src/game/systems/__tests__/legacy-code.test.ts`: PASSED
- `src/game/systems/__tests__/winners-item.test.ts`: PASSED
- `src/app/api/admin/__tests__/reset.test.ts`: PASSED
- Verified idempotency and cap enforcement logic.
