# Shared Layer (`src/shared/`) — Architectural Rules & Guidelines

The Shared layer defines the canonical data models, validation schemas, delta compression algorithms, and wire event contracts shared between client and server.

## 1. Import Boundaries (Strictly Enforced)
- **Allowed Imports**: `@engine/*`, `@shared/*`.
- **FORBIDDEN Imports**: `@client/*`, `@server/*`, `@rendering/*`, `@dev-tool/*`, UI, React, Next.js, or DOM.

## 2. Core Architectural Mandates
1. **Component Registry & Zod Schemas**:
   - Every ECS component used in the game MUST have a Zod schema in `src/shared/components/` and be registered in `COMPONENTS_REGISTRY` (`src/shared/components/registry.ts`).
   - Component names in `COMPONENTS_REGISTRY` match their TypeScript class/type names exactly to ensure deterministic wire serialization.
2. **Anti-Cheat Redaction Invariants**:
   - Any state sent to the client must pass through `redactWorldForClient()` or `redactDeltaForClient()` (`src/shared/serialization.ts`).
   - Redaction must strip:
     - Hidden container contents and unrevealed loot.
     - Unrevealed trap triggers and hidden enemy traits out of FOV.
     - Procedural generation seeds or internal server RNG state.
3. **Reconciliation & Delta Protocol**:
   - State synchronization supports both `FULL` snapshots (`FullSyncPayload`) and `DELTA` component diffs (`createECSWorldDelta`).
   - `applyStateDelta()` (`src/shared/reconciliation.ts`) applies state updates atomically to the client's `World` and `Grid`.
4. **Event Taxonomy (Three-Tier Hierarchy)**:
   - **`EngineEvents`** (`src/engine/events/types.ts`): Pure ECS and turn lifecycle signals (`ENTITY_CREATED`, `ENTITY_DESTROYED`, `TURN_START`, `TURN_END`).
   - **`GameplayEvents`** (`src/shared/events/types.ts`): Authoritative server simulation events synced to client (`DAMAGE_DEALT`, `ENTITY_DIED`, `FLOOR_TRANSITION`, `RUN_ENDED`).
   - **`GameEvents`** (`src/game/events/types.ts`): Client-only presentation and UI signals (`RECENTER_CAMERA`, `STATE_RECONCILED`).

## 3. Related Documentation
- [`SYSTEM_OVERVIEW.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/SYSTEM_OVERVIEW.md) — Architectural overview, ECS layout, and network sync models.
