---
name: fix-issues
description: >-
  Use this skill when tasked with reviewing an adversarial review doc or issue report and resolving all identified issues.
  Guides the agent to review issues systematically, adhere to project guidelines, commit per issue fixed, update docs, and manage git branching.
---

# Fix Issues

This skill guides the workflow for reviewing an adversarial review document (or issue report) and systematically resolving all issues identified within it in accordance with project guidelines and requirements.

## Workflow

### 1. Document Review & Triage
- Deeply inspect the supplied adversarial review document (e.g., in `docs/reports/`).
- Enumerate and catalog each issue, gap, violation, or recommendation found.
- Verify understanding against relevant design specifications, architectural documents, and project rules (`AGENTS.md`, layer rulebooks).
- If any issue requirement is ambiguous or conflicts with existing specifications, ask for clarification before proceeding.

### 2. Branch Setup
- If a target branch is supplied:
  - Check out the specified branch (`git checkout <supplied-branch>`).
- If no branch is supplied:
  - Create and switch to a new dedicated branch for the fixes (e.g., `git checkout -b fix/<topic>-issues`).

### 3. Iterative Resolution & Commit per Issue
- Address issues one by one in priority or dependency order:
  1. **Implement Fix**: Apply code changes adhering strictly to project guidelines (ECS phase intents, Death Protocol, immutable component updates, client vs. server authority boundaries, no Makefile).
  2. **Verify**: Run tests and type checks (`npm test`, `npm run typecheck`, `npm run lint`).
  3. **Update Documentation**: Mark the issue as resolved in the review document and update relevant specs, schemas, or `docs/TRACKING.md` as needed.
  4. **Commit**: Create a separate git commit for the issue with a clear, descriptive message referencing the issue being resolved.

### 4. Final Verification
- Run full test and typecheck suites across the project.
- Ensure the adversarial review document accurately reflects the final status of all resolved issues.

