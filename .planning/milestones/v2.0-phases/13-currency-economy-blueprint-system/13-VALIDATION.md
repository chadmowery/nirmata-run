---
phase: 13
slug: currency-economy-blueprint-system
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-02
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm test -- --run --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- {affected test file} -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | ECON-01 | integration | `npm test -- src/game/systems/__tests__/currency-pickup.test.ts -x` | ✅ | ✅ green |
| 13-01-02 | 01 | 1 | ECON-05 | integration | `npm test -- src/app/api/__tests__/economy-validation.test.ts -x` | ✅ | ✅ green |
| 13-02-01 | 02 | 1 | ECON-02 | integration | `npm test -- src/game/systems/__tests__/blueprint-drops.test.ts -x` | ✅ | ✅ green |
| 13-02-03 | 02 | 1 | ECON-04 | integration | `npm test -- src/shared/__tests__/death-pity.test.ts -x` | ✅ | ✅ green |
| 13-03-02 | 03 | 2 | BP-02 | integration | `npm test -- src/app/api/economy/__tests__/compile.test.ts -x` | ✅ | ✅ green |
| 13-03-03 | 03 | 2 | BP-03 | integration | `npm test -- src/app/api/economy/__tests__/install.test.ts -x` | ✅ | ✅ green |
| 13-04-01 | 04 | 3 | BP-04 | integration | `npm test -- src/app/api/admin/__tests__/reset.test.ts -x` | ✅ | ✅ green |
| 13-04-02 | 04 | 3 | BP-05 | unit | `npm test -- src/game/systems/__tests__/legacy-code.test.ts -x` | ✅ | ✅ green |
| 13-04-03 | 04 | 3 | BP-07 | unit | `npm test -- src/game/systems/__tests__/winners-item.test.ts -x` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/game/systems/__tests__/currency-pickup.test.ts` — covers ECON-01
- [x] `src/game/systems/__tests__/blueprint-drops.test.ts` — covers ECON-02
- [x] `src/shared/__tests__/death-pity.test.ts` — covers ECON-04
- [x] `src/app/api/__tests__/economy-validation.test.ts` — covers ECON-05
- [x] `src/app/api/economy/__tests__/compile.test.ts` — covers BP-02
- [x] `src/app/api/economy/__tests__/install.test.ts` — covers BP-03
- [x] `src/app/api/admin/__tests__/reset.test.ts` — covers BP-04
- [x] `src/game/systems/__tests__/legacy-code.test.ts` — covers BP-05
- [x] `src/game/systems/__tests__/winners-item.test.ts` — covers BP-07
- [x] `src/game/systems/__tests__/profile-persistence.test.ts` — loadProfile/saveProfile (atomic write)
- [x] `src/game/systems/__tests__/shop-rotation.test.ts` — covers deterministic shop generation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Economy balance feels right during gameplay | ECON-06 | Tuning values need playtesting | Run 3+ extractions from floors 5-10, verify 1-2 extractions compile one Blueprint |
| Currency pickup visual feedback | ECON-01 | Visual stack increment check | Pick up Scrap, verify stack count increments in inventory + message log appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green
