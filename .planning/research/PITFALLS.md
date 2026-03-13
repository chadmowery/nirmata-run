# Domain Pitfalls

**Domain:** Web-based 2D Roguelike Dungeon Crawler Engine
**Stack:** PixiJS v8 + React 19 + TypeScript + Next.js 16 + Custom ECS + @pixi/tilemap + rot-js + Zustand
**Researched:** 2026-03-13
**Overall Confidence:** HIGH (patterns sourced from established game engine literature, roguelike development community, PixiJS ecosystem experience, and web platform constraints)

---

## Critical Pitfalls

Mistakes that cause rewrites, architectural collapse, or weeks of wasted effort. Address these in design, not in debugging.

---

### Pitfall 1: Over-Engineering the Custom ECS Before You Have a Game

**What goes wrong:** You spend weeks building a "proper" ECS with archetype storage, bitmasked queries, system dependency graphs, parallel execution scheduling, and component pooling — before a single goblin moves on screen. The ECS becomes the project instead of the tool that serves the project.

**Why it happens:** ECS design is intellectually stimulating. There's always a "better" storage strategy, a "more elegant" query API, a "more correct" component lifecycle. The temptation is to build the ECS you'd want for a 10,000-entity real-time simulation when you're building a turn-based game that processes ~50-200 entities per turn.

**Consequences:**
- Weeks of development on infrastructure before any visible game progress
- Component storage strategy optimized for performance characteristics that never materialize (cache coherence doesn't matter at 100 entities per turn)
- Overly strict typing that fights JSON composability (generic type gymnastics that make adding a new component type painful)
- Brittle query system that needs rework when real game systems reveal actual query patterns

**Warning signs:**
- More than 3 days on ECS core before any game system uses it
- Writing a component storage benchmark before having 5 real components
- TypeScript generics more than 3 levels deep on the World API
- Debating SoA vs AoS storage when entity count is under 500
- Building system dependency resolution when you have < 10 systems

**Prevention:**
1. Start with the **simplest possible storage:** `Map<string, Map<EntityId, Component>>`. Component lookup by type then entity ID. It's O(1) and trivially debuggable.
2. Build **three real game systems** (movement, combat, FOV) before refactoring the ECS API. Let real usage reveal what the API needs, not hypothetical future usage.
3. **Cap initial ECS development at 2 days.** If entity lifecycle, component CRUD, and basic queries aren't working in 2 days, scope is too large.
4. JSON composability is the ECS's differentiating requirement — optimize for **developer ergonomics** (easy to add components, easy to define entities in JSON, easy to query) not runtime performance.
5. Only add query caching, archetype grouping, or component pooling when profiling shows a real bottleneck — not before.

**Phase relevance:** Phase 1 (Foundation). The temptation peaks here because the ECS is the first thing built. Timebox ruthlessly.

**Detection:** If Phase 1 takes more than 1 week, ECS scope creep is the likely cause.

---

### Pitfall 2: Rendering the Game Through React's Reconciler

**What goes wrong:** Using `@pixi/react` or a custom React-PixiJS bridge to render game tiles, entity sprites, and particles through React components. Every tile is a `<Sprite>` component. Every entity is a React node. The game scene graph lives in React's virtual DOM.

**Why it happens:** The stack includes React, PixiJS, and `@pixi/react` exists — so it feels natural to render everything through React. The developer's instinct is "I'm building a React app, everything should be a component." This is correct for UI. It is catastrophically wrong for game rendering.

**Consequences:**
- React reconciliation runs a diffing algorithm over 5,000+ tile nodes every time the player moves. Even with memoization, this is orders of magnitude slower than PixiJS's batched GPU rendering.
- React re-renders propagate through the scene component tree. A single state change can trigger hundreds of unnecessary child re-renders.
- PixiJS's `CompositeTilemap` (from `@pixi/tilemap`) batches all tiles into a single GPU draw call. React-managed sprites are individual draw calls — ~100-1000x worse GPU utilization for a tilemap.
- Mixing PixiJS's immediate-mode display object manipulation with React's declarative reconciliation creates update ordering bugs that are nearly impossible to debug.
- Memory leaks: React-managed PixiJS objects may not be properly destroyed when components unmount, leaking GPU textures.

**Warning signs:**
- Importing `@pixi/react`'s `<Stage>`, `<Container>`, `<Sprite>` for game scene objects
- Game tile components receiving props like `x`, `y`, `tileType`
- `useEffect` hooks managing PixiJS display object creation/destruction
- Performance problems appearing at > 100 visible tiles
- Frame rate drops that correlate with React profiler activity

**Prevention:**
1. **PixiJS Application mounts independently** to a `<canvas>` via a single React ref. One `useEffect` creates the app on mount, destroys it on unmount. That is the only React-PixiJS touchpoint.
2. **ECS render systems manage PixiJS display objects directly** — create sprites, set positions, destroy sprites. No React involvement in the scene graph.
3. Use `@pixi/tilemap`'s `CompositeTilemap` for terrain rendering — it's specifically designed for batched tile rendering.
4. **React handles only DOM overlay UI:** HUD, menus, inventory, message log. These are HTML elements positioned above the canvas via CSS.
5. Put this rule in the project's ESLint config or CONTRIBUTING guide: "Never import @pixi/react for game scene objects. PixiJS scene = direct API. React = DOM UI only."

**Phase relevance:** Phase 3 (Rendering). This mistake is most likely when first connecting PixiJS to the application. The correct pattern must be established before any tiles render.

**Detection:** Any import of `@pixi/react` components (Stage, Container, Sprite, etc.) in rendering code outside of optional canvas-embedded UI overlays.

---

### Pitfall 3: Building Server Authority Before the Game Works Locally

**What goes wrong:** You start implementing the server-authoritative action pipeline, Next.js API routes, and state reconciliation before the game loop, combat, AI, and rendering are working client-side. Every bug requires debugging both the game logic AND the network layer simultaneously.

**Why it happens:** Server authority is the project's "architectural centerpiece" (it's in the requirements). The instinct is to build the hard/important thing first. This is correct in concept — the action pipeline pattern (intent → validate → apply → result) should be coded from the start — but wrong in execution if it means HTTP round-trips during early development.

