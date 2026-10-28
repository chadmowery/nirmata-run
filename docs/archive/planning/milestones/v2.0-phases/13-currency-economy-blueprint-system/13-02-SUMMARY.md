# Plan 13-02 Summary - Currency Drop & Pipeline Migration

## Implementation Highlights
- **Currency Drop System:** Created `src/game/systems/currency-drop.ts` which listens for `ENTITY_DIED` and spawns Scrap, Flux, or Blueprints based on enemy tier and `economy.json` drop tables.
- **Pickup Extension:** Updated `src/game/systems/item-pickup.ts` to handle `CurrencyItem` components, stacking them into the session's run inventory.
- **Pipeline Migration:**
  - Migrated `ANCHOR_DESCEND` to use inventory-based Scrap.
  - Updated `ENTITY_DIED` handler to pay out 25% Scrap pity from inventory and clear software/other currencies.
  - Enhanced `EXTRACTION_TRIGGERED` to calculate Flux bonus based on floor depth and emit `RUN_ENDED` stats.
- **Engine Integration:** Updated `createEngineInstance` in `src/game/engine-factory.ts` to include and initialize the currency drop system and pass `sessionId` to relevant systems.
- **Deprecation:** Marked `Scrap` component as deprecated in favor of the new inventory-based system.

## Verification Results
- `src/game/systems/__tests__/currency-pickup.test.ts`: PASSED
- `src/game/systems/__tests__/blueprint-drops.test.ts`: PASSED
- `src/shared/__tests__/death-pity.test.ts`: PASSED
- Manual verification of pipeline logic for extraction and death pity.
