---
name: build-from-spec
description: >-
  Use this skill when implementing a feature, system, or refactor based on a design specification or document.
  Guides the agent to review specs deeply, clarify ambiguities, follow engine guidelines, create feature branches, commit frequently, and maintain documentation.
---

# Build From Spec

This skill guides the implementation workflow when building out a feature, architecture, or system from a design specification document.

## Workflow

### 1. Deep Spec Review & Clarification
- Carefully read the target specification document and all referenced system/architecture docs.
- **Do not assume anything.** If there are ambiguities, open design questions, missing edge cases, or conflicting requirements, stop and ask the user for clarification before writing code.

### 2. Feature Branch Creation
- Check the current git status and branch.
- Create and switch to a dedicated feature branch for the work (e.g. `feature/<spec-feature-name>`).

### 3. Architecture & Engine Compliance
- Strictly adhere to project architecture and engine guidelines (see `AGENTS.md` and layer rulebooks such as `src/engine/AGENTS.md`):
  - Respect ECS phase ordering and boundaries (Phase-driven intents, no direct RPCs between systems).
  - Comply with the Death Protocol (`GravediggerSystem` and `Dying` component).
  - Maintain immutable component state updates (`world.patchComponent` / `world.addComponent`).
  - Respect client prediction vs. server authority boundaries.
  - Keep data-driven schemas and entities validated.
  - Never use the project `Makefile`. Use standard npm commands (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`).

### 4. Implementation & Frequent Commits
- Implement the specification in clean, modular increments.
- Verify changes continuously with tests and typechecks.
- Commit working milestones often with descriptive commit messages to keep progress easily trackable and reversible.

### 5. Documentation Updates
- Keep documentation up to date as you build:
  - Update `docs/TRACKING.md` status, active sprints, or checklist items.
  - Update or annotate the specification document or architectural docs if implementation details, design decisions, or schema structures evolve.