**Consequences:**
- Every gameplay bug requires checking: "Is this a game logic bug, a serialization bug, a validation bug, or a reconciliation bug?" Four failure modes instead of one.
- Network latency (even localhost) adds friction to every iteration cycle.
- Server-side state and client-side state can diverge in ways that mask real game logic bugs.
- Optimistic rollback bugs are impossible to diagnose when you're not sure the base game logic is correct.
- A broken API route blocks all gameplay testing.

**Warning signs:**
- `POST /api/action` is being called before the movement system works reliably in unit tests
- Debugging a combat bug by adding `console.log` to both client and server code
- "It works locally but breaks through the server" when the local implementation was never properly tested
- State reconciliation logic is being written before you have a working state to reconcile

**Prevention:**
1. **Build Phases 1-5 entirely client-side.** All game logic runs locally. The action pipeline pattern is still used (intent → validate → apply), but validation runs in the same process, not over HTTP.
2. **Phase 6 introduces the server split.** Move the validation step from a local function call to an API route. The game logic functions don't change — only where they execute.
3. Design the action pipeline interface so that `validateAction(state, action): ActionResult` is a pure function. In Phases 1-5, call it locally. In Phase 6, call it on the server. Same function, different execution context.
4. Write comprehensive unit tests for game systems in Phases 1-2. When Phase 6 introduces the server, any new bug is almost certainly in the network/reconciliation layer, not the game logic.

**Phase relevance:** Phase 6 (Server Authority). Do not attempt before Phase 4 (playable local game) is complete and tested.

**Detection:** API route code existing before a fully playable local game loop.

---

### Pitfall 4: PixiJS Display Object Leaks and Zombie Sprites

**What goes wrong:** ECS entities are created and destroyed, but their corresponding PixiJS display objects (Sprites, Containers) are not properly cleaned up. Sprites with no corresponding entity remain in the scene graph, consuming GPU memory and potentially rendering in wrong positions. Textures aren't released. The game accumulates invisible garbage.

**Why it happens:** The ECS owns entity lifecycle, but PixiJS owns display object lifecycle. These are two independent systems with no automatic synchronization. When `world.destroyEntity(goblinId)` is called, the ECS removes the entity and its components — but the PixiJS Sprite representing that goblin is still in the scene graph unless explicitly removed.

**Consequences:**
- Memory leaks: GPU textures and display objects accumulate over a play session. PixiJS v8's GC system only collects unreferenced textures, not display objects still attached to the stage.
- Zombie sprites: Dead entities' sprites remain visible, potentially overlapping new entities at the same position.
- Performance degradation: The renderer draws invisible/stale objects. `CompositeTilemap` or Container children grow without bound.
- Debugging confusion: Entity inspector shows entity destroyed, but the sprite is still visible on screen.

**Warning signs:**
- Entity count in ECS doesn't match sprite count in renderer's tracking map
- Memory usage (GPU or heap) grows each time a dungeon is generated or enemies are killed
- Brief visual glitches where a dead enemy's sprite flashes before disappearing
- `worldContainer.children.length` grows over time

**Prevention:**
1. **The render system must maintain a strict `Map<EntityId, DisplayObject>` mapping.** Every ECS entity with a `Sprite` component gets exactly one display object entry.
2. **Entity destruction must trigger display object cleanup.** Subscribe to the `ENTITY_DESTROYED` event in the render system. On destruction: remove sprite from parent container, call `sprite.destroy({ children: true })`, delete from the tracking map.
3. **ECS World should emit lifecycle events** (`ENTITY_CREATED`, `ENTITY_DESTROYED`, `COMPONENT_ADDED`, `COMPONENT_REMOVED`) that render systems subscribe to. Don't poll — react.
4. **Dungeon regeneration must destroy the entire old scene.** When generating a new level, clear all children from the world container, purge the entity-to-sprite map, and rebuild from scratch. Don't try to diff the old and new dungeons.
5. **Use PixiJS v8's `Assets.unload()` for texture cleanup** when switching texture sets or dungeon themes. Don't let old tilesets linger in GPU memory.

**Phase relevance:** Phase 3 (Rendering) establishes the pattern. Critical to get right from the first sprite.

**Detection:** Add a debug counter that compares `world.query('sprite').length` to `entitySpriteMap.size` every turn. If they diverge, there's a leak.

---

### Pitfall 5: Leaky Engine/Game Boundary — Putting Game Knowledge in the Engine

**What goes wrong:** The engine layer starts "knowing" about game concepts. The turn manager has hardcoded "player" and "enemy" phases. The grid knows about "wall" and "floor" tile types. The action pipeline has a `MoveAction` type. The engine becomes inseparable from the game.

**Why it happens:**
- It's faster to hardcode game concepts than to design proper abstractions.
- "This is the only game" rationalization — why abstract if there's only one consumer?
- Component type strings like `'health'` leak into engine query utilities.
- Convenience functions like `engine.getPlayer()` get added because they're used everywhere.

**Consequences:**
- The engine can't be used for a different game (minor concern for v1, but architectural goal is separation).
- More critically: engine changes break game code unpredictably because the boundary is unclear. What looks like an engine change is actually a game logic change, and vice versa.
- Testing becomes entangled. You can't test the engine without importing game components.
- The module structure becomes fiction — the directories say "engine/" and "game/" but the import graph says "spaghetti."

**Warning signs:**
- Engine files importing anything from `game/` or `game/components/`
- Component type string literals (e.g., `'health'`, `'position'`) appearing in engine code
- Engine functions that accept or return game-specific types
- Engine utilities named after game concepts (`getEnemiesInRange()`, `isPlayerTurn()`)
- Tests for engine modules requiring game component setup

