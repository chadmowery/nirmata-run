---
wave: 1
depends_on: []
files_modified:
  - src/shared/components/status-effects.ts
  - src/shared/components/index.ts
  - src/shared/events/types.ts
  - src/game/systems/status-effects.ts
  - src/game/systems/status-effects.test.ts
  - src/game/engine-factory.ts
autonomous: true
requirements: ["AUG-07", "AUG-08"]
---

# Phase 9 - Plan 01: Status Effect System Refactor

<objective>
Upgrade the Phase 8 StatusEffects stub into a full status effect system: add `getMagnitude()` helper returning highest active instance (D-07), refactor tick timing from global `TURN_START` to per-entity turn start (D-03), emit proper `STATUS_EFFECT_APPLIED` and `STATUS_EFFECT_EXPIRED` events, and update all existing tests.
</objective>

<task type="auto">
  <read_first>
    - src/shared/events/types.ts
    - AGENTS.md
  </read_first>
  <action>
    Add new gameplay events to `GameplayEvents` in `src/shared/events/types.ts`:

    ```typescript
    /** Queued when a status effect is applied to an entity. */
    STATUS_EFFECT_APPLIED: {
      entityId: EntityId;
      effectName: string;
      duration: number;
      magnitude: number;
      source: string;
    };

    /** Queued when a status effect expires on an entity. */
    STATUS_EFFECT_EXPIRED: {
      entityId: EntityId;
      effectName: string;
    };

    /** Queued when one or more Augments trigger from an action. */
    AUGMENT_TRIGGERED: {
      entityId: EntityId;
      augments: Array<{ name: string; payloadType: string; magnitude: number }>;
    };
    ```

    These are GameplayEvents (not GameEvents) because the server computes augment/status resolution authoritatively (per AGENTS.md tier rules).
  </action>
  <acceptance_criteria>
    - `grep -q "STATUS_EFFECT_APPLIED" src/shared/events/types.ts` exits 0
    - `grep -q "STATUS_EFFECT_EXPIRED" src/shared/events/types.ts` exits 0
    - `grep -q "AUGMENT_TRIGGERED" src/shared/events/types.ts` exits 0
  </acceptance_criteria>
</task>

<task type="tdd">
  <read_first>
    - src/game/systems/status-effects.ts
    - src/game/systems/status-effects.test.ts
    - src/shared/components/status-effects.ts
  </read_first>
  <action>
    Update `src/game/systems/status-effects.ts` — the `createStatusEffectSystem()` factory function:

    1. **Add `getMagnitude(entityId, effectName): number`** — Filters `StatusEffects.effects` array for entries matching `name`, returns `Math.max(...magnitudes)` or 0 if none found (D-07). This is the canonical way to query the effective strength of an overlapping effect.

    2. **Add `getEffectiveCount(entityId, effectName): number`** — Returns the count of active instances for a given effect name. Useful for UI display of stacking.

    3. **Refactor tick timing (D-03):** Remove the `TURN_START` event subscription from `init()`. The `tickDown(entityId)` method remains unchanged but is now called externally from the TurnManager handlers (engine-factory.ts) at the start of each entity's turn, not globally. This ensures a 1-turn debuff lasts exactly one of the afflicted entity's actions.

    4. **Update `applyEffect()` to emit `STATUS_EFFECT_APPLIED`:**
       ```typescript
       eventBus.emit('STATUS_EFFECT_APPLIED', {
         entityId,
         effectName: effect.name,
         duration: effect.duration,
         magnitude: effect.magnitude ?? 0,
         source: effect.source ?? 'unknown',
       });
       ```

    5. **Update `tickDown()` to emit `STATUS_EFFECT_EXPIRED`** for each effect that reaches duration 0:
       ```typescript
       eventBus.emit('STATUS_EFFECT_EXPIRED', {
         entityId,
         effectName: effect.name,
       });
       ```

    6. **Keep the existing `init()` and `dispose()` methods** but they become no-ops (empty body). Do NOT subscribe to `TURN_START` anymore. The system is now externally driven.

    Update `src/game/systems/status-effects.test.ts`:
    - Test `getMagnitude()` with overlapping instances returns highest
    - Test `getMagnitude()` returns 0 when no effect exists
    - Test `getEffectiveCount()` returns correct count
    - Test that `applyEffect()` emits `STATUS_EFFECT_APPLIED` event
    - Test that `tickDown()` emits `STATUS_EFFECT_EXPIRED` for expired effects
    - Remove/update the `TURN_START` subscription test (it should no longer auto-subscribe)
    - Existing tests for `tickDown`, `applyEffect`, `hasEffect` should still pass
  </action>
  <acceptance_criteria>
    - `grep -q "getMagnitude" src/game/systems/status-effects.ts` exits 0
    - `grep -q "getEffectiveCount" src/game/systems/status-effects.ts` exits 0
    - `grep -q "STATUS_EFFECT_APPLIED" src/game/systems/status-effects.ts` exits 0
    - `grep -q "STATUS_EFFECT_EXPIRED" src/game/systems/status-effects.ts` exits 0
    - `npx vitest run src/game/systems/status-effects.test.ts` exits 0
  </acceptance_criteria>
</task>

<task type="auto">
  <read_first>
    - src/game/engine-factory.ts
    - src/game/systems/status-effects.ts
  </read_first>
  <action>
    Update `src/game/engine-factory.ts` to call `statusEffectSystem.tickDown(entityId)` at the start of each entity's turn instead of relying on the old `TURN_START` subscription:

    1. In the `playerActionHandler` callback (line ~152), add `statusEffectSystem.tickDown(entityId)` as the FIRST line before any action processing.

    2. In the `enemyActionHandler` callback (line ~148), add `statusEffectSystem.tickDown(entityId)` as the FIRST line before `aiSystem.processEnemyTurn(entityId)`.

    This ensures D-03: effects tick down at the start of the afflicted entity's turn, not globally.

    The `statusEffectSystem.init()` call (line ~99) can remain — it's now a no-op since we removed the `TURN_START` subscription.
  </action>
  <acceptance_criteria>
    - `grep -q "statusEffectSystem.tickDown" src/game/engine-factory.ts` exits 0
    - `npx vitest run` exits 0 (no regressions)
  </acceptance_criteria>
</task>

<verification>
After completing all tasks:
1. `npx vitest run src/game/systems/status-effects.test.ts` — all StatusEffect tests pass
2. `npx vitest run` — full suite passes (including Phase 8 Kernel Panic tests that use StatusEffectSystem)
3. `npx tsc --noEmit` — TypeScript compiles clean
</verification>

<must_haves>
- getMagnitude() returns highest single magnitude among overlapping instances (D-07)
- tickDown() is called per-entity (D-03), not globally via TURN_START
- STATUS_EFFECT_APPLIED and STATUS_EFFECT_EXPIRED events emitted for downstream systems
- Existing Phase 8 tests (kernel-panic.test.ts) continue to pass
- Component schema is unchanged (no breaking migration needed per D-01)
</must_haves>
