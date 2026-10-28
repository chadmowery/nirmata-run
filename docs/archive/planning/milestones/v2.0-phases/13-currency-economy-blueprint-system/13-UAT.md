# Phase 13 UAT — Currency, Economy & Blueprint System

**Status:** ✅ Complete
**Phase:** 13
**Updated:** 2026-04-02

---

## Test Sessions

### Session 1: Core Economy Loop
- **Goal:** Verify currency drops, pickup, extraction, and persistent profile updates.
- **Tests:** UAT-13-01 through UAT-13-05
- **Result:** ✅ PASSED (Verified via `currency-pickup.test.ts`, `blueprint-drops.test.ts`, and `death-pity.test.ts`)

### Session 2: Blueprint & Shell Lifecycle
- **Goal:** Verify between-run economy operations (compile, install, upgrade).
- **Tests:** UAT-13-06 through UAT-13-09
- **Result:** ✅ PASSED (Verified via `compile.test.ts`, `install.test.ts`, `upgrade.test.ts`, and `shop-rotation.test.ts`)

### Session 3: Meta-Progression & Admin
- **Goal:** Verify weekly reset (Format C:), Legacy Code, and Admin tools.
- **Tests:** UAT-13-10 through UAT-13-13
- **Result:** ✅ PASSED (Verified via `reset.test.ts`, `legacy-code.test.ts`, `winners-item.test.ts`, and `legacy-system-integration.test.ts`)

---

## User Acceptance Tests

| ID | Feature | Scenario | Expected Result | Status |
|----|---------|----------|-----------------|--------|
| UAT-13-01 | Currency Drops | Kill an enemy (Tier 1/2/3) | Physical entity (Scrap/Flux/Blueprint) drops on ground with correct label. | ✅ pass |
| UAT-13-02 | Currency Pickup | Walk over dropped currency | Amount added to run inventory (stacking), message log entry confirms pickup. | ✅ pass |
| UAT-13-03 | Inventory Triage | Pick up currency when slots full | Error message "Inventory full", entity remains on ground. | ✅ pass |
| UAT-13-04 | Extraction Bonus | Extract successfully | Base Flux + floor-multiplier bonus awarded; transferred to persistent wallet. | ✅ pass |
| UAT-13-05 | Death Pity | Die during a run | 25% of carried Scrap transferred to persistent wallet; all Blueprints/Flux lost. | ✅ pass |
| UAT-13-06 | Compilation | Compile Blueprint via API | Flux deducted from profile wallet; Blueprint added to persistent library. | ✅ pass |
| UAT-13-07 | Installation | Install Blueprint on Shell | Scrap deducted from profile wallet; item added to `installedItems` for that Shell. | ✅ pass |
| UAT-13-08 | Software Purchase| Purchase Software from shop | Scrap deducted from wallet; shop stock is deterministic based on weekly seed. | ✅ pass |
| UAT-13-09 | Shell Upgrade | Upgrade Shell stat | Flux deducted from wallet; Shell stat level increments with scaling cost. | ✅ pass |
| UAT-13-10 | Weekly Reset | Trigger Format C: reset | Uninstalled blueprints deleted; upgrades reset; currency capped; new week seed. | ✅ pass |
| UAT-13-11 | Legacy Firmware | Use Legacy Firmware in run | Heat cost is doubled; desaturated "DEPRECATED" tag visible in UI. | ✅ pass |
| UAT-13-12 | Legacy Augment | Trigger Legacy Augment | Payload magnitude is halved compared to standard version. | ✅ pass |
| UAT-13-13 | Admin Tools | Inspect/Grant via Admin API | Full profile inspectable; currency granted/revoked correctly for testing. | ✅ pass |

---

## Feedback & Gaps

- **Observation:** `ScrapComponent` has been successfully migrated to the unified run inventory system.
- **Observation:** Shop stock generation is deterministic and respects rarity caps (v2.x max).
- **Observation:** Weekly reset correctly handles the uninstalled blueprint deletion policy (BP-04).
