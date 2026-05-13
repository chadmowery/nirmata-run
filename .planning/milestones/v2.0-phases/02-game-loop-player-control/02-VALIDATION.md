---
phase: 2
slug: game-loop-player-control
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` (created in Phase 1 Plan 01-01) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | FSM-01 | unit | `npx vitest run src/engine/state-machine/state-machine.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | FSM-04 | unit | `npx vitest run src/engine/state-machine/state-machine.test.ts -t "invalid"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | FSM-02 | unit | `npx vitest run src/game/states/game-states.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | FSM-03 | integration | `npx vitest run src/game/states/game-states.test.ts -t "system activation"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | TURN-01 | integration | `npx vitest run src/engine/turn/turn-manager.test.ts -t "turn cycle"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | TURN-02 | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "frozen"` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | TURN-03 | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "deterministic"` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 1 | TURN-04 | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "dead"` | ❌ W0 | ⬜ pending |
| 02-02-05 | 02 | 1 | TURN-05 | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "energy"` | ❌ W0 | ⬜ pending |
| 02-02-06 | 02 | 1 | TURN-06 | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "input gat"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | INP-01 | unit | `npx vitest run src/game/input/input-manager.test.ts -t "map"` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | INP-02 | unit | `npx vitest run src/game/input/input-manager.test.ts -t "rebind"` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | INP-03 | unit | `npx vitest run src/game/input/input-manager.test.ts -t "prevent"` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | MOV-01 | unit | `npx vitest run src/game/systems/movement.test.ts -t "cardinal"` | ❌ W0 | ⬜ pending |
| 02-03-05 | 03 | 2 | MOV-02 | unit | `npx vitest run src/game/systems/movement.test.ts -t "collision"` | ❌ W0 | ⬜ pending |
| 02-03-06 | 03 | 2 | MOV-03 | unit | `npx vitest run src/game/systems/movement.test.ts -t "bump"` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | ARCH-03 | integration | `npx vitest run src/game/setup.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/engine/state-machine/state-machine.test.ts` — stubs for FSM-01, FSM-04
- [ ] `src/game/states/game-states.test.ts` — stubs for FSM-02, FSM-03
- [ ] `src/engine/turn/turn-manager.test.ts` — stubs for TURN-01 through TURN-06
- [ ] `src/game/systems/movement.test.ts` — stubs for MOV-01, MOV-02, MOV-03
- [ ] `src/game/input/input-manager.test.ts` — stubs for INP-01, INP-02, INP-03 (needs `// @vitest-environment jsdom`)
- [ ] `src/game/setup.test.ts` — stubs for ARCH-03

*All test files are new — greenfield Phase 2 code.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser default scrolling suppressed | INP-03 | Full browser context needed for scroll behavior | Open dev build, press arrow keys, verify no page scroll |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
