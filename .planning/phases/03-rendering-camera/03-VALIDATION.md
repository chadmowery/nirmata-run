---
phase: 3
slug: rendering-camera
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` (from Phase 1 scaffolding) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01 | 01 | 1 | RND-01 | manual-only | N/A — requires WebGL context | ❌ Manual | ⬜ pending |
| 03-02 | 01 | 1 | RND-02 | manual-only | N/A — requires WebGL context | ❌ Manual | ⬜ pending |
| 03-03 | 01 | 1 | RND-05 | unit (logic) | `npx vitest run tests/rendering/tilemap-build.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-04 | 01 | 1 | RND-06 | unit (structure) | `npx vitest run tests/rendering/layer-ordering.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-05 | 02 | 1 | RND-07 | unit | `npx vitest run tests/rendering/camera.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-06 | 02 | 1 | RND-08 | unit | `npx vitest run tests/rendering/viewport-culling.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-07 | 02 | 1 | RND-14 | unit | `npx vitest run tests/rendering/camera-lerp.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-08 | 03 | 2 | RND-09 | unit | `npx vitest run tests/rendering/fov-visibility.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-09 | 03 | 2 | RND-10 | unit | `npx vitest run tests/rendering/entity-fov-gating.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-10 | 04 | 2 | RND-03 | unit | `npx vitest run tests/rendering/entity-sprite-map.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-11 | 04 | 2 | RND-04 | unit | `npx vitest run tests/rendering/sprite-cleanup.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-12 | 04 | 2 | RND-11 | unit | `npx vitest run tests/rendering/move-tween.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-13 | 04 | 2 | RND-12 | unit | `npx vitest run tests/rendering/attack-anim.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-14 | 04 | 2 | RND-13 | unit | `npx vitest run tests/rendering/death-anim.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Mock/stub pattern for PixiJS objects (Container, Sprite as plain objects with position/alpha/visible/tint)
- [ ] Test files for rendering logic: camera math, FOV computation, animation interpolation, sprite map tracking
- [ ] `pixi.js`, `@pixi/tilemap`, `rot-js` installed as dependencies

*Vitest config and test infrastructure expected from Phase 1 scaffolding.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PixiJS Application mounts to canvas independently | RND-01 | Requires browser WebGL context | Open browser, verify single canvas visible, no React reconciler |
| CompositeTilemap renders tiles in 1-2 draw calls | RND-02 | Requires GPU draw call inspection | Use PixiJS DevTools or browser profiler to verify draw call count |
| Smooth camera follow feels responsive | RND-14 | Subjective visual quality | Move player multiple tiles, verify camera tracks smoothly without jitter |
| FOV visual states are visually correct | RND-09 | Visual appearance in browser | Explore dungeon, verify visible/explored/hidden brightness levels |
| Movement animation looks smooth | RND-11 | Visual animation timing | Move player, verify ~100ms smooth transition between tiles |
| Attack animation has red tint + lunge | RND-12 | Visual animation feedback | Bump-attack enemy, verify attacker lunges and defender flashes red |
| Death fade animation plays cleanly | RND-13 | Visual animation quality | Kill enemy, verify fade to transparent over ~300ms |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
