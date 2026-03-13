# Stack Research

**Domain:** Web-based 2D Roguelike Dungeon Crawler Engine
**Researched:** 2026-03-13
**Overall Confidence:** HIGH

## Recommended Stack

### Core Technologies (Pre-decided, Non-negotiable)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PixiJS | ^8.17.0 | 2D rendering (tiles, particles, sprites) | Latest stable. v8 has WebGL2/WebGPU dual renderer, ParticleContainer perf overhaul, unified GC system, asset loading strategies. Actively maintained (monthly releases). | HIGH |
| React | ^19.2.4 | UI layer (HUD, menus, inventory) | Latest stable. React 19 required by @pixi/react v8. | HIGH |
| TypeScript | ^5.9.3 | Type safety across engine + game + UI | Latest stable. Satisfies decorators, const type params, and improved inference needed for ECS typing. | HIGH |
| Next.js | ^16.1.6 | Backend validation via API routes, hosting | Latest stable. App Router for API routes handling server-authoritative validation. Turbopack is default bundler. | HIGH |

### PixiJS Ecosystem Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| @pixi/tilemap | ^5.0.2 | Optimized rectangular tilemap rendering | Purpose-built for tile-based games. v5.x is the PixiJS v8 compatible line. Uses batched GPU rendering — far more performant than individual Sprite-per-tile. `CompositeTilemap` abstracts tileset layering. Maintained under pixijs-userland. | HIGH |
| @pixi/particle-emitter | ^5.0.10 | Configurable particle effects (combat, environment) | Behavior-based particle system with JSON configs. v5 supports PixiJS v8. Use for hit effects, spell particles, ambient dungeon effects. When raw throughput matters more than configurability, use PixiJS's built-in `ParticleContainer` directly. | MEDIUM |
| @assetpack/core | ^1.7.0 | Asset pipeline — spritesheet packing, texture compression, optimization | Official PixiJS asset tooling. Automates spritesheet generation, image compression, format conversion. Plugin-based architecture. Integrates directly with PixiJS Assets loader manifest format. | MEDIUM |

### State Management

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| zustand | ^5.0.11 | UI state — HUD, menus, inventory panels, settings | **Best fit for this architecture.** Vanilla store API (`createStore`) works outside React — critical for bridging game engine state to UI without coupling engine code to React. `subscribeWithSelector` middleware enables efficient granular subscriptions from the game loop to UI. No context providers needed. 21M weekly downloads, battle-tested. DevTools middleware for debugging. Immer middleware available for nested state updates. | HIGH |

**Why Zustand over Jotai:** Zustand's store-based model maps naturally to game state domains (playerStore, inventoryStore, dungeonUIStore). Jotai's atomic model is better for fine-grained derived state in complex forms/dashboards, not game state that changes in discrete turn-based batches. Zustand's `getState()`/`setState()` vanilla API is essential — the engine must read/write UI state without React hooks.

**Why NOT Redux:** Excessive boilerplate for what is ultimately a thin UI reflection layer over game state. The real game state lives in the ECS, not in the UI store.

### Roguelike Domain Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| rot-js | ^2.2.1 | FOV/LOS algorithms, seeded RNG, A* pathfinding | The standard roguelike toolkit for JS. TypeScript-native. Cherry-pick the algorithms you need — **use its FOV (recursive shadowcasting), RNG (Alea PRNG, seedable), and pathfinding (A*, Dijkstra)**. Do NOT use its display system (you have PixiJS) or map generators (you're building custom BSP). Written as ES modules, tree-shakeable. "Feature-complete" per maintainer — stable, not abandoned. | HIGH |

**Usage pattern:** Import specific modules only:
```typescript
import { FOV } from 'rot-js/lib/fov';
import { RNG } from 'rot-js/lib/rng';
import { Path } from 'rot-js/lib/path';
```

### Testing

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| vitest | ^4.1.0 | Unit/integration testing for engine systems, ECS, generation | The standard for modern TS projects. Native ESM, TypeScript out of the box, Jest-compatible API. Fastest test runner in the ecosystem. 34M weekly downloads. Works with Next.js via `@vitejs/plugin-react`. | HIGH |
| @testing-library/react | latest | React component testing (UI layer) | Standard for testing React UI. Test inventory panels, HUD elements, menu interactions. | HIGH |
| happy-dom | latest | Lightweight DOM implementation for Vitest | Faster than jsdom for headless testing. Sufficient for UI component tests — no canvas rendering needed in unit tests. | MEDIUM |

