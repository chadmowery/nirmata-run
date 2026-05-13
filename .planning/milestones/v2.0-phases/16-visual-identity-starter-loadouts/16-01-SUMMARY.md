# Plan 16-01 Summary: Heat Visualization Tiers & HUD Integration

Implemented the Heat tier visual escalation system with 6 discrete tiers affecting both the PixiJS game world and the React/CSS HUD.

## Key Changes

### Config & Logic
- Created `src/game/config/heat-tiers.ts` defining 6 Heat tiers:
  - Tier 0: Clean (0-49)
  - Tier 1: Jitter (50-79)
  - Tier 2: Ghosting (80-99)
  - Tier 3: Inversion (100-119)
  - Tier 4: Screen-tear (120-159)
  - Tier 5: Grayscale (160+)

### Rendering (PixiJS)
- Created `src/rendering/filters/heat-visual-effects.ts` implementing cumulative world filters:
  - Tier 2: Sprite ghosting (managed via `updateSpriteGhosting`)
  - Tier 3: Color inversion (`ColorMatrixFilter.negative(true)`)
  - Tier 4: Screen-tearing (`GlitchFilter`)
  - Tier 5: Grayscale (`ColorMatrixFilter.desaturate()`)
- Integrated into `src/rendering/render-system.ts`:
  - Added `HEAT_CHANGED` event listener to apply filters and ghosting to the player sprite.
  - Proper disposal of filters on system destroy.

### UI & HUD (React/CSS)
- Updated `src/game/ui/store.ts` to track `heatTier`, `heatValue`, and `heatMaxSafe`.
- Updated `src/game/ui/sync-bridge.ts` to sync the visual tier from the engine to the UI store on `HEAT_CHANGED`.
- Updated `src/components/ui/HUDOverlay.tsx` to apply tier-specific CSS classes to the HUD wrapper.
- Added `hudJitter` keyframes and tier classes to `src/components/ui/styles.module.css`.
- Implemented `prefers-reduced-motion` accessibility fallback for HUD jitter.

## Verification
- Unit tests in `src/rendering/filters/__tests__/heat-visual-effects.test.ts` pass (10/10).
- Handled `ColorMatrixFilter.negative(true)` argument requirement.
- Updated `src/game/ui/__tests__/store.test.ts` to align with `PlayerStats` and `UIState` changes.
