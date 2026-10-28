# Stability & Anchor Extraction System

The extraction loop is driven by **Reality Stability** ([`src/shared/components/stability.ts`](../../src/shared/components/stability.ts), [`src/game/systems/stability.ts`](../../src/game/systems/stability.ts)) and the choice between descending deeper via **Staircases** or extracting at **Stability Anchors** ([`src/game/systems/anchor-interaction.ts`](../../src/game/systems/anchor-interaction.ts)).

---

## 1. Reality Stability Mechanics

* **Initial Stability**: Players start Floor 1 with `100 / 100` Stability.
* **Per-Turn Bleed**: During `Phase.PRE_TURN`, Stability decays by `0.01` per turn (`perTurnBleedBase`), scaled upward by `1.1^(floor - 1)`.
* **Floor Descent Chunk Drain**: Entering a new floor (`FloorTransitioned` tag) drains an immediate chunk of Stability:
  $$\text{Chunk Drain} = 5 + (\text{currentFloor} - 1) \times 0.5$$
* **Zero-Stability Collapse**: If `Stability.current <= 0` during `Phase.CLEANUP`, [`RunEnderSystem`](../../src/game/systems/run-ender.ts) terminates the run immediately with `FATAL: REALITY_ANCHOR_COLLAPSED`.

---

## 2. Staircases vs. Stability Anchors

* **Staircases ([`StaircaseOverlay.tsx`](../../src/components/ui/StaircaseOverlay.tsx))**:
  * Spawn on Floors `1` through `14` (`entity-placement.ts`).
  * Stepping onto a Staircase prompts the player to descend to `currentFloor + 1` at `0` currency cost (`STAIRCASE_DESCEND`).
* **Stability Anchors ([`AnchorOverlay.tsx`](../../src/components/ui/AnchorOverlay.tsx))**:
  * Spawn in a dedicated room on **milestone Floors `5`, `10`, and `15`** (`depth % 5 === 0`).
  * Stepping onto an Anchor pauses the turn manager, applies a grayscale desaturation filter to the world canvas, and opens the **System Handshake** UI (`ANCHOR_LINK_ESTABLISHED`).

---

## 3. Stability Anchor UX Flow ([`AnchorOverlay.tsx`](../../src/components/ui/AnchorOverlay.tsx))

### A. Risk/Reward Status Header
Displays `ANCHOR_LINK_ESTABLISHED // FLOOR_{N}` and a segmented Stability bar (`STABILITY: {X}%`) that shifts from Neon Cyan (`#00F0FF`) to Electric Pink (`#FF0055`) and jitters when Stability drops below `30%`.

### B. Inventory Manifest (Left Panel)
Lists all currently **Unsecured** items carried in the Shell (`[UNSECURED]` badge):
* Equipped Firmware & Augments
* In-run collected Software (`RunInventory.software`)
* Collected Raw Scrap & Flux

### C. The Decision Fork (Right Panel)
Two high-contrast action blocks:
1. **`[DE-REZZ & EXTRACT]`** (Neon Cyan — `ANCHOR_EXTRACT`):
   * Submits `ExtractionIntent` (`reason: 'manual'`).
   * Ends the run with `RUN_ENDED` (`reason: 'extraction'`), securing all collected Scrap, Flux (plus depth bonus `10 + 2 * floor`), and Software into the player's persistent Profile and Vault, and submitting the official score to the Daily/Weekly leaderboard.
2. **`[STABILIZE & DESCEND]`** (Electric Pink border — `ANCHOR_DESCEND`):
   * Submits `DescentIntent` (`targetFloor: currentFloor + 1`).
   * Purges current floor entities via the Death Protocol, generates the next floor with deterministic seed `${runSeed}_floor_${targetFloor}`, and restores full-color rendering.
   * *Note*: Designing and wiring a non-zero Scrap/Flux stabilization cost and 40% Stability refill on `ANCHOR_DESCEND` is tracked in [TRACKING.md](../TRACKING.md).
