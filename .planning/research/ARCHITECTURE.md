# Architecture Patterns

**Domain:** Web-based 2D Roguelike Dungeon Crawler Engine
**Researched:** 2026-03-13
**Overall Confidence:** HIGH (patterns are well-established across game engine literature and web platform constraints)

---

## Recommended Architecture

### High-Level Overview

The system is organized in four horizontal layers with a vertical authority split between client and server. Dependencies flow **downward only** — upper layers depend on lower layers, never the reverse. The engine/game boundary cuts **vertically** through the bottom two layers, separating game-agnostic infrastructure from game-specific logic and content.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │  React UI (DOM overlay) │  │  PixiJS Renderer (Canvas)    │  │
│  │  HUD, menus, inventory  │  │  Tiles, sprites, particles   │  │
│  │  Reads ← Zustand stores │  │  Managed by render systems   │  │
│  └────────────▲────────────┘  └──────────────▲───────────────┘  │
│               │                               │                  │
├───────────────┼───────────────────────────────┼──────────────────┤
│               │         GAME LAYER            │                  │
│  ┌────────────┴────────────────────────────────┴──────────────┐  │
│  │  Game Systems: Combat, AI, Movement, FOV, Dungeon Gen      │  │
│  │  Entity Definitions (JSON): Goblin, Potion, Player         │  │
│  │  Game Components: Health, MeleeAttack, AIBehavior           │  │
│  │  UI State Bridge (writes Zustand stores)                    │  │
│  └────────────────────────────▲───────────────────────────────┘  │
│                               │                                  │
├───────────────────────────────┼──────────────────────────────────┤
│                               │                                  │
│  ┌────────────────────────────┴───────────────────────────────┐  │
│  │                      ENGINE LAYER                          │  │
│  │  ECS Core (World, entities, components, systems, queries)  │  │
│  │  Game State Machine (Loading, Playing, Paused, GameOver)   │  │
│  │  Turn Manager (turn phases, turn queue, scheduling)         │  │
│  │  Event Bus (typed pub/sub)                                  │  │
│  │  Entity Builder / Registry / Factory                        │  │
│  │  Generation Interface (contract, not implementation)        │  │
│  │  Action Pipeline (intent → validate → apply → result)      │  │
│  └────────────────────────────▲───────────────────────────────┘  │
│                               │                                  │
├───────────────────────────────┼──────────────────────────────────┤
│                        PLATFORM LAYER                            │
│  PixiJS v8 | React 19 | Next.js 16 | Browser APIs | rot-js      │
└──────────────────────────────────────────────────────────────────┘
```

### Client ↔ Server Authority Split

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│         CLIENT               │         │          SERVER              │
│                              │         │    (Next.js API Routes)      │
│  Input Capture               │         │                              │
│       ↓                      │         │                              │
│  Action Intent               │         │                              │
│       ↓                      │         │                              │
│  Optimistic Apply ───────────┼── POST ─┼→ Validate Action             │
│  (predicted state)           │         │       ↓                      │
│       ↓                      │         │  Apply to Authoritative      │
│  Render predicted state      │         │       ↓                      │
│       ↓                      │         │  Return ActionResult         │
│  Receive server result ←─────┼── 200 ──┼─ { ok, state, events }      │
│       ↓                      │         │                              │
│  Reconcile                   │         │                              │
│  (predicted vs authoritative)│         │                              │
│       ↓                      │         │                              │
│  Render authoritative state  │         │                              │
└─────────────────────────────┘         └─────────────────────────────┘
```

---

## Engine vs. Game Separation

This is the most important architectural boundary. The engine knows **nothing** about goblins, health potions, or dungeon themes. It provides the machinery; the game provides the content.

### What Goes Where

| Engine (game-agnostic) | Game (game-specific) |
|------------------------|---------------------|
| ECS world, entity create/destroy, component CRUD | Component type definitions (Health, Position, MeleeAttack) |
| System registration, ordering, execution | System implementations (CombatSystem, AISystem) |
| Query API (`query(Position, Velocity)`) | Specific queries used in game systems |
| Turn manager (phases, scheduling, queue) | Turn phase hooks (pre-turn: tick poison, post-turn: regen) |
| Event bus (typed emit/subscribe) | Event type definitions (`DAMAGE_DEALT`, `ENTITY_DIED`) |
| Game state machine (state transitions, enter/exit) | State definitions (Loading, MainMenu, Playing, Paused, GameOver) |
| Entity builder/factory/registry (assembly pipeline) | JSON entity templates (`goblin.json`, `health-potion.json`) |
| Generation interface (contract: `(config, rng) → Grid`) | BSP algorithm implementation, enemy/item placement |
| Action pipeline (intent → validate → apply → result) | Action types (MoveAction, AttackAction), validators |
| Grid data structure (2D tile storage, spatial queries) | Tile type definitions (Wall, Floor, Door), walkability rules |
| Render system interface (sync ECS → display) | Sprite mappings, animation definitions, tileset configs |

### Module Structure

```
src/
├── engine/                    # Game-agnostic infrastructure
│   ├── ecs/
│   │   ├── world.ts           # Entity lifecycle, component storage, queries
│   │   ├── types.ts           # EntityId, Component, System, Query types
│   │   └── query.ts           # Query builder / archetype matching
│   ├── state-machine/
│   │   ├── state-machine.ts   # Generic FSM: states, transitions, enter/exit
│   │   └── types.ts           # State, Transition types
│   ├── turn/
│   │   ├── turn-manager.ts    # Turn phases, scheduling, queue management
│   │   └── types.ts           # TurnPhase, TurnAction types
│   ├── events/
│   │   ├── event-bus.ts       # Typed pub/sub, priority ordering
│   │   └── types.ts           # EventMap type, handler types
│   ├── entity/
│   │   ├── builder.ts         # Composable entity assembly from templates
│   │   ├── registry.ts        # Named template registry
│   │   └── factory.ts         # Stamp entities from registered templates
│   ├── generation/
│   │   └── types.ts           # GeneratorConfig, GeneratorResult, Generator interface
│   ├── grid/
│   │   ├── grid.ts            # 2D tile storage, spatial indexing
│   │   └── types.ts           # Tile, GridConfig, Position types
│   ├── action/
│   │   ├── pipeline.ts        # Intent → validate → apply → result
│   │   └── types.ts           # Action, ActionResult, Validator types
│   └── index.ts               # Public engine API surface
│
├── game/                      # Game-specific logic and content
│   ├── components/            # Component type definitions
│   │   ├── position.ts        # { x: number, y: number }
│   │   ├── health.ts          # { current: number, max: number }
│   │   ├── melee-attack.ts    # { damage: number }
│   │   ├── ai-behavior.ts     # { state: 'idle' | 'chasing', target?: EntityId }
│   │   ├── sprite.ts          # { key: string, tint?: number }
│   │   ├── fov.ts             # { radius: number, visible: Set<string> }
│   │   ├── item.ts            # { type: 'potion' | 'weapon', effect: ... }
│   │   ├── inventory.ts       # { items: EntityId[], capacity: number }
│   │   └── index.ts           # Component registry / enum
│   ├── systems/               # System implementations (functions)
│   │   ├── movement.ts        # Grid collision, bump-to-attack detection
│   │   ├── combat.ts          # Damage calc, death handling
│   │   ├── ai.ts              # FOV check → chase → attack behavior
│   │   ├── fov.ts             # rot-js shadowcasting, visibility states
│   │   ├── turn.ts            # Turn phase orchestration hooks
│   │   ├── item-pickup.ts     # Walk-over collection
│   │   └── status-effects.ts  # [Differentiator] Tick buffs/debuffs
│   ├── generation/
│   │   ├── bsp.ts             # BSP tree dungeon algorithm
│   │   ├── placement.ts       # Enemy, item, player spawn placement
│   │   └── config.ts          # Generation parameters
│   ├── entities/              # JSON entity templates
│   │   ├── player.json
│   │   ├── goblin.json
│   │   ├── rat.json
│   │   ├── health-potion.json
│   │   └── index.ts           # Loads + registers all templates
│   ├── actions/               # Game-specific action types + validators
│   │   ├── move.ts            # MoveAction definition + validation
│   │   ├── attack.ts          # AttackAction definition + validation
│   │   ├── pickup.ts          # PickupAction definition + validation
│   │   └── index.ts
│   ├── events/                # Game-specific event types
│   │   └── types.ts           # DAMAGE_DEALT, ENTITY_DIED, ITEM_PICKED_UP, etc.
│   ├── states/                # Game state definitions
│   │   ├── loading.ts         # Asset loading, entity registration
│   │   ├── main-menu.ts       # Menu display
│   │   ├── playing.ts         # Active gameplay (systems execute here)
│   │   ├── paused.ts          # Suspend input processing
│   │   └── game-over.ts       # Death screen, restart option
│   └── setup.ts               # Wire engine + game together (bootstrap)
│
├── rendering/                 # PixiJS rendering layer
│   ├── renderer.ts            # PixiJS Application lifecycle, canvas mount
│   ├── tile-renderer.ts       # @pixi/tilemap sync from grid data
│   ├── entity-renderer.ts     # Sync entity sprites with ECS Position/Sprite
│   ├── camera.ts              # Viewport centering on player, culling
│   ├── fov-renderer.ts        # Fog of war tinting (visible/explored/hidden)
│   ├── animation.ts           # [Differentiator] Tweens, sprite transitions
│   └── assets.ts              # Spritesheet loading, texture registry
│
├── network/                   # Client-server communication
│   ├── client.ts              # Action intent sender, response receiver
│   ├── optimistic.ts          # Predictive state application
│   ├── reconciliation.ts      # Compare predicted vs authoritative, snap/merge
│   └── types.ts               # ActionPayload, ServerResponse types
│
├── ui/                        # React UI layer
│   ├── stores/                # Zustand stores (vanilla API)
│   │   ├── player-store.ts    # Health, stats, position
│   │   ├── message-store.ts   # Message log entries
│   │   ├── game-state-store.ts# Current FSM state, loading progress
│   │   └── inventory-store.ts # Inventory contents for UI display
│   ├── components/            # React components
│   │   ├── GameCanvas.tsx     # Mounts PixiJS <canvas> via ref
│   │   ├── HUD.tsx            # Health bar, stats overlay
│   │   ├── MessageLog.tsx     # [Differentiator] Scrollable combat log
│   │   ├── MainMenu.tsx       # Start game button
│   │   └── GameOver.tsx       # Death/victory screen
│   └── hooks/                 # UI-specific hooks
│       └── use-game-input.ts  # Keyboard capture → action dispatch
│
├── server/                    # Next.js API route handlers
│   └── api/
│       └── action/
│           └── route.ts       # POST handler: validate action, return result
│
└── shared/                    # Types/contracts shared between client + server
    ├── action-types.ts        # Action discriminated union
    ├── validation.ts          # Zod schemas for action payloads
    └── game-state.ts          # Serializable state snapshot type
```

