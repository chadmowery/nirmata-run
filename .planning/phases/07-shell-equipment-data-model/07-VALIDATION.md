---
phase: 7
slug: shell-equipment-data-model
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
validated: 2026-03-29
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SHELL-01 | unit | `npx vitest run src/shared/components/__tests__/shell.test.ts` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | SHELL-02 | unit | `npx vitest run src/shared/components/__tests__/port-config.test.ts` | ✅ | ✅ green |
| 07-01-03 | 01 | 1 | SHELL-07 | unit | `npx vitest run src/game/shells/__tests__/shell-registry.test.ts` | ✅ | ✅ green |
| 07-01-04 | 01 | 1 | SHELL-07 | unit | `npx vitest run src/game/shells/__tests__/template-loading.test.ts` | ✅ | ✅ green |
| 07-02-01 | 02 | 2 | SHELL-02 | unit | `npx vitest run src/game/systems/__tests__/equipment.test.ts` | ✅ | ✅ green |
| 07-02-02 | 02 | 2 | SHELL-03 | integration | `npx vitest run src/tests/integration/shell-to-player.test.ts` | ✅ | ✅ green |
| 07-03-01 | 03 | 2 | SHELL-04 | integration | `npx vitest run src/tests/integration/death-equipment-clear.test.ts` | ✅ | ✅ green |
| 07-03-02 | 03 | 2 | SHELL-05 | integration | `npx vitest run src/tests/integration/shell-upgrade.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/shared/components/__tests__/shell.test.ts` — verified SHELL-01 component schema
- [x] `src/shared/components/__tests__/port-config.test.ts` — verified SHELL-02 port config schema
- [x] `src/game/shells/__tests__/shell-registry.test.ts` — verified SHELL-07 registry CRUD
- [x] `src/game/shells/__tests__/template-loading.test.ts` — verified SHELL-07 JSON template parsing
- [x] `src/game/systems/__tests__/equipment.test.ts` — verified SHELL-02 slot limit enforcement
- [x] `src/tests/integration/shell-to-player.test.ts` — verified SHELL-03 Shell→player entity stamping
- [x] `src/tests/integration/death-equipment-clear.test.ts` — verified SHELL-04 death clears equip
- [x] `src/tests/integration/shell-upgrade.test.ts` — verified SHELL-05 upgrade transactions

*Existing test infrastructure (vitest + jsdom) covers all needs. No new dependencies required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shell selection UI before Neural Deck exists | SHELL-03 | No UI yet (Phase 15) | Verify via API call or test harness that Shell selection stamps correct player entity |
| Shell rotation availability (weekly) | SHELL-06 | Temporal/config-dependent | Verify `ShellRegistry.getAvailableShells()` respects rotation config |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified
