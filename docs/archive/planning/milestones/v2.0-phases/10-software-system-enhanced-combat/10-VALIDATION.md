---
phase: 10
slug: software-system-enhanced-combat
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- {test-file} --run` (< 30 seconds)
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-00-01 | 00 | 1 | W0 scaffold | scaffold | `npm run test -- src/game/systems/software.test.ts src/game/systems/combat.test.ts src/shared/pipeline.test.ts --run` | Creates | ⬜ pending |
| 10-01-01 | 01 | 2 | SOFT-01 | unit | `npm run test -- src/game/systems/software.test.ts --run` | W0 done | ⬜ pending |
| 10-01-02 | 01 | 2 | SOFT-01 | unit | `npm run test -- src/game/systems/software.test.ts --run --grep "overwrite"` | W0 done | ⬜ pending |
| 10-02-01 | 02 | 3 | SOFT-02 | integration | `npm run test -- src/shared/pipeline.test.ts --run --grep "death clearing"` | W0 done | ⬜ pending |
| 10-02-02 | 02 | 3 | SOFT-04 | unit | `npm run test -- src/game/systems/software.test.ts --run --grep "bleed"` | W0 done | ⬜ pending |
| 10-02-03 | 02 | 3 | SOFT-04 | integration | `npm run test -- src/game/systems/software.test.ts --run --grep "auto-loader"` | W0 done | ⬜ pending |
| 10-02-04 | 02 | 3 | SOFT-04 | integration | `npm run test -- src/game/systems/software.test.ts --run --grep "vampire"` | W0 done | ⬜ pending |
| 10-02-05 | 02 | 3 | SOFT-05 | unit | `npm run test -- src/game/systems/software.test.ts --run --grep "stacking"` | W0 done | ⬜ pending |
| 10-02-06 | 02 | 3 | SOFT-06 | unit | `npm run test -- src/game/systems/software.test.ts --run --grep "rarity"` | W0 done | ⬜ pending |
| 10-02-07 | 02 | 3 | SOFT-07 | unit | `npm run test -- src/game/systems/combat.test.ts --run --grep "pipeline"` | W0 done | ⬜ pending |
| 10-03-01 | 03 | 3 | SOFT-03 | unit | `npm run test -- src/game/entities/templates/__tests__/software-templates.test.ts --run` | Creates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/game/systems/software.test.ts` — stubs for SOFT-01, SOFT-04, SOFT-05, SOFT-06 (Plan 10-00)
- [x] Extend `src/game/systems/combat.test.ts` — add damage pipeline tests (SOFT-07) (Plan 10-00)
- [x] Extend `src/shared/pipeline.test.ts` — add Software death clearing test (SOFT-02) (Plan 10-00)

*Framework already installed (Vitest 4.1.2) — no additional setup needed.*
*Wave 0 scaffolds created by Plan 10-00 (wave 1) before any implementation plans run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Burn UI visual feedback | SOFT-01 | Visual rendering | Open loadout -> drag Software to slot -> verify icon appears |
| DoT damage tick animation | SOFT-04 | Visual rendering | Apply Bleed.exe -> enter combat -> verify damage numbers tick |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 10-00 creates all scaffolds)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (Wave 0 addressed by Plan 10-00)