### The Engine Boundary Rule

**Engine code MUST NOT import from game, rendering, network, ui, or server.** Enforce this with:
- TypeScript path aliases scoped per directory
- ESLint `import/no-restricted-paths` rule
- Clear `index.ts` barrel exports defining the public API

```
engine/ → imports NOTHING from other src/ directories
game/   → imports from engine/
rendering/ → imports from engine/, game/ (for component types)
network/   → imports from shared/, engine/ (for action pipeline types)
ui/     → imports from ui/stores/ only (never from engine/ or game/ directly)
server/ → imports from shared/, engine/ (for validation logic)
```

The **game/setup.ts** bootstrap file is the wiring point — it creates the engine World, registers game components, instantiates game systems, configures the state machine, and hands the assembled game to the rendering and UI layers.

---

## Component Boundaries

### ECS Core

The ECS is the data backbone. Everything in the game world is an entity with components. Systems are stateless functions that operate on component sets.

```typescript
// Entity: just a number
type EntityId = number;

// Component: plain data object tagged with a type key
interface Component {
  readonly type: string;
}

// Example game component (defined in game/, not engine/)
interface Position extends Component {
  type: 'position';
  x: number;
  y: number;
}

// World: the ECS container
interface World {
  // Entity lifecycle
  createEntity(): EntityId;
  destroyEntity(id: EntityId): void;

  // Component CRUD
  addComponent<T extends Component>(entity: EntityId, component: T): void;
  removeComponent(entity: EntityId, type: string): void;
  getComponent<T extends Component>(entity: EntityId, type: string): T | undefined;
  hasComponent(entity: EntityId, type: string): boolean;

  // Queries — return entity sets matching component requirements
  query(...types: string[]): EntityId[];

  // Bulk operations for turn processing
  getEntitiesWith(...types: string[]): Array<{ entity: EntityId; components: Record<string, Component> }>;
}
```

**Storage strategy:** `Map<string, Map<EntityId, Component>>` — keyed by component type, then by entity ID. This gives O(1) component lookup and efficient iteration by component type. For queries matching multiple component types, intersect the entity sets. Cache query results and invalidate on component add/remove.

**Why not typed arrays (like bitECS)?** JSON composability requires heterogeneous component shapes. Typed arrays (SoA — Structure of Arrays) excel at cache-coherent iteration over thousands of uniform components (physics simulations), but this is a turn-based game processing ~50-200 entities per turn. The priority is developer ergonomics and JSON-driven entity composition, not cache-line optimization.

### Game State Machine

Controls application flow. Each state defines which systems execute.

```
                ┌──────────┐
                │ Loading  │ (load assets, register entities)
                └────┬─────┘
                     │ assets loaded
                     ▼
              ┌────────────┐
              │ Main Menu  │ (render menu, wait for start)
              └──────┬─────┘
                     │ start game
                     ▼
              ┌────────────┐◄────── unpause
              │  Playing   │ (all game systems active)
              └──┬───┬───┬─┘
       pause     │   │   │ player dies
        ┌────────┘   │   └──────────┐
        ▼            │              ▼
  ┌──────────┐       │      ┌────────────┐
  │  Paused  │       │      │ Game Over  │
  └──────────┘       │      └──────┬─────┘
                     │             │ restart
                     │             ▼
                     │      (back to Loading or Main Menu)
                     │
                     │ [future: stairs]
                     ▼
              ┌──────────────┐
              │ [Level Trans]│ (generate new floor — future)
              └──────────────┘
```

**State → active systems mapping:**

| State | Active Systems |
|-------|----------------|
| Loading | Asset loader only |
| MainMenu | Render system (menu background), input (menu navigation) |
| Playing | ALL game systems: input, turn manager, movement, combat, AI, FOV, rendering, UI bridge |
| Paused | Render system (frozen frame), input (unpause only), UI (pause menu) |
| GameOver | Render system (frozen frame), UI (game-over screen), input (restart) |

### Turn Manager

The turn manager orchestrates discrete game updates. Nothing changes until the player acts.

```
Player Input
     ↓
┌─────────────────┐
│ PRE-TURN PHASE  │  Tick status effects (poison damage, buff duration)
│                 │  Decrement cooldowns
└────────┬────────┘
         ↓
┌─────────────────┐
│ PLAYER ACTION   │  Process the player's action (move, attack, pickup, use item)
│                 │  Optimistic apply → send to server
└────────┬────────┘
         ↓
┌─────────────────┐
│ ENEMY TURNS     │  For each enemy (in turn-order):
│                 │    AI decision → action → apply
│                 │    (All enemy actions are server-authoritative too,
│                 │     but generated server-side, no optimistic prediction)
└────────┬────────┘
         ↓
┌─────────────────┐
│ POST-TURN PHASE │  Resolve deferred effects
│                 │  Clean up dead entities
│                 │  Update FOV
│                 │  Sync UI stores
│                 │  Trigger animations
└────────┬────────┘
         ↓
┌─────────────────┐
│ AWAIT INPUT     │  Render final state
│                 │  Wait for next player input
│                 │  (Game is frozen until player acts)
└─────────────────┘
```

