---
phase: 15
slug: neural-deck-hub-ui
status: completed
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` (type safety)
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + visual browser check
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | HUB-01 | integration | `npx tsc --noEmit` | ✅ | ✅ green |
| 15-01-02 | 01 | 1 | HUB-08 | visual | Browser check | N/A | ✅ green |
| 15-02-01 | 02 | 2 | HUB-02 | integration | `npx tsc --noEmit` | ✅ | ✅ green |
| 15-02-02 | 02 | 2 | HUB-03 | manual | Drag-and-drop browser test | N/A | ✅ green |
| 15-03-01 | 03 | 2 | HUB-04 | integration | `npx tsc --noEmit` | ✅ | ✅ green |
| 15-03-02 | 03 | 2 | HUB-05 | integration | `npx tsc --noEmit` | ✅ | ✅ green |
| 15-04-01 | 04 | 3 | HUB-06 | manual | Launch flow browser test | N/A | ✅ green |
| 15-04-02 | 04 | 3 | HUB-07 | grep | `grep -r "Craft\|Shop" src/components/ui/hub/` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] TypeScript compilation passes with all new files — `npx tsc --noEmit`
- [x] `GameState.Hub` enum value recognized by state machine
- [x] Hub CSS tokens render correctly in `:root`

*Existing vitest infrastructure covers automated requirements. Phase 15 is predominantly UI — verification is mostly visual/browser-based.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shell carousel navigation | HUB-02 | Visual interaction (click arrows, see crossfade) | Open Hub → SHELL tab → Click ◄ ► arrows, verify Shell card changes with crossfade animation |
| Drag-and-drop equip/unequip | HUB-03 | Pointer event interaction (drag items between panels) | Open Hub → LOADOUT tab → Drag item from Stash to compatible Shell slot (cyan glow), verify equip. Drag to incompatible slot (pink shake), verify rejection |
| Blueprint compilation animation | HUB-04 | Visual animation (slide from left to right column) | Open Hub → WORKSHOP tab → Click COMPILE on Blueprint, verify slide animation and item appears in COMPILED_LIBRARY |
| Vault grid context menu | HUB-05 | Right-click interaction | Open Hub → VAULT tab → Right-click item in grid, verify sell/discard context menu |
| Ritual launch ceremony | HUB-06 | Multi-step overlay with animation | Select mode → Click INITIALIZE → Verify Ritual overlay (loadout review + risk assessment) → CONFIRM → Verify boot sequence text animation → Game starts |
| Vibrant Decay aesthetic | HUB-08 | Visual audit (color palette, typography, spacing) | Visual inspection of all 5 tabs for black background, cyan/pink accents, condensed typography, underscored all-caps labels |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** completed
