---
phase: 19
slug: combat-stat-pipeline-turn-costs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/game/systems/combat.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/game/systems/combat.test.ts src/game/systems/software.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|-------------|-----------|-------------------|-------------|--------|
| collectDamageModifiers EquipmentSlots path | LMC-02 | unit | `npx vitest run src/game/systems/combat.test.ts` | ❌ W0 | ⬜ pending |
| null weapon slot returns zero modifiers | LMC-02 | unit | `npx vitest run src/game/systems/combat.test.ts` | ❌ W0 | ⬜ pending |
| armor traversal returns defender Defense | LMC-02 | unit | `npx vitest run src/game/systems/combat.test.ts` | ❌ W0 | ⬜ pending |
| base Attack/Defense not mutated after equip | LMC-02 | unit | `npx vitest run src/game/systems/combat.test.ts` | ❌ W0 | ⬜ pending |
| EQUIP_WEAPON pipeline deducts full turn | EQP-03 | integration | `npx vitest run src/shared/__tests__/pipeline.test.ts` | ❌ W0 | ⬜ pending |
| UNINSTALL_WEAPON pipeline deducts full turn | EQP-03 | integration | `npx vitest run src/shared/__tests__/pipeline.test.ts` | ❌ W0 | ⬜ pending |
| BurnedSoftware removed, TS compiles | D-06 | build | `npx tsc --noEmit` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/game/systems/combat.test.ts` — add tests for new `EquipmentSlots`-based `collectDamageModifiers` path
- [ ] `src/game/systems/combat.test.ts` — add test for armor traversal helper (defender effective armor)
- [ ] `src/game/systems/combat.test.ts` — add no-mutation test (base Attack/Defense unchanged after equip)
- [ ] `src/shared/__tests__/pipeline.test.ts` — add `EQUIP_WEAPON` / `UNINSTALL_WEAPON` action round-trip tests
- [ ] `src/game/systems/software.test.ts` — migrate existing `BurnedSoftware` setup tests to `EquipmentSlots` + `Children`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Enemies actually take turns after player equips gear in gameplay | EQP-03 | Requires running game loop with visual/log output | Start a run, equip weapon, observe enemy movement in log |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