**Turn ordering (v1: round-robin):** Player always acts first. Then all enemies act in entity-creation order. Simple, predictable, debuggable.

**Turn ordering (differentiator: energy system):** Each entity has `energy` and `speed` components. Each tick, all entities gain `energy += speed`. When `energy >= 100`, entity takes a turn and `energy -= 100`. A fast rat (speed: 150) acts roughly 1.5x per player turn. Queue sorted by energy, ties broken by entity ID.

### Event Bus

Decouples systems that need to react to game events without direct dependencies.

```
┌──────────────┐    DAMAGE_DEALT     ┌─────────────────┐
│ CombatSystem ├────────────────────►│ MessageLogSystem │  "You hit Goblin for 5"
│              ├────────────────────►│ UIBridgeSystem   │  Update health bar
│              ├────────────────────►│ AnimationSystem  │  Flash sprite red
└──────────────┘                     └─────────────────┘

┌──────────────┐    ENTITY_DIED      ┌─────────────────┐
│ HealthSystem ├────────────────────►│ CleanupSystem    │  Remove from grid, destroy entity
│              ├────────────────────►│ LootSystem       │  Drop items on ground
│              ├────────────────────►│ RenderSystem     │  Remove PixiJS display object
│              ├────────────────────►│ UIBridgeSystem   │  "The Goblin dies!"
└──────────────┘                     └─────────────────┘
```

**Events are data, not commands.** They describe what happened, not what should happen. Systems subscribe and decide how to react. This keeps event producers ignorant of consumers.

**Events are synchronous within a turn.** Emit during system execution, handlers run immediately inline. No deferred/async event queue needed for turn-based — everything resolves within the turn before rendering.

### Dungeon Generation Pipeline

The engine defines the **interface**. The game provides the **implementation**.

```
                    ┌─────────────────────┐
                    │  GeneratorConfig     │
                    │  - width, height     │
                    │  - roomSize range    │
                    │  - corridorWidth     │
                    │  - seed (number)     │
                    └─────────┬───────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Generator Interface          │
              │  generate(config, rng): Grid  │
              │                               │
              │  (engine defines contract,    │
              │   game implements algorithm)  │
              └───────────────┬───────────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                 ▼
      ┌──────────┐    ┌──────────────┐   ┌──────────┐
      │ BSP (v1) │    │ [Cellular]   │   │ [WFC]    │
      └────┬─────┘    └──────────────┘   └──────────┘
           │
           ▼
    ┌──────────────┐
    │ Raw Grid     │  Walls, floors, doors, corridors
    │ (terrain)    │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Placement    │  Player start, enemy spawns, item positions
    │ (entities)   │  Uses spawn rules: enemies not in player's starting room,
    └──────┬───────┘  items distributed across rooms, stairs in farthest room
           │
           ▼
    ┌──────────────┐
    │ Populated    │  Grid + entity list ready for ECS instantiation
    │ World Data   │
    └──────────────┘
```

**Separation:** Generation outputs raw data (grid tiles + entity spawn descriptors). The game's setup code reads this data and uses the Entity Builder to create actual ECS entities. The generator never touches the ECS directly.

### Action Pipeline (Client-Server Authority)

Every player action follows the same pipeline. This is the architectural centerpiece.

```typescript
// Shared action type (lives in shared/)
type GameAction =
  | { type: 'move'; direction: 'north' | 'south' | 'east' | 'west' }
  | { type: 'attack'; targetId: EntityId }
  | { type: 'pickup'; itemId: EntityId }
  | { type: 'use_item'; itemId: EntityId };

// Shared result type
interface ActionResult {
  ok: boolean;
  action: GameAction;
  stateSnapshot: SerializableGameState;  // Authoritative state after action
  events: GameEvent[];                    // Events that occurred (for message log, animations)
  error?: string;                         // Why rejected, if !ok
}
```

**The complete flow for a player action:**

```
1. PLAYER PRESSES KEY
   Input system captures keydown → maps to semantic action → emits action intent

2. CLIENT-SIDE OPTIMISTIC APPLY
   ├── Save current state as rollback point (snapshot or clone affected components)
   ├── Apply action locally as if server approved (move sprite, deal damage)
   ├── Render the predicted state immediately (no visible latency)
   └── Send action to server: POST /api/action { action, gameId }

3. SERVER VALIDATES (Next.js API route)
   ├── Load authoritative game state (from server-side store / session)
   ├── Validate preconditions:
   │   ├── Is it the player's turn?
   │   ├── Is the action legal? (tile walkable? target in range? item exists?)
   │   └── Does the player have resources? (enough HP to be alive, item in inventory)
   ├── If invalid: return { ok: false, error, stateSnapshot }
   ├── If valid:
   │   ├── Apply action to authoritative state
   │   ├── Process consequences (enemy dies, item consumed, triggers)
   │   ├── Run enemy turns (server-side AI)
   │   ├── Return { ok: true, stateSnapshot, events }

4. CLIENT RECEIVES RESPONSE
   ├── If ok && predicted state matches authoritative: discard rollback, continue
   ├── If ok && state diverged: snap to authoritative state (re-render)
   ├── If !ok: rollback to saved state, show error feedback
   └── Apply events (message log, animations for enemy actions)
```

