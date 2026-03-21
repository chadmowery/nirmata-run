# Codebase Structure

**Analysis Date:** 2024-10-18

## Directory Layout

```
nimrata-run/
├── src/app/          # Next.js App Router (UI & API)
├── src/components/   # React UI Components
├── src/engine/       # Core ECS and abstract game loop
├── src/game/         # Specific game rules, systems, and setup
├── src/rendering/    # PixiJS integration and visual systems
└── src/shared/       # Code shared between client and server (networking)
```

## Directory Purposes

**`src/app/`:**
- Purpose: Application entry points and server routes.
- Contains: Next.js pages, layouts, API endpoints (`api/action`, `api/session`).
- Key files: `src/app/page.tsx`, `src/app/api/action/route.ts`

**`src/engine/`:**
- Purpose: Pure, game-agnostic engine primitives.
- Contains: ECS (`world.ts`), Grid, Events, Turn Management, State Machine.
- Key files: `src/engine/index.ts`, `src/engine/ecs/world.ts`

**`src/game/`:**
- Purpose: The actual roguelike implementation.
- Contains: Systems (combat, movement), Entities (factories, components), Input bindings, UI state sync.
- Key files: `src/game/setup.ts`, `src/game/engine-factory.ts`

**`src/rendering/`:**
- Purpose: Visual presentation layer.
- Contains: Sprites, Tilemap building, Camera logic, FOV visibility, Render systems.
- Key files: `src/rendering/render-system.ts`, `src/rendering/renderer.ts`

**`src/shared/`:**
- Purpose: Boundaries and synchronization.
- Contains: Serialization, reconciliation, and shared types.
- Key files: `src/shared/reconciliation.ts`, `src/shared/pipeline.ts`

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Client game loop and UI bootstrap.
- `src/app/api/action/route.ts`: Server authoritative action processing.
- `src/game/setup.ts`: Game context factory linking engine to network.

**Configuration:**
- `tsconfig.json`: TypeScript configuration.
- `vitest.config.ts`: Test runner configuration.

**Core Logic:**
- `src/game/engine-factory.ts`: Instantiates the pure game systems and world generation.
- `src/engine/ecs/world.ts`: Core component storage and entity management.

**Testing:**
- `src/tests/` and `src/engine/__tests__/`: Integration and unit tests.

## Naming Conventions

**Files:**
- kebab-case: `render-system.ts`, `engine-factory.ts`

**Directories:**
- kebab-case: `state-machine`, `engine`

## Where to Add New Code

**New Feature:**
- Primary code: `src/game/systems/[feature-name].ts` (System) and `src/game/components.ts` (Data).
- Tests: `src/game/[feature].test.ts` or `src/tests/integration/`

**New Component/Module:**
- Implementation: Add to `src/game/components/` (if splitting) or `src/game/components.ts`.

**Utilities:**
- Shared helpers: `src/shared/` for network/sync, `src/engine/` for pure logic abstractions.

## Special Directories

**`.planning/`:**
- Purpose: Contains GSD AI agent plans, phases, and knowledge base.
- Generated: Partially by agents.
- Committed: Yes.

**`.gemini/`:**
- Purpose: GSD agent definitions, skills, hooks, and templates.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2024-10-18*