**Prevention:**
1. **ESLint `import/no-restricted-paths` rule from day 1.** Engine cannot import from game/. This is the single most effective preventive measure. If the linter catches it, developers fix it immediately.
2. **Engine uses generic types, not concrete types.** The engine's turn manager operates on "actor IDs with a priority value," not "players and enemies." The grid stores "tile IDs," not "walls and floors." The action pipeline processes "actions conforming to an interface," not specific action types.
3. **Engine exposes contracts (interfaces/types), game implements them.** `GeneratorInterface`, `SystemFunction`, `ActionValidator` — these are engine-defined types. BSPGenerator, CombatSystem, MoveActionValidator are game-provided implementations registered with the engine.
4. **The wiring point is game/setup.ts** — this is where engine generics meet game specifics. If setup.ts is the only file that crosses the boundary (registering game components, systems, and templates with the engine), the architecture is correct.
5. **Test: can I delete game/ and replace it with a different game?** If yes, the boundary is clean. If no, find what's leaking.

**Phase relevance:** Phase 1 (Foundation) establishes the boundary. Every subsequent phase can erode it. Must be enforced continuously.

**Detection:** `grep -r "from.*game/" src/engine/` — if this returns results, the boundary is broken.

---

### Pitfall 6: State Machine State Explosion

**What goes wrong:** The game state machine grows from 5 clean states (Loading, MainMenu, Playing, Paused, GameOver) to 15+ states as edge cases accumulate: `PlayingAwaitingServer`, `PlayingAnimating`, `PlayingEnemyTurn`, `PlayingTargeting`, `PausedFromInventory`, `GameOverVictory`, `GameOverDeath`. Each new state multiplies the transition matrix.

**Why it happens:** Turn-based games have many sub-phases that feel like distinct states. "Player is selecting a target for a ranged attack" feels different from "player is waiting for input." "Animations are playing" feels different from "waiting for server response." The instinct is to model each as a state machine state.

**Consequences:**
- Transition matrix grows quadratically. 5 states = 20 possible transitions. 15 states = 210 possible transitions. Most combinations are invalid but still need guarding.
- Bugs hide in unexpected transitions: What happens if the player presses a key during `PlayingAnimating`? What if the server responds during `PausedFromInventory`?
- Each new feature (targeting, inventory, shop) adds 2-3 states, multiplying the combinatorial space.
- State machine code becomes the most-changed, most-bugged file in the project.

**Warning signs:**
- More than 6-7 states in the main game FSM
- State names that concatenate two concepts (`PlayingAnimating`, `PausedFromShop`)
- Transition handlers with long `if/else` chains checking current sub-state
- Bugs that manifest as "the game was in an impossible state"
- Adding a new feature requires modifying the state machine in > 3 places

**Prevention:**
1. **Keep the top-level FSM to 5 states:** Loading, MainMenu, Playing, Paused, GameOver. These represent fundamentally different application modes.
2. **Sub-phases within `Playing` are NOT FSM states.** They are flags or nested state on the turn manager: `{ awaitingInput: boolean, animating: boolean, awaitingServer: boolean, targeting: TargetingState | null }`. The Playing state's `update()` checks these flags.
3. **Input gating is a flag, not a state.** `canAcceptInput(): boolean` checks `!animating && !awaitingServer && turnPhase === 'AWAIT_INPUT'`. Don't create a separate state for "can't accept input."
4. **Targeting mode is a sub-mode of Playing, not a separate state.** When the player activates a ranged ability, set a `targeting` context object. The input handler checks for it and routes key presses to the targeting system. When targeting resolves or cancels, clear the context. No FSM transition needed.
5. **Rule of thumb:** If a "state" doesn't change which systems execute, it's not a state — it's a flag.

**Phase relevance:** Phase 1 (State Machine definition). Starts clean, degrades in Phases 4-7 as features add interaction complexity.

**Detection:** Count top-level states. If > 7, refactor sub-phases into flags/context on the Playing state.

---

### Pitfall 7: Optimistic Client Reconciliation — Death by Edge Cases

**What goes wrong:** The optimistic client works for the happy path (player moves, server confirms) but breaks on edge cases: player moves into a tile that an enemy just moved to (server rejects), player kills an enemy optimistically but server says the enemy had a shield buff, player picks up an item another process already consumed, animations play for an action the server rejected.

**Why it happens:** Optimistic prediction is fundamentally a bet that the server will agree. In a single-player turn-based game, this bet almost always wins — but "almost always" means "sometimes doesn't." The edge cases are rare enough to miss in testing but common enough to ship bugs.

**Consequences:**
- Visual glitches: sprite teleports back to previous position after a rejected move. Entity briefly disappears then reappears when a kill is rejected.
- Animation desync: tweens play for a rejected action, then the entity snaps to a different position.
- UI inconsistency: message log says "You killed the Goblin" but the goblin is still alive on screen.
- State corruption: optimistic state modifications partially applied before server rejection, leaving components in an inconsistent state.

**Warning signs:**
- Testing only the happy path (server confirms every action)
- Rollback code that restores individual fields instead of a complete snapshot
- Animations triggered at optimistic-apply time with no cancellation path
- Message log entries added before server confirmation

**Prevention:**
1. **V1: use full-state-replace, not delta reconciliation.** Server returns the complete game state snapshot after every action. Client replaces its state entirely with the server snapshot. This is simple, correct, and eliminates all partial-rollback bugs. State is small enough (~10-50KB JSON per turn) that this is free over HTTP.
2. **Decouple visual feedback from state commitment.** Optimistic apply moves the sprite visually but doesn't add messages to the log or trigger death cleanup until server confirms. Visual-only optimism is the safest form.
3. **Never trigger irreversible side effects optimistically.** Entity destruction, message log entries, inventory changes, and event bus emissions should wait for server confirmation. Only visual sprite position updates should be optimistic.
4. **On server rejection, don't rollback — just full-replace.** Replace the entire client state with the server's authoritative snapshot. This is idempotent and eliminates the "what exactly needs rolling back?" problem.
5. **Test rejection paths explicitly.** Write test cases for: server rejects move (occupied tile), server rejects attack (target out of range), server rejects pickup (item gone), server returns unexpected enemy positions.

