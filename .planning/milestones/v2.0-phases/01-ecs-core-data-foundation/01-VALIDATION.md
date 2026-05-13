---
phase: 1
slug: ecs-core-data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green + ESLint clean
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | ECS-01 | unit | `npx vitest run src/engine/ecs/world.test.ts -t "entity lifecycle"` | ❌ W0 | ⬜ pending |
| 01-02 | 01 | 1 | ECS-02 | unit | `npx vitest run src/engine/ecs/world.test.ts -t "component"` | ❌ W0 | ⬜ pending |
| 01-03 | 01 | 1 | ECS-03 | unit | `npx vitest run src/engine/ecs/world.test.ts -t "system"` | ❌ W0 | ⬜ pending |
| 01-04 | 01 | 1 | ECS-04 | unit | `npx vitest run src/engine/ecs/world.test.ts -t "query"` | ❌ W0 | ⬜ pending |
| 01-05 | 01 | 1 | ECS-05 | unit | `npx vitest run src/engine/ecs/world.test.ts -t "event"` | ❌ W0 | ⬜ pending |
| 01-06 | 02 | 2 | ECS-06 | unit | `npx vitest run src/engine/entity/builder.test.ts -t "template"` | ❌ W0 | ⬜ pending |
| 01-07 | 02 | 2 | ECS-07 | unit | `npx vitest run src/engine/entity/builder.test.ts -t "build"` | ❌ W0 | ⬜ pending |
| 01-08 | 02 | 2 | ECS-08 | unit | `npx vitest run src/engine/entity/registry.test.ts` | ❌ W0 | ⬜ pending |
| 01-09 | 02 | 2 | ECS-09 | unit | `npx vitest run src/engine/entity/factory.test.ts` | ❌ W0 | ⬜ pending |
| 01-10 | 02 | 2 | ECS-10 | unit | `npx vitest run src/engine/entity/builder.test.ts -t "validation"` | ❌ W0 | ⬜ pending |
| 01-11 | 03 | 2 | EVT-01 | unit | `npx vitest run src/engine/events/event-bus.test.ts -t "subscribe"` | ❌ W0 | ⬜ pending |
| 01-12 | 03 | 2 | EVT-02 | unit | `npx vitest run src/engine/events/event-bus.test.ts -t "queue"` | ❌ W0 | ⬜ pending |
| 01-13 | 03 | 2 | EVT-03 | integration | `npx vitest run src/game/events/events.test.ts` | ❌ W0 | ⬜ pending |
| 01-14 | 03 | 2 | GRID-01 | unit | `npx vitest run src/engine/grid/grid.test.ts -t "storage"` | ❌ W0 | ⬜ pending |
| 01-15 | 03 | 2 | GRID-02 | unit | `npx vitest run src/engine/grid/grid.test.ts -t "walkable"` | ❌ W0 | ⬜ pending |
| 01-16 | 03 | 2 | GRID-03 | unit | `npx vitest run src/engine/grid/grid.test.ts -t "entity"` | ❌ W0 | ⬜ pending |
| 01-17 | 03 | 2 | GRID-04 | unit | `npx vitest run src/engine/grid/grid.test.ts -t "layer"` | ❌ W0 | ⬜ pending |
| 01-18 | 04 | 1 | ARCH-01 | lint | `npx eslint src/engine/` | ❌ W0 | ⬜ pending |
| 01-19 | 04 | 1 | ARCH-02 | lint | `npx eslint src/engine/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — Project initialization with all Phase 1 dependencies
- [ ] `tsconfig.json` — TypeScript configuration (strict mode, path aliases)
- [ ] `vitest.config.ts` — Vitest configuration
- [ ] `eslint.config.js` — ESLint flat config with import-x/no-restricted-paths
- [ ] `.prettierrc` — Prettier configuration
- [ ] All test files listed above — none exist yet (greenfield)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ESLint boundary enforcement works in IDE | ARCH-02 | IDE integration not testable in CI | Open engine file, attempt importing from game/, verify squiggly lines appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
