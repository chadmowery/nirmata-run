# Client Layer (`src/client/`) — Architectural Rules & Guidelines

The Client layer governs player-facing browser execution, client-side optimistic prediction, input buffering, and React 19 UI presentation.

## 1. Import Boundaries (Strictly Enforced)
- **Allowed Imports**: `@engine/*`, `@shared/*`, `@rendering/*`, `@client/*`, and prediction-safe game modules.
  - **Telemetry Exception**: `src/client/reports/collectors.ts` may read non-authoritative run state (status, mode, floor, turn, shellId, log messages) from `@/game/ui/store` for client diagnostic capture; it must remain strictly read-only.
- **FORBIDDEN Imports**:
  - `@server/*`: Client never imports authoritative server simulation, session management, or database repos.
  - `@dev-tool/*`: Production client code must never bundle developer diagnostics or Gamedata Studio.
  - Procedural generation: **Never** import `dungeon-generator.ts` or `entity-placement.ts`.
  - Entity JSON templates: Client receives entity state only via wire snapshots.

## 2. Core Architectural Mandates
1. **Prediction-Safe Engine Factory (`createClientEngine`)**:
   - Client instantiates `createClientEngine()` (`src/client/game/client-engine-factory.ts`), registering strictly the 9 prediction-safe systems:
     - `MovementSystem` (`isClient: true`)
     - `TeleportSystem`
     - `EquipmentSystem`
     - `AnchorInteractionSystem`
     - `FirmwareSystem`
     - `AugmentSystem`
     - `SoftwareSystem`
     - `ShellStatsSystem`
     - `TagCleanupSystem`
   - Client **never** runs combat resolution, AI behavior trees, hazard spawning, or persistence systems locally.
2. **Authoritative State Handshake (Zero Client ProcGen)**:
   - Client does not generate maps. On launch, the client requests `/api/run-mode/launch` (or retrieves an active session via `/api/session`) which returns an `initialState: FullSyncPayload`.
   - Client initializes the empty engine with `applyStateDelta(world, grid, turnManager, eventBus, initialState)`.
3. **Input Pipeline & Buffering**:
   - `InputManager` captures keyboard/mouse events and queues them in a FIFO buffer (up to 2 actions).
   - Confirmed actions are dispatched optimistically to local prediction systems and asynchronously submitted to `/api/action`.
4. **Zustand UI Synchronization (`sync-bridge.ts`)**:
   - UI components consume reactive state from `gameStore`.
   - `sync-bridge.ts` listens to ECS `EventBus` and updates UI stores (health, heat meters, status effects, inventory slots) without polling.
5. **Production Anti-Cheat & Hardening**:
   - No `window.__DEBUG__` or dev hotkeys registered in production builds.
   - Any debug tooling is dynamically loaded in development mode only (`process.env.NODE_ENV === 'development'`).

## 3. Related Documentation
- [`UI-DESIGN-SYSTEM.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/UI-DESIGN-SYSTEM.md) — Taikoku visual design language, CRT shaders, and HUD layout tokens.
- [`FIRMWARE-AUGMENTS-SYSTEM.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/FIRMWARE-AUGMENTS-SYSTEM.md) — Player abilities, targeting managers, and cooldown mechanics.