**Phase relevance:** Phase 6 (Server Authority). This is the hardest part of Phase 6. Get full-state-replace working first. Only optimize to delta-based reconciliation if profiling shows the full-state JSON is too large (unlikely for v1).

**Detection:** Manually test by temporarily making the server reject every other action. Watch for visual artifacts.

---

## Moderate Pitfalls

Mistakes that cause significant rework or persistent bugs. Not catastrophic on their own, but compound quickly.

---

### Pitfall 8: BSP Dungeon Generation — Disconnected Rooms and Degenerate Layouts

**What goes wrong:** The BSP algorithm generates dungeons where some rooms are unreachable, corridors create dead-end pockets, the player spawns in an isolated section, or layouts are visually monotonous (all rooms same size, all corridors single-width, no variety).

**Why it happens:** Basic BSP implementations split space recursively and place rooms in leaf nodes, then connect sibling leaves with corridors. This guarantees sibling connectivity but can miss cross-branch connectivity. Edge cases in room sizing constraints produce dungeons where rooms are too small (1x1) or too large (filling the entire partition), corridors overlap rooms oddly, or doors place on corners creating walkability ambiguity.

**Consequences:**
- Players get stuck in rooms with no exit — game-breaking.
- Enemy and item placement in unreachable rooms wastes spawns and creates invisible content.
- Monotonous layouts ("why do all rooms look the same?") undermine the dungeon-crawling experience.
- Pathfinding fails (A* returns no path) for enemies trying to reach the player, causing AI freezes or crashes.

**Warning signs:**
- Post-generation flood fill from player spawn doesn't reach all rooms
- Pathfinding occasionally returns null/empty path results
- Playing the same generation seed repeatedly shows a pattern of one dominant room shape
- Rooms touching the dungeon boundary have clipped corridors

**Prevention:**
1. **Post-generation connectivity validation is mandatory.** After generating the dungeon, flood fill from the player's spawn point. If any room's floor tiles are unreachable, add a connecting corridor or regenerate with a different seed. This is a hard requirement, not an optimization.
2. **Enforce room size minimums and maximums relative to the partition size.** Room must be at least 3x3 (interior walkable space) and no larger than 80% of its partition. This prevents degenerate 1x1 rooms and rooms that fill their entire partition (leaving no corridor space).
3. **Connect siblings, then validate.** BSP's natural corridor strategy (connect midpoints of sibling partitions) works for most cases. After all sibling corridors are placed, run the flood fill. Only add additional corridors if connectivity fails.
4. **Use rot-js's RNG (Alea PRNG) for deterministic generation.** When a layout is degenerate, log the seed. Reproduce it in a test. Fix the algorithm. Build a test suite of known-bad seeds.
5. **Vary room placement within partitions.** Don't always center rooms — randomize horizontal and vertical offset within the partition. This creates more organic-feeling layouts.
6. **Corridor width variation.** Occasionally use 2-wide corridors (especially for main connections). Single-tile corridors everywhere feels claustrophobic and makes multi-entity encounters impossible in hallways.

**Phase relevance:** Phase 5 (Dungeon Generation). Build generation tests before building generation. Define what a "valid" dungeon looks like in assertions: all rooms reachable, minimum room count, player can reach stairs.

**Detection:** Automated test: generate 100 dungeons with different seeds, validate connectivity for each. If any fail, the algorithm has a gap.

---

### Pitfall 9: JSON Entity Templates — Schema Drift and Silent Failures

**What goes wrong:** JSON entity definitions (`goblin.json`) reference component types that don't exist, contain mistyped field names, use wrong value types, or define components with fields the system doesn't read. The entity assembles "successfully" but is broken — a goblin with `{ "helath": 10 }` (typo) has no health, and nothing reports an error.

**Why it happens:** JSON has no type safety. Component names are strings. Field names are strings. There's no compile-time check that `goblin.json`'s components match the actual component type definitions in TypeScript. As the game evolves, component shapes change but JSON templates don't, creating silent drift.

**Consequences:**
- Entities silently missing components. A goblin without health can't be damaged — the combat system queries for `health` and gets nothing. The goblin is immortal, and the developer spends hours debugging the combat system when the bug is in the JSON.
- Runtime crashes in systems that assume components exist. `getComponent<Health>(entity, 'health')!.current` throws when health is undefined.
- Schema drift: a component's TypeScript definition changes (field renamed from `damage` to `baseDamage`) but the JSON templates still use `damage`. No error. The field is silently ignored.
- Proliferation of "almost valid" entities that work for some systems and silently fail for others.

**Warning signs:**
- Entities behaving unexpectedly with no errors in the console
- Systems using `!` (non-null assertion) on `getComponent()` results
- Component changes requiring manual audits of all JSON files
- No validation step between JSON parsing and entity creation

**Prevention:**
1. **Zod schemas for every component type, validated at entity assembly time.** When the entity builder reads `goblin.json`, each component's data is validated against its Zod schema. Invalid data throws an error immediately — at load time, not during gameplay.
   ```typescript
   const HealthSchema = z.object({ type: z.literal('health'), current: z.number(), max: z.number() });
   ```
2. **Component registry validates component type names.** If a JSON template references `{ "helath": ... }`, the registry rejects it: "Unknown component type: 'helath'. Did you mean 'health'?"
3. **Zod schemas are the single source of truth.** TypeScript types are derived from Zod schemas via `z.infer<typeof HealthSchema>`. This guarantees that runtime validation and compile-time types are always in sync.
4. **Entity assembly validation emits clear errors with template name and component details.** Not "Validation failed" but "Entity template 'goblin': component 'helath' is not a registered component type."
5. **Integration test: load all JSON templates, assemble all entity types, verify no validation errors.** This runs in CI. When a component schema changes, this test catches all stale JSON templates immediately.

**Phase relevance:** Phase 1 (Entity Builder/Factory). Zod validation is not optional — add it when the builder is built, not later.

