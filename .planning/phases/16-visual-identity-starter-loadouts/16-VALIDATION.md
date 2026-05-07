---
phase: 16
slug: visual-identity-starter-loadouts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | VIS-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | VIS-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | VIS-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | VIS-04 | visual | manual | N/A | ⬜ pending |
| 16-03-01 | 03 | 2 | VIS-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-03-02 | 03 | 2 | VIS-06 | visual | manual | N/A | ⬜ pending |
| 16-03-03 | 03 | 2 | VIS-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-03-04 | 03 | 2 | VIS-08 | visual | manual | N/A | ⬜ pending |
| 16-04-01 | 04 | 3 | LOAD-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-04-02 | 04 | 3 | LOAD-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 16-04-03 | 04 | 3 | LOAD-03 | e2e | manual | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for VIS-01 through VIS-08 CSS/filter validation
- [ ] Test stubs for LOAD-01 through LOAD-03 loadout configuration
- [ ] Shared test fixtures for PixiJS filter mocking and CSS token assertions

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Heat tier visual progression | VIS-04 | GPU-dependent filter rendering | Trigger each heat tier in-game, verify visual effect matches spec |
| Enemy glitch silhouette rendering | VIS-06 | Visual appearance judgment | Spawn each enemy type, verify silhouette + neon bleed renders |
| Death BSOD screen appearance | VIS-08 | Visual layout + styling | Die in-game, verify Safety Orange BSOD with failure reason |
| End-to-end run playability | LOAD-03 | Full gameplay flow | Select each loadout → enter dungeon → fight → extract → return to Hub |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
