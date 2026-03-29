---
phase: 7
slug: shell-equipment-data-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
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
| 07-01-01 | 01 | 1 | SHELL-01 | unit | `npx vitest run src/shared/components/__tests__/shell.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | SHELL-02 | unit | `npx vitest run src/shared/components/__tests__/port-config.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | SHELL-07 | unit | `npx vitest run src/game/shells/__tests__/shell-registry.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | SHELL-07 | unit | `npx vitest run src/game/shells/__tests__/template-loading.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | SHELL-02 | unit | `npx vitest run src/game/systems/__tests__/equipment.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | SHELL-03 | integration | `npx vitest run src/tests/integration/shell-to-player.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | SHELL-04 | integration | `npx vitest run src/tests/integration/death-equipment-clear.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | SHELL-05 | integration | `npx vitest run src/tests/integration/shell-upgrade.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/components/__tests__/shell.test.ts` — stubs for SHELL-01 component schema
- [ ] `src/shared/components/__tests__/port-config.test.ts` — stubs for SHELL-02 port config schema
- [ ] `src/game/shells/__tests__/shell-registry.test.ts` — stubs for SHELL-07 registry CRUD
- [ ] `src/game/shells/__tests__/template-loading.test.ts` — stubs for SHELL-07 JSON template parsing
- [ ] `src/game/systems/__tests__/equipment.test.ts` — stubs for SHELL-02 slot limit enforcement
- [ ] `src/tests/integration/shell-to-player.test.ts` — stubs for SHELL-03 Shell→player entity stamping
- [ ] `src/tests/integration/death-equipment-clear.test.ts` — stubs for SHELL-04 death clears equip
- [ ] `src/tests/integration/shell-upgrade.test.ts` — stubs for SHELL-05 upgrade transactions

*Existing test infrastructure (vitest + jsdom) covers all needs. No new dependencies required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shell selection UI before Neural Deck exists | SHELL-03 | No UI yet (Phase 15) | Verify via API call or test harness that Shell selection stamps correct player entity |
| Shell rotation availability (weekly) | SHELL-06 | Temporal/config-dependent | Verify `ShellRegistry.getAvailableShells()` respects rotation config |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
