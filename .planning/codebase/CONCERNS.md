# Codebase Concerns

**Analysis Date:** 2024-05-28

## Tech Debt

**Event Payload Typing:**
- Issue: Heavy reliance on `any` for event payloads and state shapes rather than strongly typed interfaces.
- Files: `src/shared/pipeline.ts`, `src/shared/reconciliation.ts`, `src/engine/events/event-bus.ts`, `src/app/api/action/route.ts`
- Impact: Decreases type safety during event emission and handling, making it easy to introduce runtime bugs with incorrect event payloads.
- Fix approach: Define strict interfaces for all event payloads and replace `any` in `EventBus` with generics constrained to those interfaces.

**Entity Factory in Pure Pipeline:**
- Issue: Pure pipeline currently skips loot generation because `EntityFactory` might have browser/asset dependencies.
- Files: `src/shared/pipeline.ts`
- Impact: Loot drops will not be correctly predicted or reconciled during server-client state synchronization.
- Fix approach: Refactor `EntityFactory` to be pure, separating browser/asset dependencies into a separate view layer.

## Known Bugs

**Silent State Failures (Empty Returns):**
- Symptoms: Several critical systems silently return `null` or `[]` when conditions aren't met instead of throwing errors or returning explicit failure states.
- Files: `src/engine/generation/bsp.ts`, `src/game/systems/ai.ts`, `src/engine/turn/turn-manager.ts`
- Trigger: Invalid parameters or edge cases (e.g., empty room arrays during BSP generation).
- Workaround: None currently. Operations simply abort without logging.

## Security Considerations

**API Route Input Validation:**
- Risk: Using `any` in error catching and request parsing without explicit validation schemas.
- Files: `src/app/api/action/route.ts`, `src/app/api/session/route.ts`
- Current mitigation: Basic try-catch blocks.
- Recommendations: Implement a validation library (like Zod) to strictly validate incoming action payloads and session creation requests.

## Performance Bottlenecks

**Turn Manager Sub-ticks:**
- Problem: Turn management can hit a max sub-tick limit and throw errors.
- Files: `src/engine/turn/turn-manager.ts`
- Cause: Degenerate speed values (e.g., extremely low speed) can cause infinite or near-infinite loops while accumulating energy.
- Improvement path: Enforce minimum bounds on entity speed/energy and optimize the turn processing loop.

## Fragile Areas

**Event Bus Circular Chains:**
- Files: `src/engine/events/event-bus.ts`
- Why fragile: Event flushes can cause nested event emissions. It has a hard-coded `MAX_FLUSH_DEPTH` to prevent infinite loops, indicating risk of circular event chains.
- Safe modification: Audit event emissions to ensure directional flow (e.g., Action -> State -> View) and avoid events that trigger themselves.
- Test coverage: Ensure test coverage covers max flush depth scenarios.

## Scaling Limits

**File Complexity:**
- Current capacity: Several files are approaching or exceeding 200 lines, blending logic.
- Limit: Becomes harder to read and maintain.
- Scaling path: Break down large files:
  - `src/engine/generation/bsp.ts` (376 lines)
  - `src/engine/turn/turn-manager.ts` (209 lines)

## Dependencies at Risk

**Testing Framework Integration:**
- Risk: Some test files use `any` heavily to mock dependencies, bypassing TypeScript's safety net.
- Impact: Tests might pass even if the underlying interfaces change, leading to false confidence.
- Migration plan: Create proper mock factories using `Partial<T>` or specific mock interfaces instead of `any`.

## Missing Critical Features

**None explicitly detected beyond loot prediction.**

## Test Coverage Gaps

**Event Bus Edge Cases:**
- What's not tested: Complex cascading events and the `MAX_FLUSH_DEPTH` error handling.
- Files: `src/engine/events/event-bus.ts`
- Risk: Infinite loops might cause UI freezes in production if not handled properly.
- Priority: Medium
