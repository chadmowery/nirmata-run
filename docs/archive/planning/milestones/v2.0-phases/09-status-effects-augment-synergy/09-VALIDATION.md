---
phase: 9
slug: status-effects-augment-synergy
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | AUG-07, AUG-08 | unit | `npx vitest run src/game/systems/status-effects.test.ts` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | AUG-07 | unit | `npx vitest run src/game/systems/status-effects.test.ts` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 2 | AUG-01, AUG-02, AUG-06 | unit | `npx vitest run src/game/systems/augment.test.ts` | ❌ W1 | ⬜ pending |
| 09-02-02 | 02 | 2 | AUG-01, AUG-02 | unit | `npx vitest run src/game/systems/augment.test.ts` | ❌ W1 | ⬜ pending |
| 09-03-01 | 03 | 3 | AUG-05 | integration | `npx vitest run src/game/systems/augment-integration.test.ts` | ❌ W2 | ⬜ pending |
| 09-04-01 | 04 | 4 | AUG-03 | unit | `npx vitest run src/game/entities/templates/__tests__/augment-templates.test.ts` | ❌ W3 | ⬜ pending |
| 09-04-02 | 04 | 4 | AUG-04 | unit | `npx vitest run src/game/systems/augment.test.ts` | ❌ W1 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:
- `src/game/systems/status-effects.test.ts` — existing test file (will be extended)
- vitest is already installed and configured
- No new framework or fixture setup needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Augment flash renders as geometric shape | AUG-04/VIS-05 | PixiJS rendering requires visual inspection | Start game, equip augment, use Firmware to trigger, verify flash appears |

*Note: Flash rendering integration is stubbed in Phase 9; full visual polish deferred to Phase 16.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
