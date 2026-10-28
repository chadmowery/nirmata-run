# Testing Patterns

**Analysis Date:** 2024-03-15

## Test Framework

**Runner:**
- Vitest
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest's built-in `expect` API.

**Run Commands:**
```bash
npx vitest              # Run tests in watch mode
npx vitest run          # Run all tests once
```

## Test File Organization

**Location:**
- Tests are both co-located with source files in `src/` (e.g., `src/game/setup.test.ts`) and separated in a dedicated `tests/` directory for integration/layer tests (e.g., `tests/rendering/camera.test.ts`).

**Naming:**
- `*.test.ts` (e.g., `camera-lerp.test.ts`, `entity-sprite-map.test.ts`).

**Structure:**
- Arranged by layer and feature (e.g., `tests/rendering/`, `src/game/`).

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Feature Name', () => {
  let context;

  beforeEach(() => {
    // Setup state before each test
  });

  it('should behave in a specific way', () => {
    // Assertions
  });
});
```

**Patterns:**
- **Setup:** Heavy use of `beforeEach` to initialize clean contexts (e.g., `createGame({ ... })`).
- **Teardown:** Generally handled by garbage collection of the isolated context created in `beforeEach`.
- **Assertion:** Standard `expect(value).toBe(expected)` or `expect(value).toBeDefined()`.

## Mocking

**Framework:** Vitest (`vi`)

**Patterns:**
```typescript
import { vi } from 'vitest';

// Typical mocking pattern for functions or modules if needed
const mockFn = vi.fn();
```

**What to Mock:**
- External side effects, complex rendering contexts (PixiJS), or time/animations.

**What NOT to Mock:**
- Core ECS logic, grid math, or state machine transitions. These are tested with real instances (e.g., `createGame` in integration tests).

## Fixtures and Factories

**Test Data:**
```typescript
context = createGame({ gridWidth: 10, gridHeight: 10 });
```

**Location:**
- Usually inline within the test file or utilizing the standard `setup.ts` factory functions from the implementation.

## Coverage

**Requirements:** None explicitly enforced in the base `vitest.config.ts`.

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Pure math/logic functions (e.g., `computeCameraTarget` in `tests/rendering/camera.test.ts`).
- ECS core functionality.

**Integration Tests:**
- System interactions (e.g., `Game Setup Integration` in `src/game/setup.test.ts` checking FSM transitions and input manager state).
- Render pipeline interactions (e.g., `tests/rendering/fov-visibility.test.ts`).

## Common Patterns

**Environment Pragma:**
```typescript
// @vitest-environment jsdom
```
Used at the top of test files that require DOM APIs (like canvas for PixiJS or event listeners).