**Why full-state-replace for v1:** The game state is small (grid + ~50-200 entities with simple components). Sending the full relevant state slice (~10-50KB JSON) per turn is negligible over HTTP. Delta-based reconciliation adds complexity that isn't justified until state grows significantly. Full-state-replace also makes debugging trivial — every server response is a complete, inspectable snapshot.

**Server-side state storage (v1):** Use Next.js server-side in-memory state, keyed by a session/game ID. Stateless API routes load the game state from a Map, validate, mutate, save back. No database needed for v1. The state lives in server memory and is lost on restart — acceptable for a tech demo.

```typescript
// Server-side: simplified
const games = new Map<string, AuthoritativeGameState>();

export async function POST(req: Request) {
  const { gameId, action } = await req.json();  // Validated with Zod
  const state = games.get(gameId);
  if (!state) return Response.json({ ok: false, error: 'Game not found' }, { status: 404 });

  const result = processAction(state, action);  // Validate + apply + enemy turns
  if (result.ok) {
    games.set(gameId, result.newState);
  }
  return Response.json(result.toClientResponse());
}
```

### Rendering Architecture

PixiJS owns the canvas. React owns the DOM. They never cross.

```
┌──────────────────────────────────────────────────────┐
│  Browser Viewport                                     │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │  <canvas> — PixiJS Application                  │  │
│  │                                                  │  │
│  │  Application.stage                               │  │
│  │  ├── worldContainer (scrolls with camera)        │  │
│  │  │   ├── terrainLayer (CompositeTilemap)         │  │
│  │  │   │   └── floor, wall, door tiles             │  │
│  │  │   ├── itemLayer (Container)                   │  │
│  │  │   │   └── item sprites                        │  │
│  │  │   ├── entityLayer (Container)                 │  │
│  │  │   │   └── player, enemy sprites               │  │
│  │  │   ├── effectLayer (Container)                 │  │
│  │  │   │   └── particles, hit flashes              │  │
│  │  │   └── fogLayer (Container or alpha mask)      │  │
│  │  │       └── fog of war overlay                  │  │
│  │  └── uiContainer (fixed, optional canvas UI)     │  │
│  │      └── (reserved for future canvas-based UI)   │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │  <div> — React DOM Overlay (positioned above)   │  │
│  │  ├── <HUD /> health, stats                      │  │
│  │  ├── <MessageLog /> combat log                  │  │
│  │  ├── <Inventory /> item list                    │  │
│  │  └── <MainMenu /> / <GameOver /> / <Paused />   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Render sync pattern:** After each turn resolves, the render systems run:

1. **TileRenderSystem** — Reads grid data, updates CompositeTilemap for any changed tiles
2. **FOVRenderSystem** — Applies visibility tinting (full alpha for visible, dimmed for explored, black/hidden for unexplored)
3. **EntityRenderSystem** — For each entity with Position + Sprite components: create/update/destroy PixiJS Sprite, set position to `(gridX * tileSize, gridY * tileSize)`
4. **CameraSystem** — Set `worldContainer.position` so player entity is at viewport center
5. **[AnimationSystem]** — Queue tweens for movement, attacks; gate input until animations complete

**PixiJS display object lifecycle:** The render system maintains a `Map<EntityId, Sprite>` mapping ECS entities to PixiJS display objects. When entities are created/destroyed in the ECS, the render system creates/removes corresponding sprites. The ECS is the source of truth — PixiJS objects are projections.

**Canvas mounting:** A React `GameCanvas` component renders a `<div ref={canvasRef}>` and, on mount, creates the PixiJS `Application`, initializes it, and appends the canvas. On unmount, it calls `app.destroy()`. This is the **only** React-PixiJS touchpoint.

### UI Integration Layer

```
ECS World                    Zustand Stores              React Components
┌──────────┐                ┌──────────────┐            ┌──────────────┐
│ Health   │◄──UIBridge────►│ playerStore   │◄──subscribe─│ <HUD />     │
│ Position │   System       │ { hp, maxHp } │            │              │
│ Inventory│   (runs post- │               │            │              │
│ ...      │    turn)       │ messageStore  │◄──subscribe─│ <MessageLog/>│
└──────────┘                │ { messages[] }│            │              │
                            │               │            │              │
                            │ gameStore     │◄──subscribe─│ <MainMenu /> │
                            │ { state }     │            │ <GameOver /> │
                            └──────────────┘            └──────────────┘
