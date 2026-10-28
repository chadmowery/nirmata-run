# Architecture

**Analysis Date:** 2024-10-18

## Pattern Overview

**Overall:** Client-Server Authoritative ECS Roguelike

**Key Characteristics:**
- Pure Entity-Component-System (ECS) shared between Client and Server.
- Turn-based state machine synced via json-diff-ts deltas.
- Local prediction with server reconciliation for input.
- Decoupled Rendering (PixiJS) from core Game Logic.

## Layers

**Engine Layer:**
- Purpose: Core ECS, Grid, and Turn Management primitives. Unaware of specific game rules.
- Location: `src/engine/`
- Contains: `World`, `EventBus`, `Grid`, `TurnManager`.
- Depends on: None.
- Used by: Game Logic, Server API, Rendering.

**Game Logic Layer:**
- Purpose: Specific gameplay rules, components, systems, and entity factories.
- Location: `src/game/`
- Contains: Combat, Movement, AI, Item Pickup systems, input handling.
- Depends on: Engine Layer, Shared Layer.
- Used by: Client App, Server API.

**Shared/Network Layer:**
- Purpose: State serialization, delta generation, and reconciliation logic.
- Location: `src/shared/`
- Contains: `pipeline.ts`, `reconciliation.ts`, `serialization.ts`.
- Depends on: Engine Layer.
- Used by: Game Logic, Server API, Client App.

**Rendering Layer:**
- Purpose: Visual representation of the game state using PixiJS.
- Location: `src/rendering/`
- Contains: `render-system.ts`, `camera.ts`, `tilemap.ts`.
- Depends on: Engine Layer, Game Logic.
- Used by: Client App.

## Data Flow

**Player Action Flow:**

1. Input received via `src/game/input/input-manager.ts`.
2. Local prediction: action applied to local `TurnManager` (`src/game/setup.ts`).
3. Intent serialized and sent via POST to `src/app/api/action/route.ts`.
4. Server processes action, calculates state delta using `json-diff-ts`, and returns it.
5. Client receives delta and reconciles state using `applyStateDelta` in `src/shared/reconciliation.ts`.

**State Management:**
- ECS state is housed in `World` (`src/engine/ecs/world.ts`).
- UI state is managed via Zustand store (`src/game/ui/store.ts`).
- Game phase state is managed by `StateMachine` (`src/engine/state-machine/state-machine.ts`).

## Key Abstractions

**World (ECS):**
- Purpose: Container for entities and component data.
- Examples: `src/engine/ecs/world.ts`
- Pattern: Data-oriented ECS.

**Turn Manager:**
- Purpose: Coordinates actor turns based on energy/speed costs.
- Examples: `src/engine/turn/turn-manager.ts`
- Pattern: Priority queue / Energy system.

**State Delta:**
- Purpose: Minimal representation of world changes for network sync.
- Examples: `src/shared/reconciliation.ts`, `src/shared/serialization.ts`
- Pattern: JSON diffing and patching.

## Entry Points

**Client App:**
- Location: `src/app/page.tsx`
- Triggers: Browser load.
- Responsibilities: Initializes React UI, PixiJS canvas, and bootstraps the `createGame` context.

**Game Setup:**
- Location: `src/game/setup.ts`
- Triggers: Client or Server initialization.
- Responsibilities: Wires engine, systems, and network bridges together.

**Server Action API:**
- Location: `src/app/api/action/route.ts`
- Triggers: POST requests from client.
- Responsibilities: Validates session, processes intent, returns state delta.

## Error Handling

**Strategy:** Fail-safe with server validation.

**Patterns:**
- Invalid intents are dropped or rejected by the server API.
- Reconciliations apply forced server state if prediction diverges wildly.

## Cross-Cutting Concerns

**Logging:** Standard `console.log` and `console.warn` prefixed with domains (e.g., `[CLIENT]`, `[API]`).
**Validation:** Zod schemas (`ActionRequestSchema`) in `src/shared/types.ts`.
**Authentication:** Session-based (via `sessionId` and `sessionManager`).

---

*Architecture analysis: 2024-10-18*
