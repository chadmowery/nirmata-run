---
name: adversarial-review
description: >-
  Perform a rigorous, adversarial review of changes on the current branch against a supplied specification, project rules, and architectural guidelines.
  Produces a comprehensive audit report with an actionable remediation plan placed in docs/reports/.
---

# Adversarial Review

This skill guides a deep, critical audit of changes introduced on the current branch against design specifications, system requirements, and engine/architectural guidelines. It produces a detailed findings report and remediation plan in `docs/reports/`.

## Workflow

### 1. Context Gathering & Baseline Analysis
- Identify the current branch and diff against the target base (typically `main` or the parent feature branch):
  - Check `git status`, `git branch --show-current`, and examine recent commits (`git log -n 10 --oneline`).
  - Review the changed files (`git diff --stat <base>...HEAD` or `git diff <base>...HEAD`).
- Carefully read the target specification document provided by the user (or linked in the PR/branch context).
- Re-read core architectural rules and guidelines:
  - Root rules: `AGENTS.md`
  - Layer-specific rules: `src/engine/AGENTS.md`, `src/shared/AGENTS.md`, `src/client/AGENTS.md`, `src/server/AGENTS.md`, `src/rendering/AGENTS.md`
  - Core architecture specs: `docs/architecture/APPLICATION_SEPARATION_SPEC.md`, `docs/architecture/DEATH_PROTOCOL.md`, etc.

### 2. Adversarial Code & Architecture Audit
Critically scrutinize all changes with a strict, skeptical mindset. Focus on identifying flaws, edge cases, regressions, and omissions across the following vectors:

1. **Spec Completeness & Parity**:
   - Are any features, parameters, algorithms, formulas, or states mentioned in the specification missing or partially implemented?
   - Did the implementation make unsupported assumptions or deviate from the spec?
2. **Engine & Architectural Violations**:
   - **ECS Phase Discipline**: Are systems strictly querying and attaching intents/tags without direct RPC calls or event bus triggers between systems?
   - **Death Protocol**: Does any system call `world.destroyEntity()` directly instead of using `GravediggerSystem` and the `Dying` component?
   - **Immutable Updates**: Are component instances mutated in-place rather than updated via `patchComponent` / `addComponent`?
   - **Layer Isolation & Boundaries**: Are server systems accidentally imported into the client, or vice-versa? Are client prediction boundaries respected?
   - **Tooling Mandate**: Ensure no Makefile usage or prohibited dependencies.
3. **Robustness & Edge Cases**:
   - Boundary conditions (empty inputs, zero values, off-by-one errors in grid/turns, out-of-bounds coordinates).
   - Concurrency/turn-order desyncs, stale queries, missing cleanup of transient components.
   - Determinism issues (Math.random vs seeded RNG).
4. **Testing & Validation Quality**:
   - Are there unit and integration tests covering the new functionality?
   - Do tests assert on real behavioral outcomes rather than mocking away core engine logic?
   - Run verification commands (`npm test`, `npm run typecheck`, `npm run lint`).

### 3. Generate the Report
Write a detailed report in `docs/reports/` using the naming format:
`docs/reports/YYYY-MM-DD-adversarial-review-<topic>.md`

The report must include:
- **Executive Summary**: High-level verdict, branch name, reviewed spec, and overall health assessment.
- **Scope & Methodology**: Commits reviewed, files inspected, test/typecheck results.
- **Detailed Findings by Category**:
  - Grouped by severity (**Critical / Blocker**, **High / Architectural Violation**, **Medium / Spec Gap**, **Low / Code Quality & Minor**).
  - Each finding should specify: File and line references, description of the vulnerability/gap, impact/risk, and required fix.
- **Actionable Remediation Plan**: Prioritized checklist of tasks to resolve all identified issues before merging.

### 4. Report Presentation
- Inform the user of the findings summary and provide a clickable file link to the generated report in `docs/reports/`.

