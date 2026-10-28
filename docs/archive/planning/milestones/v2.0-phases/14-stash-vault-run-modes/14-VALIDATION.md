---
phase: 14
slug: stash-vault-run-modes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | STASH-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | STASH-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | STASH-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | STASH-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | RUN-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | RUN-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | RUN-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | RUN-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 2 | RUN-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-03-03 | 03 | 2 | RUN-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 2 | RUN-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for Vault persistence (STASH-01 through STASH-04)
- [ ] Test stubs for run mode manager (RUN-01 through RUN-03)
- [ ] Test stubs for seeded runs and leaderboard (RUN-04 through RUN-06)
- [ ] Test stubs for ritual and run launch (RUN-07)
- [ ] Shared fixtures for PlayerProfile with vault data

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pre-run Ritual loadout flow | RUN-07 | Multi-step user interaction | Equip items from Vault, verify Shell state, launch run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