**Testing strategy for tile rendering / PixiJS:** Don't unit-test PixiJS rendering — it requires WebGL context. Test the engine layer (ECS queries, dungeon generation, turn logic, pathfinding, state machines) with Vitest. Use snapshot/visual regression tests for rendering only if needed later.

### Development Tools

| Tool | Version | Purpose | Why | Confidence |
|------|---------|---------|-----|------------|
| eslint | ^9.x | Linting | Next.js ships with `eslint-config-next`. Use flat config format (ESLint 9 standard). Add `@typescript-eslint/eslint-plugin` for TS rules. | HIGH |
| prettier | ^3.x | Code formatting | De facto standard. Separate concerns: ESLint for logic errors, Prettier for style. | HIGH |
| turbopack | (bundled with Next.js 16) | Dev server bundling | Default in Next.js 16. No separate install needed. Replaces webpack for dev. | HIGH |

### Utility Libraries (Install As Needed)

| Library | Version | Purpose | When to Install |
|---------|---------|---------|-----------------|
| immer | ^10.x | Immutable state updates | If zustand store updates get deeply nested. Zustand has built-in immer middleware. |
| zod | ^3.x | Runtime schema validation | For validating JSON entity definitions, server-side action payloads. Lightweight, TypeScript-first. |
| nanoid | ^5.x | ID generation | If ECS entity IDs need to be string-based and unique across client/server. |
| eventemitter3 | ^5.x | Typed event emitter | If the custom ECS event bus needs a proven pub/sub implementation rather than hand-rolling. |

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| **Phaser** | Full game framework with its own scene management, physics, audio, input. Conflicts with custom ECS architecture. PixiJS is the rendering layer — Phaser would fight for control of the game loop. |
| **bitECS / miniplex / ecsy** | Pre-decided: custom ECS. These impose opinionated component storage (typed arrays, archetypes) that conflicts with JSON-composable entity definitions via builder patterns. |
| **Redux / Redux Toolkit** | Over-engineered for a UI reflection layer. Actions/reducers/middleware for what amounts to mirroring a few ECS query results into React. Zustand does this in 1/10th the code. |
| **MobX** | Observable-based reactivity adds unnecessary complexity. The game state updates in discrete turns, not continuous streams. Zustand's explicit `setState` matches turn-based update patterns. |
| **Jotai / Recoil** | Atomic state model is wrong shape for game state domains. No vanilla (non-React) API for engine-side writes without hooks. |
| **pathfinding (npm)** | Last published 10 years ago. Unmaintained. rot-js provides the same A*/Dijkstra algorithms with active maintenance and TypeScript support. |
| **Socket.io / WebSockets** | Not needed for V1. Server validation happens via HTTP API routes (Next.js). Single-player turn-based game — request/response is sufficient. Adding WS is premature complexity. |
| **@pixi/react (for game rendering)** | Do NOT render the game scene graph through React's reconciler. The ECS owns the scene — PixiJS `Application` should mount independently. React reconciliation on every frame/turn would be a perf disaster for tile updates. Use @pixi/react **only** if you need React-managed PixiJS UI overlays (tooltips on canvas). For V1, keep PixiJS and React as separate layers. |
| **Canvas 2D API (direct)** | PixiJS v8.16+ has an experimental canvas renderer, but WebGL/WebGPU is the primary path. Don't fall back to Canvas 2D for the game — it can't batch tiles efficiently. |
| **Three.js** | 3D renderer. This is a 2D tile-based game. PixiJS is purpose-built for 2D. |

## Architecture Note: PixiJS + React Separation

```
┌──────────────────────────────────────────┐
│  Browser Window                           │
│  ┌────────────────────────────────────┐  │
│  │  PixiJS Canvas (game rendering)    │  │
│  │  - Managed by ECS render system    │  │
│  │  - Tiles, sprites, particles       │  │
│  │  - Camera follows player           │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  React DOM Overlay (UI)            │  │
│  │  - HUD, health bars, minimap       │  │
│  │  - Inventory, menus, tooltips      │  │
│  │  - Reads from Zustand stores       │  │
│  └────────────────────────────────────┘  │
│                                           │
│  Engine writes → Zustand stores → React   │
│  User input → React handlers → Engine     │
└──────────────────────────────────────────┘
```

