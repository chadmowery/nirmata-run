---
phase: 17
slug: add-design-tool-for-authoring-and-viewing-entities-component-templates-and-gamedata
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-07
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | Shell migration + schemas + ECS rules | unit/TDD | `npx vitest run src/game/shells/__tests__/dynamic-load.test.ts src/app/api/dev/gamedata/__tests__` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 1 | API routes | integration | `npx vitest run src/app/api/dev` | ✅ | ⬜ pending |
| 17-03-01 | 03 | 2 | Page shell + store + sidebar | typecheck | `npx tsc --noEmit` | n/a | ⬜ pending |
| 17-04-01 | 04 | 2 | Editor components | typecheck | `npx tsc --noEmit` | n/a | ⬜ pending |
| 17-05-01 | 05 | 3 | Full page render + wiring | manual | n/a — browser check | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/game/shells/__tests__/dynamic-load.test.ts` — Shell JSON loading tests (created inline by Plan 01 TDD)
- [x] `src/app/api/dev/gamedata/__tests__/ecs-rules.test.ts` — ECS consistency rule tests (created inline by Plan 01 TDD)
- [x] `src/app/api/dev/gamedata/__tests__/schemas.test.ts` — Schema validation tests (created inline by Plan 01 TDD)
- [x] `src/app/api/dev/gamedata/__tests__/schema-introspect.test.ts` — Schema introspection tests (created inline by Plan 01 TDD)

*All Wave 0 test files are created inline during Plan 01 TDD execution. No separate scaffolding step needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Save validation shows inline errors | D-07 | Requires browser interaction | Open /dev/gamedata, create entity with missing required fields, click Save, verify error messages appear inline |
| Delete confirmation dialog | D-08 | Requires browser interaction | Select an entity, click Delete, verify dialog appears, confirm deletion removes it from list |
| VS Code-style sidebar expand/collapse | D-09 | Visual/interactive | Open tool, verify sidebar has 5 sections, click arrows to expand/collapse each section |
| Vibrant Decay aesthetic | D-10 | Visual judgment | Open /dev/gamedata, verify neon cyan/pink palette, monospace fonts match Phase 16 style |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
