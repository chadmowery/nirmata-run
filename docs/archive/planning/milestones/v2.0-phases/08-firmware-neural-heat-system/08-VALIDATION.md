---
phase: 8
slug: firmware-neural-heat-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose src/game/systems/heat.test.ts src/game/systems/firmware.test.ts src/game/systems/kernel-panic.test.ts src/game/systems/status-effects.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (relevant test file)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | FIRM-02, FIRM-05 | unit | `npx vitest run src/game/systems/heat.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | FIRM-06 | unit | `npx vitest run src/game/systems/heat.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | FIRM-01 | unit | `npx vitest run src/game/systems/firmware.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | FIRM-07 | unit | `npx vitest run src/game/systems/firmware.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | FIRM-03, FIRM-04 | unit | `npx vitest run src/game/systems/kernel-panic.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | FIRM-04 | unit | `npx vitest run src/game/systems/kernel-panic.test.ts` | ❌ W0 | ⬜ pending |
| 08-04-01 | 04 | 3 | FIRM-07 | unit | `npx vitest run src/game/entities/templates/__tests__/firmware-templates.test.ts` | ❌ W0 | ⬜ pending |
| 08-04-02 | 04 | 3 | FIRM-08, FIRM-09 | unit | `npx vitest run src/game/systems/firmware.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/game/systems/heat.test.ts` — stubs for FIRM-02, FIRM-05, FIRM-06
- [ ] `src/game/systems/firmware.test.ts` — stubs for FIRM-01, FIRM-07, FIRM-08
- [ ] `src/game/systems/kernel-panic.test.ts` — stubs for FIRM-03, FIRM-04
- [ ] `src/game/systems/status-effects.test.ts` — stubs for status effect tick-down

*Existing infrastructure covers framework needs. No new dependencies required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Targeting cursor keyboard+mouse | D-06 | Visual interaction with PixiJS canvas | Press 1/2/3, verify cursor appears, move with arrows/mouse, confirm with Enter/click, cancel with Escape |
| Vent vulnerability visual feedback | D-14 | Visual rendering check | Vent while enemies adjacent, verify armor reduction text in combat log |
| Extended_Sight wall-penetrating vision | FIRM-07 | FOV rendering requires visual check | Toggle Extended_Sight, verify enemies visible through walls on PixiJS canvas |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
