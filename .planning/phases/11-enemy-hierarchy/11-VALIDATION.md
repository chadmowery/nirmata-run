---
phase: 11
slug: enemy-hierarchy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | ENEMY-03 | unit | `npm test src/game/systems/__tests__/ai-null-pointer.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | ENEMY-04 | unit | `npm test src/game/systems/__tests__/pack-coordinator.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | ENEMY-05 | unit | `npm test src/game/systems/__tests__/fragmenter.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | ENEMY-06 | unit | `npm test src/game/systems/__tests__/logic-leaker.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | ENEMY-07 | integration | `npm test src/game/systems/__tests__/system-admin.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | ENEMY-08 | integration | `npm test src/game/systems/__tests__/seed-eater.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 1 | ENEMY-11 | unit | `npm test src/game/entities/__tests__/enemy-templates.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-04-02 | 04 | 1 | ENEMY-01 | integration | `npm test src/rendering/__tests__/glitch-effects.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-04-03 | 04 | 1 | ENEMY-02 | integration | `npm test src/rendering/__tests__/damage-effects.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-04-04 | 04 | 2 | ENEMY-09 | unit | `npm test src/game/generation/__tests__/depth-spawn.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-04-05 | 04 | 2 | ENEMY-10 | integration | `npm test src/rendering/__tests__/death-effects.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/game/systems/__tests__/ai-null-pointer.test.ts` — stubs for ENEMY-03
- [ ] `src/game/systems/__tests__/pack-coordinator.test.ts` — stubs for ENEMY-04
- [ ] `src/game/systems/__tests__/fragmenter.test.ts` — stubs for ENEMY-05
- [ ] `src/game/systems/__tests__/logic-leaker.test.ts` — stubs for ENEMY-06
- [ ] `src/game/systems/__tests__/system-admin.test.ts` — stubs for ENEMY-07
- [ ] `src/game/systems/__tests__/seed-eater.test.ts` — stubs for ENEMY-08
- [ ] `src/game/entities/__tests__/enemy-templates.test.ts` — stubs for ENEMY-11
- [ ] `src/rendering/__tests__/glitch-effects.test.ts` — stubs for ENEMY-01
- [ ] `src/rendering/__tests__/damage-effects.test.ts` — stubs for ENEMY-02
- [ ] `src/game/generation/__tests__/depth-spawn.test.ts` — stubs for ENEMY-09
- [ ] `src/rendering/__tests__/death-effects.test.ts` — stubs for ENEMY-10

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glitch visual fidelity | ENEMY-01 | Subjective visual quality | Load each enemy type, verify neon bleed/silhouette renders correctly |
| Death effect aesthetics | ENEMY-10 | Subjective visual quality | Kill each enemy type, verify unique death animation plays |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
