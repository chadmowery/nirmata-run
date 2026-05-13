---
phase: 12
slug: multi-floor-generation-stability-extraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 12 — Validation Strategy

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
| 12-01-01 | 01 | 1 | FLOOR-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | FLOOR-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | FLOOR-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | FLOOR-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | FLOOR-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-01-06 | 01 | 1 | FLOOR-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-01-07 | 01 | 1 | FLOOR-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | STAB-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | STAB-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 1 | STAB-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-02-04 | 02 | 1 | STAB-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | STAB-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-03-02 | 03 | 2 | STAB-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-03-03 | 03 | 2 | STAB-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-03-04 | 03 | 2 | STAB-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-03-05 | 03 | 2 | STAB-09 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | STAB-05 | manual | N/A | N/A | ⬜ pending |
| 12-04-02 | 04 | 2 | FLOOR-07 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Floor generation test stubs for FLOOR-01 through FLOOR-07
- [ ] Stability system test stubs for STAB-01 through STAB-09
- [ ] Anchor/extraction integration test stubs

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System Handshake UI visual | STAB-05 | Visual overlay rendering | Open anchor, verify desaturation + UI layout |
| Depth-based palette shifts | FLOOR-07 | Visual theming | Descend to floor 6+, verify palette change |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
