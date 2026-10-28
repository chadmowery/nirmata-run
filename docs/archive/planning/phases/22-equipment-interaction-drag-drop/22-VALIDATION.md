---
phase: 22
slug: equipment-interaction-drag-drop
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-17
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` (or `npx vitest run --passWithNoTests`) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run type checking `npx tsc --noEmit` and relevant component tests.
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | UI-02, EQP-01 | unit | `npx vitest run --testNamePattern="drag-and-drop"` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | SW-01, SW-02 | unit | `npx vitest run --testNamePattern="software-install"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/ui/inventory/__tests__/drag-drop.test.tsx` — stubs for drag-and-drop interactions testing UI-02.
- [ ] `src/game/ui/__tests__/store.drag.test.ts` — stubs for optimistic state updates for SW-01, SW-02.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag Ghost Image | UI-02 | Visual API | Drag an item from the backpack and ensure the browser renders a translucent copy attached to the cursor. |
| Double-click Fallback | UI-02 | Interaction Edge Case | Double-click an item in the backpack; ensure it equips if exactly one slot matches, and does nothing otherwise. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