**Detection:** Any `getComponent()` call returning `undefined` for a component that "should" exist is a schema drift signal. Make `getComponent()` log a warning in development mode when the result is undefined and the entity was assembled from a template that claims to include that component.

---

### Pitfall 10: Coupling PixiJS Lifecycle to React Lifecycle

**What goes wrong:** The PixiJS `Application` is created in a React component's `useEffect`, the game loop runs in React's render cycle, PixiJS assets are loaded in React's state management, and React Strict Mode (which double-invokes effects in development) creates the PixiJS application twice — double canvas, double render loop, double memory usage.

**Why it happens:** In a React-centric mindset, everything is a side effect of a component mounting. PixiJS initialization feels like a side effect. But PixiJS Application has a fundamentally different lifecycle from a React component — it's a long-lived singleton that should outlive component re-renders.

**Consequences:**
- **React Strict Mode double-mount:** In development, React 18+/19 runs effects twice. The PixiJS Application is created, attached to the canvas, destroyed, and created again. This may leak GPU resources, WebGL contexts, or ticker subscriptions even if the effect cleanup runs.
- **WebGL context limits:** Browsers limit WebGL contexts (typically 8-16 per page). Creating and destroying PixiJS applications during React re-renders can exhaust this limit, causing "Too many active WebGL contexts" errors and black canvases.
- **Asset loading race conditions:** If asset loading is triggered in useEffect, a fast re-render can start a second load before the first completes, causing duplicate texture allocations or "asset already loaded" errors.
- **Ticker/game loop drift:** If the PixiJS ticker is started/stopped by React lifecycle, unmounting and remounting the game component (e.g., routing between pages) creates gaps in the game loop.

**Warning signs:**
- Two canvases appearing in development mode
- "WebGL: CONTEXT_LOST_WEBGL" errors in the browser console
- Asset loading happening multiple times on page load
- Game running at double speed (two tickers) after a hot module reload
- Black canvas after navigating away and back

**Prevention:**
1. **Create PixiJS Application outside React's render tree.** Initialize it in a module-level singleton or a game initialization function called once.
   ```typescript
   // renderer.ts — NOT inside a component
   let app: Application | null = null;
   export async function initRenderer(canvas: HTMLCanvasElement) {
     if (app) return app;
     app = new Application();
     await app.init({ canvas, resizeTo: canvas.parentElement! });
     return app;
   }
   ```
2. **The React GameCanvas component only provides the DOM mount point.** It renders a `<div>`, passes the ref to the init function on first mount, and calls `app.destroy()` on unmount. It does NOT create the Application.
3. **Guard against double-initialization.** The init function checks if an app already exists and returns the existing one. This handles React Strict Mode double-mounts cleanly.
4. **Asset loading happens once, outside React.** Use PixiJS's `Assets.init()` and `Assets.load()` in the game's Loading state (state machine), not in a useEffect. The Loading FSM state runs after the Application is created.
5. **Keep the PixiJS ticker independent.** The game loop (ticker) is managed by the game state machine, not by React. React doesn't start, stop, or pace the game loop.

**Phase relevance:** Phase 3 (Rendering). Must be addressed when the PixiJS Application is first created. Wrong patterns here corrupt everything built on top.

**Detection:** In development, check `document.querySelectorAll('canvas').length`. If > 1, double-init is happening.

---

### Pitfall 11: Turn Ordering Bugs — Entities Acting Out of Sequence

**What goes wrong:** Enemies act in wrong order, dead entities get a turn (their AI runs after they died but before cleanup), status effects tick at the wrong phase (poison kills an entity before it can act, or after it already acted), and the player can act during enemy turns.

**Why it happens:** Turn-based games have subtly complex ordering requirements that look simple until implementation. "Player acts, then enemies act" seems clear, but: In what order do enemies act? What happens when enemy A kills enemy B before B's turn? When does poison tick — before the player acts (pre-turn) or after (post-turn)? Can the player queue an action while animations from the previous turn are still playing?

**Consequences:**
- Dead entities' AI runs, potentially moving a corpse or attacking nothing (crashes or visual corruption).
- Status effects that should prevent an action (stun) don't fire until after the action resolves.
- Players can double-act by queuing input during enemy processing, bypassing turn gating.
- Non-deterministic behavior: enemy turn order varies between server and client, causing reconciliation divergence.

**Warning signs:**
- Entity's AI system running after the entity was killed in the same turn
- Poison damage applying inconsistently (sometimes before action, sometimes after)
- Pressing keys rapidly causes the player to move multiple times per turn
- Server and client produce different turn outcomes for the same starting state

**Prevention:**
1. **Explicit phase ordering with clear documentation:**
   - Pre-turn phase: status effects tick (poison, buffs expire, stun blocks action)
   - Player action phase: process exactly one player action
   - Enemy turns phase: each enemy acts in deterministic order (entity ID ascending, or by speed if energy system exists)
   - Post-turn phase: death cleanup, FOV recalculation, UI sync
2. **Dead entity skip:** Before running an enemy's AI, check if it's still alive (`hasComponent('health') && getComponent<Health>('health').current > 0`). Enemies killed earlier in the turn are skipped.
3. **Input gating flag:** Set `awaitingInput = false` when the turn begins processing. Only set it back to `true` after all phases complete and rendering finishes. Ignore all key events when `awaitingInput === false`.
4. **Deterministic enemy ordering:** Sort enemies by entity ID (or energy value). Never iterate a Set or Map for turn ordering — their iteration order is insertion-order in JS, but entity creation order may differ between client and server.
5. **Input queue with single-action drain:** Buffer at most one future action. When the turn completes and input is re-enabled, drain the buffer. Discard any additional queued inputs. This prevents action flooding but allows "typing ahead" one move for snappy feel.

**Phase relevance:** Phase 2 (Game Loop). Establish turn phase ordering as a documented, tested contract. Every subsequent phase that adds turn-phase behavior must slot into the existing order.