The PixiJS `Application` mounts to a `<canvas>` element via a single React ref. React never touches the PixiJS scene graph. The ECS render system manages all PixiJS display objects directly. Zustand stores act as the bridge: game systems write state snapshots, React UI subscribes and re-renders.

## Installation

```bash
# Core (pre-decided)
npm install pixi.js@^8.17.0 react@^19.2.4 react-dom@^19.2.4 next@^16.1.6

# PixiJS ecosystem
npm install @pixi/tilemap@^5.0.2 @pixi/particle-emitter@^5.0.10

# State management
npm install zustand@^5.0.11

# Roguelike algorithms
npm install rot-js@^2.2.1

# Validation (for JSON entity schemas + server action validation)
npm install zod@^3

# Dev dependencies
npm install -D typescript@^5.9.3 vitest@^4.1.0 happy-dom @testing-library/react eslint@^9 prettier@^3 @types/react @types/react-dom eslint-config-next

# Asset pipeline (dev, for spritesheet generation)
npm install -D @assetpack/core@^1.7.0
```

## Version Compatibility Matrix

| Package | Requires | Notes |
|---------|----------|-------|
| pixi.js ^8.17 | — | WebGL2 or WebGPU capable browser |
| @pixi/tilemap ^5.x | pixi.js ^8.x | v5.x line is the PixiJS v8 compatible version |
| @pixi/particle-emitter ^5.x | pixi.js ^8.x | v5.x line for PixiJS v8 |
| @pixi/react ^8.x | pixi.js ^8.x, react ^19 | Only if needed for canvas-embedded React UI |
| next ^16.x | react ^19 | Turbopack default, App Router |
| zustand ^5.x | react ^18 or ^19 | Works with React 19 |
| vitest ^4.x | — | Standalone, no framework coupling |
| rot-js ^2.2 | — | Zero dependencies, ES modules |

## Alternatives Considered

| Category | Chosen | Alternative | Why Not |
|----------|--------|-------------|---------|
| State mgmt | Zustand | Jotai | No vanilla store API; atomic model wrong for game state domains |
| State mgmt | Zustand | Redux Toolkit | Too much boilerplate for a UI reflection layer |
| Tilemap | @pixi/tilemap | Sprite-per-tile | Unacceptable perf at dungeon scale (hundreds/thousands of tiles) |
| Pathfinding | rot-js | pathfinding (npm) | Unmaintained (10yr), no TS types built-in |
| Testing | Vitest | Jest | Slower, requires more config for ESM/TS, Vitest is the 2025+ standard |
| Linting | ESLint 9 | Biome | Biome is faster but Next.js ships ESLint config; ecosystem maturity favors ESLint |
| Asset pipeline | AssetPack | TexturePacker (GUI) | AssetPack is code-first, automatable in CI, free, PixiJS-native manifest output |
| Particles | @pixi/particle-emitter | Custom particle system | Pre-built behavior system covers common effects; custom can come later if needed |

## Sources

- PixiJS releases: https://github.com/pixijs/pixijs/releases (v8.17.0, March 2026) — HIGH confidence
- @pixi/tilemap: https://www.npmjs.com/package/@pixi/tilemap (v5.0.2) — HIGH confidence
- @pixi/react: https://www.npmjs.com/package/@pixi/react (v8.0.5) — HIGH confidence
- @pixi/particle-emitter: https://www.npmjs.com/package/@pixi/particle-emitter (v5.0.10) — HIGH confidence
- Zustand: https://www.npmjs.com/package/zustand (v5.0.11) — HIGH confidence
- rot-js: https://www.npmjs.com/package/rot-js (v2.2.1) — HIGH confidence
- Vitest: https://www.npmjs.com/package/vitest (v4.1.0) — HIGH confidence
- Next.js: https://www.npmjs.com/package/next (v16.1.6) — HIGH confidence
- React: https://www.npmjs.com/package/react (v19.2.4) — HIGH confidence
- TypeScript: https://www.npmjs.com/package/typescript (v5.9.3) — HIGH confidence
- AssetPack: https://www.npmjs.com/package/@assetpack/core (v1.7.0) — MEDIUM confidence
- PixiJS blog (PixiJS React v8, Layout v3, AssetPack 1.0): https://pixijs.com/blog — HIGH confidence