```

**Data flow is strictly unidirectional:**
- **Engine → Zustand → React** for display (game state to UI)
- **React → Input System → Engine** for player actions (UI events to game)
- React components **never** read from the ECS directly
- Game systems **never** import React or use hooks

**UIBridgeSystem** runs in the post-turn phase. It queries relevant ECS data and calls `store.setState()` on Zustand stores. Because Zustand uses vanilla stores (not React hooks), the engine can write to stores without any React dependency.

```typescript
// UIBridgeSystem — runs in game/, accesses engine ECS + zustand stores
function uiBridgeSystem(world: World): void {
  const player = world.query('player', 'health')[0];
  if (player) {
    const health = world.getComponent<Health>(player, 'health');
    playerStore.setState({ hp: health.current, maxHp: health.max });
  }
}
```

### Input Pipeline

```
Browser keydown event
       ↓
  Input Handler (captures key, suppresses browser defaults)
       ↓
  Action Map lookup: key → semantic action (e.g., ArrowUp → MOVE_NORTH)
       ↓
  Input Gate check: is input accepted? (blocked during animations, enemy turns, non-Playing states)
       ↓
  Dispatch action intent to Turn Manager
       ↓
  Turn Manager begins new turn with player action
```

**Input lives in the UI layer** (it captures DOM events), but the action map and gating logic live in the game layer. Input is captured by a React hook or event listener, translated to a game action, and handed to the game layer for processing.

---

## Data Flow Summary

### Per-Turn Data Flow (Happy Path)

```
1. Player presses 'w'
2. Input handler maps 'w' → { type: 'move', direction: 'north' }
3. Input gate: state is Playing, no animation running → allow
4. Turn Manager begins turn:
   a. PRE-TURN: StatusEffectSystem ticks poison, buffs
   b. PLAYER ACTION:
      - Optimistic: MovementSystem applies move locally
      - Network: POST /api/action { type: 'move', direction: 'north' }
   c. ENEMY TURNS: (awaiting server — enemies act server-side in v1)
   d. POST-TURN:
      - Server response arrives with authoritative state + enemy actions
      - Reconciliation: compare, snap if diverged
      - FOVSystem updates visibility
      - CleanupSystem removes dead entities
      - UIBridgeSystem syncs Zustand stores
5. Render systems run:
   - TileRenderSystem updates changed tiles
   - EntityRenderSystem moves/creates/destroys sprites
   - FOVRenderSystem applies fog of war
   - CameraSystem centers on player
   - [AnimationSystem queues tweens]
6. React re-renders HUD (health updated), MessageLog (new messages)
7. Await next input
```

### Enemy Turn Processing (v1 approach)

In v1, enemy turns run **server-side** during the action validation request. When the player sends an action:

1. Server validates and applies player action
2. Server runs AI for all enemies (chase, attack, idle)
3. Server returns the complete post-turn state including all enemy movements and attacks
4. Client receives state, reconciles, and renders all changes at once

This simplifies the client — it doesn't need to run AI locally — and ensures enemy actions are authoritative. The tradeoff is that all enemy actions appear simultaneously on the client rather than one-by-one. Animation systems can stagger the visual playback of enemy actions for better UX.

---

## Patterns to Follow

### Pattern 1: Component as Plain Data, System as Pure Function

**What:** Components are inert data objects. Systems are functions that query components from the World and mutate them. No methods on components. No inheritance.

**When:** Always. This is the core ECS pattern.

**Why:** JSON composability. If components have methods or inheritance, they can't be defined in JSON and assembled at runtime. Plain data objects are trivially serializable (needed for server sync), testable (pass data in, assert data out), and composable (slap any combination of components on any entity).

```typescript
// Component: pure data
const health: Health = { type: 'health', current: 10, max: 10 };
const position: Position = { type: 'position', x: 5, y: 3 };