**Detection:** Write a turn-sequence test: create a scenario with player and 3 enemies, run one full turn, assert exact execution order (pre-turn → player → enemy1 → enemy2 → enemy3 → post-turn). If any step is out of order, the test catches it.

---

### Pitfall 12: Server-Side State Stored in Next.js API Route Memory

**What goes wrong:** The authoritative game state is stored in a module-level `Map<string, GameState>` in the API route. This works during development, then breaks in production: Next.js API routes may run in different serverless function instances, state is lost between cold starts, memory grows unbounded as old game sessions aren't cleaned up, and there's no persistence across deployment.

**Why it happens:** For v1 this IS the recommended approach (and that's fine for a tech demo). The pitfall isn't using it — it's failing to acknowledge the constraints and building on assumptions that won't hold.

**Consequences (if constraints aren't understood):**
- Production serverless environments (Vercel) spin up multiple instances. Each instance has its own `Map`. A request routed to instance B has no access to state created on instance A.
- Memory leaks: without a TTL mechanism, the Map grows with every new game ID and never shrinks. Long-running dev servers during development will accumulate stale game states.
- No recovery from server restart. Page refresh triggers a new game, not resumption of the old one.
- If the developer doesn't realize these are constraints (not bugs), they'll spend time debugging "works locally, broken in production" issues.

**Warning signs:**
- Planning to deploy to Vercel/serverless before acknowledging the in-memory limitation
- No cleanup mechanism for old game entries in the Map
- Testing only with `next dev` (single-process) and assuming production behaves the same
- No game session timeout or maximum concurrent games limit

**Prevention:**
1. **For v1: explicitly document this as a known limitation.** In-memory state is intentional and sufficient for a tech demo running locally. This is not a bug to fix — it's a design choice with acknowledged constraints.
2. **Add a TTL to the game Map.** Entries older than 30 minutes are deleted. This prevents unbounded memory growth during development.
3. **Add a maximum game count.** If the Map exceeds 50 entries, reject new game creation. Prevents runaway memory in a dev environment.
4. **Do NOT deploy to serverless for v1.** Use `next start` on a single long-lived process (VPS, container, or local). Serverless deployment is a future concern that requires moving state to Redis or a database.
5. **Design the state interface so the storage backend is swappable.** `getGameState(id): GameState | null` and `saveGameState(id, state): void` can be backed by a Map today and Redis tomorrow. Don't scatter `games.get(id)` throughout the codebase.

**Phase relevance:** Phase 6 (Server Authority). Understand the constraint when building it. Plan the production upgrade for a future milestone.

**Detection:** If `games.size` > 100 during a dev session, something isn't cleaning up.

---

### Pitfall 13: @pixi/tilemap Performance — Rebuilding the Entire Tilemap Every Frame

**What goes wrong:** The render system clears and rebuilds the `CompositeTilemap` every frame or every turn by iterating over all tiles and calling `tile()` for each one. For a 100x100 dungeon (10,000 tiles), this creates 10,000 method calls per update.

**Why it happens:** The simplest CompositeTilemap pattern is: clear, iterate grid, add tiles. This works for small maps but doesn't scale. Tutorial code often shows this pattern without mentioning that it's O(n) per update where n is total tiles, not just visible or changed tiles.

**Consequences:**
- Frame time spikes when the tilemap is rebuilt. At 10,000 tiles, `clear()` + 10,000 `tile()` calls can take 5-15ms — a significant portion of a 16ms frame budget.
- For turn-based games this is less critical (tiles only change on turns, not every frame) but still wasteful.
- Larger maps (200x200 = 40,000 tiles) become visibly laggy even on turn updates.

**Warning signs:**
- `CompositeTilemap.clear()` called in the PixiJS ticker callback (per-frame, not per-turn)
- Frame time profiling shows tilemap rebuild as the dominant cost
- Performance degrades linearly with map size

**Prevention:**
1. **Build the tilemap once at dungeon generation time.** Call `tile()` for every tile in the grid. Store the CompositeTilemap as a persistent object.
2. **Only rebuild on dungeon regeneration** (new level). Don't clear and rebuild on every turn.
3. **FOV updates use tinting, not tile replacement.** When visibility changes, adjust tile `tint` and `alpha` on the existing display objects — don't rebuild the tilemap. Use FOV overlay techniques: a separate fog layer with alpha sprites, or `CompositeTilemap`'s tinting capabilities.
4. **Viewport culling:** Only add tiles within the camera viewport to the tilemap. This caps the tile count at `(viewportWidth / tileSize) * (viewportHeight / tileSize)`, typically ~500-2000 tiles regardless of total map size. Rebuild the visible set when the camera moves.
5. **If using viewport culling with CompositeTilemap:** Rebuild only the visible slice when the camera moves enough to shift by one or more tiles. Use a dirty flag or position delta check.

**Phase relevance:** Phase 3 (Tile Rendering). Choose the correct pattern (build-once or viewport-culled) at first implementation. Retrofitting from rebuild-every-turn to build-once is a moderate refactor.

**Detection:** Profile with Chrome DevTools Performance tab. If `CompositeTilemap.clear` or `tile` calls occupy > 5ms on a turn update, the rebuild pattern needs optimization.

---

### Pitfall 14: AI Pathfinding Performance — A* Per Enemy Per Turn

**What goes wrong:** Every enemy runs A* pathfinding to the player every turn. With 20 enemies on a 100x100 grid, that's 20 independent A* calls per turn. A* has worst-case O(V log V) where V is walkable tiles. Even with rot-js's efficient implementation, this can spike to 50-100ms with many enemies on large maps.

**Why it happens:** The simple AI pattern is "if I can see the player, pathfind to them." Each enemy independently computes its full path. There's no path sharing between enemies heading to the same destination.

**Consequences:**
- Turn processing time spikes with enemy count × map size. 30 enemies on a 200x200 map can take 200ms+ per turn.
- Perceived lag: the game freezes for a noticeable moment after each player action while enemy AI processes.
- In server-authoritative mode, this compounds: the server must run all AI pathfinding before returning the action response, adding to HTTP round-trip latency.

**Warning signs:**
- Turn processing time increasing as players descend to floors with more enemies
- Chrome profiling shows A* calls dominating turn processing
- Server response time > 200ms for turns with many enemies

**Prevention:**
1. **For v1 with < 30 enemies: this probably isn't a problem.** rot-js A* on a 100x100 grid with 30 enemies finishes in < 20ms on modern hardware. Don't optimize prematurely.
2. **Cache paths per enemy across turns.** An enemy's path to the player only changes if the player moved or the map changed (doors opened, entities moved). If neither happened, reuse last turn's path minus the first step already taken.
3. **Limit pathfinding range.** Enemies beyond a certain distance (e.g., 20 tiles) from the player don't pathfind — they wander randomly or stay idle. Only enemies within engagement range run A*.
4. **Future optimization: Dijkstra map.** Compute a single Dijkstra distance map from the player's position. All enemies read this map to determine their next step. One O(V) computation instead of N times O(V log V). rot-js `Path.Dijkstra` supports this pattern.
5. **Enemies not in player's FOV skip complex AI.** If the player can't see them, they don't need to pathfind — simple behavior (wander, idle) suffices. This is also more thematically correct for roguelikes.

**Phase relevance:** Phase 2 (AI System). Build the simple approach (A* per enemy) first. Add Dijkstra maps as a Phase 7 optimization if profiling shows a need.

**Detection:** Measure turn-processing time in development. Log `performance.now()` before and after the enemy turn phase. If it exceeds 50ms, pathfinding is the likely bottleneck.

---

### Pitfall 15: Action Pipeline — Client/Server Logic Duplication

**What goes wrong:** The same validation and game logic exists in two places: client-side for optimistic prediction and server-side for authoritative validation. When a formula changes (damage calculation, movement rules, item effects), it must be updated in both places. One gets updated, the other doesn't. The client predicts incorrect outcomes, causing constant reconciliation snapping.

**Why it happens:** The obvious architecture is: client has its own game loop, server has its own game loop. They share action types but have separate implementations of validation and application logic. Over time, the two implementations drift.

**Consequences:**
- Every optimistic action predicts wrong results, causing visible snap-back on every turn.
- Developer must maintain two copies of every game rule: DRY violation at the architectural level.
- Tests need to verify behavior in two code paths, doubling test surface.
- "Works on client" / "works on server" becomes a recurring bug category.

**Warning signs:**
- Same combat formula written in both `/network/optimistic.ts` and `/server/api/action/route.ts`
- Client-side movement validation that differs from server-side validation
- Frequent reconciliation corrections even for simple actions
- Separate test suites for client and server game logic

**Prevention:**
1. **Game logic lives in one place: `game/systems/`.** These are pure functions that operate on game state. Both client and server import and call the same functions.
   ```typescript
   // game/systems/combat.ts — single implementation
   export function resolveCombat(state: GameState, attacker: EntityId, defender: EntityId): CombatResult { ... }

   // Client: import { resolveCombat } from 'game/systems/combat';
   // Server: import { resolveCombat } from 'game/systems/combat';
   ```
2. **The action pipeline interface (`validateAction`, `applyAction`) is shared code.** The only difference between client and server is: client calls it locally and optimistically, server calls it authoritatively and returns the result.
3. **Don't write game logic in API routes.** API routes are thin handlers: deserialize request, load state, call shared game logic functions, serialize response. Zero game knowledge in the route code.
4. **Put shared code in `shared/` or structure `game/` so it's importable from both client and server.** Next.js App Router allows importing shared modules in both client components and API routes — use this.
5. **Test game logic once, at the function level.** Don't test it through HTTP requests. If `resolveCombat(state, a, b)` returns the right result, it returns the right result regardless of whether the client or server called it.

**Phase relevance:** Phase 2 (design the action pipeline) through Phase 6 (server split). The architecture decision is made in Phase 2. If actions are modeled as pure functions from the start, the Phase 6 server split is trivial.

**Detection:** `grep -r "function.*validate\|function.*apply\|function.*resolve" src/server/ src/network/` — if game logic functions appear in network or server directories (not imported from game/), there's duplication.

---

## Minor Pitfalls

Issues that cause friction, wasted time, or hard-to-diagnose bugs. Not architectural but common enough to document.

---

### Pitfall 16: Browser Keyboard Event Conflicts

**What goes wrong:** Arrow keys scroll the page. Space bar scrolls down. Tab switches focus to browser chrome. Backspace navigates back. Browser keyboard shortcuts fight with game input.

**Prevention:** Call `event.preventDefault()` on all captured game keys in the input handler. Use a focused container element or `tabIndex={0}` on the canvas wrapper to ensure the game receives keyboard events. Test in multiple browsers — Firefox and Safari handle keyboard focus differently from Chrome.

**Phase relevance:** Phase 4 (Input System). Trivial to fix when known, maddening to debug when not.

---

### Pitfall 17: Zustand Store Granularity — Too Few or Too Many Stores

**What goes wrong:** Either one monolithic `gameStore` that re-renders every React component on every tiny change, or 15 micro-stores that are hard to coordinate and debug.

**Prevention:** Domain-scoped stores: `playerStore` (health, stats), `messageStore` (log entries), `gameStateStore` (FSM state, loading). 3-5 stores for v1. Use `subscribeWithSelector` to let components subscribe to specific slices. If UI re-renders feel excessive, the store is too coarse. If store coordination is painful, stores are too fine.

**Phase relevance:** Phase 4 (UI Integration). Define stores when defining what the UI displays.

---

### Pitfall 18: Hot Module Reload Breaking Game State

**What goes wrong:** During development, HMR replaces a module but the PixiJS Application, ECS World, and game state persist from the previous version. The new code operates on stale state, creates duplicate event listeners, or registers systems twice.

**Prevention:** In the PixiJS mount component, check for existing application instances before creating new ones. In the game bootstrap, add cleanup hooks that HMR calls before reinitializing. Or: accept that HMR doesn't work cleanly for game state and use full page reloads during game development (add `/* @refresh reset */` to the game canvas component in React).

**Phase relevance:** Ongoing from Phase 3. Document the HMR behavior for developer experience.

---

### Pitfall 19: Testing PixiJS Rendering in Node.js

**What goes wrong:** Attempting to unit-test PixiJS rendering code in Vitest (Node.js environment). PixiJS requires a WebGL/WebGPU context. `happy-dom` and `jsdom` don't provide real WebGL. Tests fail with "WebGL not supported" or require complex mocking of the entire PixiJS rendering pipeline.

**Prevention:** **Don't unit-test rendering.** Test the engine layer (ECS, game systems, dungeon generation, turn logic, pathfinding) — these are pure data transformations with no rendering dependency. For the render system, test the data flow: "does the render system read the correct components and compute the correct sprite positions?" Mock the PixiJS API at the interface boundary if needed. For visual correctness, use manual testing or screenshot-based visual regression (Playwright) as a later addition. Acceptance testing with a real browser context is the correct level for rendering validation.

**Phase relevance:** Phase 1-2 (Testing setup). Establish the testing boundary early: engine systems = unit tested, rendering = integration/visual tested.

---

### Pitfall 20: Initial Entity Placement Ignoring FOV

**What goes wrong:** Enemies and items are placed throughout the generated dungeon without considering FOV. The player's first view shows enemies and items in their starting room — all threats and rewards immediately visible, killing the sense of exploration.

**Prevention:** Place enemies and items **outside** the player's starting room (or at minimum outside the player's initial FOV radius). The player's starting room should be safe — the first enemy encountered should require moving to a new room. Validate placement against the starting FOV in post-generation.

**Phase relevance:** Phase 5 (Dungeon Generation, specifically the placement system). Small detail, large impact on first impression.

---

### Pitfall 21: Circular References in Entity Templates

**What goes wrong:** Entity templates reference other templates (e.g., "goblin drops health-potion") and these references create cycles: goblin → drops → health-potion → used-by → goblin. Or template composition (goblin extends base-enemy which includes... goblin-specific fields?) creates inheritance-like structures that the JSON deserializer can't resolve.

**Prevention:** Entity templates reference other templates **by name** (string), never by embedding objects. The registry resolves names at spawn time, not at template load time. Template references are "has-a" (loot tables, spawn lists), never "is-a" (inheritance). If a template needs to inherit, use explicit composition: `"extends": "base_enemy"` means "merge base_enemy's components under mine" — but resolve this flat at registration time, producing a single merged template with no reference to the parent. Prohibit circular `extends` chains with a depth guard (e.g., max 3 levels).

**Phase relevance:** Phase 1 (Entity Builder). Establish the reference resolution pattern when the builder is built.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 1 (Foundation) | Over-engineering ECS (Pitfall 1), Leaky engine/game boundary (Pitfall 5) | Timebox ECS to 2 days. ESLint import restrictions from day 1. |
| Phase 2 (Game Loop) | Turn ordering bugs (Pitfall 11), Action pipeline not designed for sharing (Pitfall 15) | Document turn phase order as a tested contract. Design action functions as pure, shareable. |
| Phase 3 (Rendering) | React rendering the game (Pitfall 2), PixiJS lifecycle coupling (Pitfall 10), Display object leaks (Pitfall 4), Tilemap rebuild every frame (Pitfall 13) | Mount PixiJS outside React. Singleton Application. Build-once tilemap. Entity-to-sprite tracking map. |
| Phase 4 (Input + UI) | State explosion (Pitfall 6), Keyboard conflicts (Pitfall 16), Store granularity (Pitfall 17) | Top-level FSM ≤ 5 states, sub-phases as flags. `preventDefault()` on game keys. 3-5 domain stores. |
| Phase 5 (Generation) | Disconnected rooms (Pitfall 8), Bad entity placement (Pitfall 20) | Post-gen flood fill validation. Enemies outside starting room. |
| Phase 6 (Server Authority) | Building server before local game works (Pitfall 3), Optimistic reconciliation edge cases (Pitfall 7), Logic duplication (Pitfall 15), In-memory state limits (Pitfall 12) | Phase 6 requires Phase 4 complete. Full-state-replace for v1. Shared game logic functions. Documented in-memory constraints. |
| Phase 7 (Polish) | AI pathfinding at scale (Pitfall 14), HMR breakage (Pitfall 18) | Profile before optimizing. Accept HMR limitations for game state. |

---

## Sources

- ECS over-engineering patterns: Established game engine community wisdom (Bevy, ECS FAQ, roguelike development resources). Common mistake documented across multiple indie game dev post-mortems. HIGH confidence.
- PixiJS + React integration: PixiJS documentation, @pixi/react documentation (explicit warnings about when NOT to use the React reconciler for game scenes). Verified via STACK.md research. HIGH confidence.
- BSP dungeon generation pitfalls: RogueBasin BSP dungeon generation articles, roguelike development community (r/roguelikedev FAQ Friday threads, IRDC talks). Well-documented category of issues. HIGH confidence.
- Turn ordering complexity: Traditional roguelike development resources. Turn scheduling is one of the most-discussed topics in roguelike development. HIGH confidence.
- Optimistic client reconciliation: Gabriel Gambetta "Fast-Paced Multiplayer" articles, Valve Source Engine networking documentation, adapted for turn-based HTTP context. HIGH confidence for patterns; MEDIUM confidence for HTTP-specific adaptation.
- Next.js serverless state limitations: Next.js documentation on API routes and serverless function behavior. Vercel deployment documentation. HIGH confidence.
- @pixi/tilemap performance: PixiJS userland tilemap documentation, community benchmarks. MEDIUM confidence (performance characteristics depend on specific version and hardware).
- JSON entity template validation: Zod documentation. Pattern is standard in TypeScript ecosystem. HIGH confidence.
- Browser keyboard handling: MDN Web Docs (KeyboardEvent, preventDefault). Standard web platform knowledge. HIGH confidence.