// System: pure function operating on World
function movementSystem(world: World, action: MoveAction): void {
  const [player] = world.query('player', 'position');
  const pos = world.getComponent<Position>(player, 'position');
  const newPos = applyDirection(pos, action.direction);

  if (isWalkable(world, newPos)) {
    pos.x = newPos.x;
    pos.y = newPos.y;
  }
}
```

### Pattern 2: Entity Template Composition

**What:** Entity archetypes defined in JSON, assembled at runtime via builder pattern.

**When:** Every entity type — player, enemies, items, terrain features.

```json
// entities/goblin.json
{
  "name": "goblin",
  "components": {
    "position": { "x": 0, "y": 0 },
    "health": { "current": 8, "max": 8 },
    "melee_attack": { "damage": 3 },
    "sprite": { "key": "goblin_idle" },
    "ai_behavior": { "state": "idle" },
    "fov": { "radius": 6 },
    "blocks_movement": true
  }
}
```

```typescript
// Builder assembles: parse JSON → validate with Zod → create entity → add components
const goblin = entityFactory.create('goblin', { position: { x: 10, y: 5 } });
// Override defaults: position set to spawn point, everything else from template
```

### Pattern 3: System Execution Order

**What:** Systems run in a fixed, explicit order each turn. No implicit ordering.

**When:** Every turn. Order matters — FOV must run after movement so visibility reflects the new position.

```typescript
// Defined in game/setup.ts — the game decides order, not the engine
const systemOrder = [
  // Pre-turn
  statusEffectSystem,     // Tick poison, buffs before action
  // Player action
  movementSystem,         // Move (or detect bump-to-attack)
  combatSystem,           // Resolve attacks
  itemPickupSystem,       // Check for items at new position
  // Enemy turns
  aiSystem,               // Each enemy: decide + act
  // Post-turn
  deathSystem,            // Remove dead entities, emit events
  fovSystem,              // Recalculate visibility
  uiBridgeSystem,         // Sync ECS → Zustand
];
```

### Pattern 4: State Snapshot for Optimistic Rollback

**What:** Before applying an action optimistically, save a snapshot of the state that will be affected. If the server rejects, restore the snapshot.

**When:** Every player action in the optimistic pipeline.

```typescript
function applyOptimistic(world: World, action: GameAction) {
  // Snapshot only affected entities/components (not the entire world)
  const snapshot = captureRelevantState(world, action);

  // Apply optimistically
  applyAction(world, action);

  // Return rollback function
  return {
    rollback: () => restoreState(world, snapshot),
    snapshot,
  };
}
```

**For v1 full-state-replace:** The server returns the complete state after each action. The client doesn't need fine-grained rollback — it replaces its entire game state with the server snapshot. The optimistic apply just provides instant visual feedback while the request is in flight.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: God System

**What:** A single system that handles movement, combat, AI, and rendering all in one function.

**Why bad:** Untestable, impossible to reorder, violates ECS principles. Combat logic shouldn't know about rendering. Movement shouldn't know about AI.

**Instead:** One system per concern. Movement checks walkability and moves. Combat calculates damage and applies it. Death cleans up. Rendering syncs display objects. Each system is testable in isolation with mocked World data.

### Anti-Pattern 2: React Rendering the Game

**What:** Using React's reconciler (or @pixi/react) to manage game scene objects (tiles, entities, particles).

**Why bad:** React reconciliation is designed for UI trees, not game scenes. Re-rendering 5000 tiles through React's diffing algorithm is orders of magnitude slower than PixiJS's batched GPU rendering. React re-renders propagate through the component tree; PixiJS display objects are direct-manipulated.

**Instead:** PixiJS Application mounts independently to a canvas. ECS render systems directly create/update/destroy PixiJS display objects. React handles only DOM-based UI (HUD, menus, inventory panels) overlaid on top of the canvas.

### Anti-Pattern 3: Two-Way Data Binding Between ECS and UI

**What:** Zustand stores that both read from and write to ECS state, or React components that directly mutate ECS components.

**Why bad:** Creates circular dependencies and race conditions. If the UI can mutate game state and the game can mutate UI state, you lose track of the source of truth. Debugging becomes a nightmare.

**Instead:** Strict unidirectional flow. ECS → UIBridge → Zustand → React (for display). React → InputSystem → TurnManager → ECS (for actions). The ECS is always the source of truth for game state. Zustand stores are read-only projections.

### Anti-Pattern 4: Game Logic in API Routes

**What:** Putting combat formulas, AI behavior, or dungeon generation directly in Next.js API route handlers.

**Why bad:** Duplicates logic between client (for optimistic apply) and server. Makes game logic untestable without HTTP requests. Couples game rules to a web framework.

**Instead:** Game logic lives in `game/systems/` as pure functions that operate on game state. API routes are thin handlers that: deserialize the request, load state, call the game logic functions, serialize the response. The same system functions run on both client (optimistic) and server (authoritative).

### Anti-Pattern 5: Entity Classes with Inheritance

**What:** `class Goblin extends Enemy extends Entity` with methods like `goblin.attack(player)`.

**Why bad:** Destroys composability. What is a "poison goblin that can also be picked up as an item"? Multiple inheritance doesn't work, and deep class hierarchies are rigid. Can't define entities in JSON if behavior lives in class methods.

**Instead:** Entities are IDs. Components are data. A poison goblin is: `Entity + Position + Health + MeleeAttack + AIBehavior + PoisonOnHit`. Behavior emerges from which systems process which component combinations. New entity types = new JSON files, not new classes.

---

## Scalability Considerations

| Concern | V1 Tech Demo (~60s play) | Future (~1hr runs) | Future (real-time upgrade) |
|---------|--------------------------|---------------------|---------------------------|
| **Entity count** | ~50-200 entities | ~500-1000 entities | ~1000+ entities |
| **ECS storage** | Map<string, Map> is fine | Profile query performance; consider archetype storage if slow | Typed arrays (SoA) for hot-path systems |
| **State sync** | Full-state-replace per turn (~10-50KB) | Delta updates for large states | WebSocket with binary protocol |
| **Server storage** | In-memory Map | Server-side sessions or Redis | Dedicated game server process |
| **Rendering** | @pixi/tilemap handles grid | Chunk-based loading for large maps | Camera-frustum culling, LOD |
| **Generation** | BSP runs once, <100ms | Pre-generate on server, stream to client | Background worker thread |
| **AI pathfinding** | A* per enemy per turn, fine at <50 enemies | Dijkstra maps (compute once, all enemies read) | Hierarchical pathfinding |
| **Turn processing** | Synchronous, <16ms total | Profile; move expensive systems to post-turn async | Tick-based with fixed time step |

---

## Suggested Build Order

The build order follows the dependency chain identified in FEATURES.md, organized into phases that deliver testable milestones.

### Phase 1: Foundation (no rendering, no network)

Build and test the data layer in isolation. Every test is a unit test — no browser, no canvas.

1. **ECS Core** — World, entity lifecycle, component CRUD, queries
2. **Event Bus** — Typed pub/sub (introduced early, adopted incrementally)
3. **Grid data structure** — 2D tile storage, walkability queries, spatial indexing
4. **Entity Builder/Registry/Factory** — JSON template parsing, Zod validation, entity assembly
5. **Game State Machine** — FSM with state transitions, enter/exit hooks

**Testable milestone:** Create a World, load entity templates from JSON, stamp entities onto a grid, query entities by components, transition between game states. All in Vitest, no DOM needed.

### Phase 2: Game Loop (terminal/console testable)

Build the turn-based game loop. Test by logging state changes — still no rendering.

6. **Turn Manager** — Turn phases, scheduling, await-input state
7. **Movement System** — Grid collision, bump detection
8. **Combat System (basic)** — Attack resolution, death handling
9. **FOV System** — rot-js shadowcasting, visibility states on tiles
10. **AI System** — FOV-aware chase/attack, rot-js pathfinding

**Testable milestone:** Simulate a full combat encounter in tests. Player moves, hits goblin, goblin chases back, goblin dies. All state transitions verifiable in pure data — no rendering.

### Phase 3: Rendering

Connect the data layer to visual output.

11. **PixiJS Application lifecycle** — Canvas mount, asset loading, ticker
12. **Tile Rendering** — @pixi/tilemap from grid data
13. **Entity Rendering** — Sprite sync from ECS Position + Sprite components
14. **Camera System** — Center on player, viewport culling
15. **FOV Rendering** — Fog of war tinting

**Testable milestone:** Visual dungeon with player and enemies. Player moves with keyboard, can see FOV, entities render at correct positions.

### Phase 4: Input + UI

16. **Input System** — Keyboard capture, action mapping, input gating
17. **Zustand stores** — Player, message, game state stores
18. **UIBridgeSystem** — Post-turn ECS → Zustand sync
19. **HUD** — Health bar, basic stats
20. **Message Log** — Combat messages

**Testable milestone:** Fully playable local game. Move, fight, see health, read combat log. Everything runs client-side only.

### Phase 5: Dungeon Generation

21. **BSP Algorithm** — Room carving, corridor placement
22. **Placement System** — Player, enemy, item spawns
23. **Generation Config** — Parameterized generation

**Testable milestone:** Each game starts with a randomly generated dungeon. Rooms, corridors, enemies, items.

**Why generation is Phase 5, not Phase 1:** Hardcode a small test map (5x5 room) during Phases 1-4. This removes generation as a variable while debugging ECS, combat, rendering, and UI. Once those systems are proven, swap in real generation. Debugging a combat bug is much harder when you're also unsure if the dungeon generated correctly.

### Phase 6: Server Authority

24. **Shared types** — Action types, Zod schemas, state snapshot format
25. **Next.js API route** — Action validation endpoint
26. **Server-side game state** — In-memory authoritative state
27. **Optimistic client** — Predict + rollback infrastructure
28. **State reconciliation** — Compare + snap to server state
29. **Server-side AI** — Enemy turns run on server

**Testable milestone:** Game plays identically but all actions round-trip through the server. Open browser dev tools — every action is a POST, every response contains authoritative state. Client reconciles seamlessly.

**Why network is Phase 6, not Phase 1:** Building network before the game works locally adds complexity to every debugging session. Get the game working purely client-side first, then layer in the authority model. The action pipeline pattern (intent → validate → apply → result) should be coded from Phase 2, but validation runs locally. Phase 6 moves the validation to the server.

### Phase 7: Polish + Differentiators

30. **Animation/Tween System** — Movement lerp, attack flash
31. **Energy/Speed System** — Weighted turn ordering
32. **Item Pickup + Inventory** — Walk-over collect, inventory UI

**Testable milestone:** Tech demo complete. 60-second dungeon run with all systems functioning, server-authoritative, animated, polished.

### Cross-Cutting Concerns (Woven in Throughout)

- **TypeScript strict mode** — Enable from day 1
- **Vitest tests** — Write alongside each system, not after
- **ESLint import boundaries** — Enforce engine/game separation from Phase 1
- **Debug tooling** — Build incrementally; entity inspector when ECS exists, FOV overlay when FOV exists

---

## Sources

- ECS architecture patterns: Training data synthesis of established game engine patterns (bitECS, Bevy, Unity DOTS concepts adapted for lightweight TS). HIGH confidence — patterns are well-established and stable.
- Turn-based roguelike game loop: Traditional roguelike development resources (RogueBasin, IRDC talks, Cogmind devlogs). HIGH confidence — these patterns haven't changed in decades.
- Optimistic client with server reconciliation: Established multiplayer networking pattern (Valve Source, Gabriel Gambetta articles). Adapted for turn-based HTTP request/response. HIGH confidence for the pattern; MEDIUM confidence for the HTTP-specific adaptation (most literature assumes WebSocket).
- PixiJS scene graph structure: PixiJS v8 documentation (Container, Sprite, CompositeTilemap hierarchy). HIGH confidence via STACK.md research.
- Zustand vanilla store API: Verified in STACK.md research. HIGH confidence.
- Next.js API routes for game state: Standard Next.js App Router patterns. HIGH confidence for the routing; MEDIUM confidence for in-memory game state management at scale (fine for tech demo).
- rot-js algorithmic capabilities (FOV, pathfinding, RNG): Verified in STACK.md research. HIGH confidence.
