# Phase 2: Game Loop & Player Control - Research

**Researched:** 2026-03-13
**Domain:** Generic FSM, energy-based turn system, keyboard input handling, grid movement with collision, game bootstrap wiring
**Confidence:** HIGH

## Summary

Phase 2 builds the game's behavioral backbone on top of Phase 1's data layer — a generic state machine, energy-based turn manager, keyboard input system, and movement with collision detection. All code is pure TypeScript except the input system (which uses browser `KeyboardEvent` API). No external libraries are required — everything builds on the Phase 1 ECS, EventBus, and Grid.

The user's CONTEXT.md locks the most architecturally significant decisions: accumulate-to-threshold energy model (threshold 1000, baseline speed 100), interleaved turns with player-first tiebreak, automatic bump-to-attack with hostility flags, and variable energy costs per action type. Claude has discretion over FSM implementation details, input system architecture, movement collision approach, and bootstrap wiring.

The primary risk is Pitfall 6 (state machine explosion) and Pitfall 11 (turn ordering bugs). Both are mitigated by keeping the top-level FSM to exactly 5 states and establishing strict turn phase ordering as a tested contract.

**Primary recommendation:** Build FSM as a generic reusable engine module, then turn manager with energy system, then input + movement as game-layer systems. Wire everything together in `game/setup.ts`. Test the turn cycle exhaustively — it's the most bug-prone component in this phase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Turn Pacing & Energy Model**: Accumulate-to-threshold energy system. Threshold 1000, baseline speed 100. Every tick, all actors gain energy = speed. When energy ≥ 1000, actor can act. Variable energy cost per action type. Interleaved turns — one action per actor per tick. Player waits like any other actor. Player-first tiebreak, then entity ID. Wait action with reduced energy cost.
- **Bump-to-Attack Detection**: Automatic — moving into an occupied enemy tile triggers melee attack immediately, no confirmation. Same energy cost as standard attack. Player stays in place after bump-attack. Hostility flag determines bump behavior — only hostile entities trigger bump-attack; non-hostile entities block movement.

### Claude's Discretion
- State machine implementation details (state object shape, transition table structure)
- Input system architecture (event listener management, action mapping data structure)
- Movement system collision checking approach
- Game bootstrap wiring pattern in setup.ts
- System registration and ordering details within FSM-controlled phases

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FSM-01 | Generic FSM with states, transitions, enter/exit hooks | Generic `StateMachine<TState>` class in engine layer; transition table pattern with enter/exit callbacks |
| FSM-02 | 5 game states: Loading, MainMenu, Playing, Paused, GameOver | Game layer defines state configs registered with engine FSM; 7 valid transitions defined |
| FSM-03 | Each state defines which systems execute | State config includes `activePhases` array; `executeSystems()` checks FSM for which phases to run |
| FSM-04 | State transitions are validated (only defined transitions allowed) | Transition table lookup; `transition()` returns false or throws on invalid transition |
| TURN-01 | Turn phases: pre-turn → player action → enemy turns → post-turn → await input | TurnManager orchestrates explicit phase sequence; maps to engine system phases |
| TURN-02 | Nothing changes until the player acts | Game loop frozen at AWAIT_INPUT phase; no ticks, no energy accumulation, no enemy actions until player provides input |
| TURN-03 | Enemy turn order is deterministic (sorted by entity ID) | Ready actors sorted: player first, then ascending entity ID for enemies |
| TURN-04 | Dead entities skipped during enemy turn processing | `isAlive()` check before each enemy's action; skip dead with no side effects |
| TURN-05 | Energy/speed system determines turn frequency | Accumulate-to-threshold model per CONTEXT.md decisions; fast entities (speed > 100) act more than once per player turn |
| TURN-06 | Input is gated during turn processing and animations | `canAcceptInput()` flag controlled by turn manager; false during turn processing, true at AWAIT_INPUT |
| MOV-01 | Cardinal movement (4-directional) | Direction enum with dx/dy deltas: N(0,-1), S(0,1), E(1,0), W(-1,0) |
| MOV-02 | Movement checks walkability and entity occupancy | `grid.isWalkable(x,y)` + `grid.getEntitiesAt(x,y)` checks before applying position change |
| MOV-03 | Moving into enemy tile triggers combat (bump-to-attack) | Check occupants for `Hostile` component; emit bump-attack event instead of moving |
| INP-01 | Keyboard events map to semantic actions | `InputManager` with `Map<string, GameAction>` using `event.code` for layout-independent binding |
| INP-02 | Action map is rebindable | `rebind(keyCode, action)` method on InputManager; action map is a mutable `Map` |
| INP-03 | Browser defaults suppressed (arrow key scrolling) | `event.preventDefault()` for all mapped keys in the keydown handler |
| ARCH-03 | game/setup.ts is sole wiring point | Single `createGame()` function that instantiates engine, registers game components/systems/states, wires input→turn manager |
</phase_requirements>

## Standard Stack

### Core (Phase 2 — Mostly Pure TypeScript)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | All Phase 2 code | Strict mode, type-safe FSM generics |
| Vitest | ^4.1.0 | Unit/integration testing | Pure logic testing for FSM, turn manager, movement; jsdom environment for input system tests |

### Phase 1 Dependencies (Internal — Not Installed)

| Module | Import Path | What Phase 2 Uses |
|--------|-------------|-------------------|
| World | `@engine/ecs/world` | Entity/component queries, system registration, system execution |
| EventBus | `@engine/events/event-bus` | Emit turn events, bump-attack events; subscribe for death cleanup |
| Grid | `@engine/grid/grid` | Walkability checks, entity-at-position lookups, moveEntity |
| ComponentDef/defineComponent | `@engine/ecs/types` | Define new Phase 2 components (Energy, Speed, Hostile, etc.) |
| EntityId, SystemFn, Phase | `@engine/ecs/types` | Type references throughout |
| Position | `@game/components/position` | Movement system reads/writes Position component |
| Health | `@game/components/health` | Dead entity check in turn manager |

### Not Needed in Phase 2

| Library | Why Not |
|---------|---------|
| PixiJS | No rendering; Phase 3 |
| rot-js | No FOV, pathfinding, or RNG needed; Phase 4 |
| React | No UI; Phase 6 |
| zustand | No UI state bridge; Phase 6 |
| happy-dom | Vitest's built-in jsdom mode sufficient for KeyboardEvent tests |

### Browser APIs Used

| API | Where | Purpose |
|-----|-------|---------|
| `document.addEventListener('keydown', ...)` | InputManager | Capture keyboard input |
| `document.removeEventListener(...)` | InputManager | Cleanup on disable |
| `KeyboardEvent.code` | InputManager | Layout-independent key identification |
| `KeyboardEvent.preventDefault()` | InputManager | Suppress browser scroll on arrow keys |

## Architecture Patterns

### Recommended Project Structure (Phase 2 Additions)

```
src/
├── engine/
│   ├── ecs/                   # (Phase 1 — exists)
│   ├── events/                # (Phase 1 — exists)
│   ├── grid/                  # (Phase 1 — exists)
│   ├── entity/                # (Phase 1 — exists)
│   ├── state-machine/         # NEW — generic FSM
│   │   ├── state-machine.ts   # StateMachine<TState> class
│   │   └── types.ts           # StateConfig, TransitionMap types
│   ├── turn/                  # NEW — turn orchestration
│   │   ├── turn-manager.ts    # TurnManager with energy system
│   │   └── types.ts           # TurnPhase, ActorSchedule types
│   └── index.ts               # Updated barrel export
│
├── game/
│   ├── components/            # (Phase 1 — exists, extended)
│   │   ├── position.ts        # (Phase 1)
│   │   ├── health.ts          # (Phase 1)
│   │   ├── energy.ts          # NEW — { current: number, speed: number }
│   │   ├── actor.ts           # NEW — { isPlayer: boolean }
│   │   ├── hostile.ts         # NEW — { } (marker component)
│   │   ├── blocks-movement.ts # NEW — { } (marker component)
│   │   └── index.ts           # Updated exports
│   ├── systems/               # NEW — game systems
│   │   ├── movement.ts        # Cardinal movement + collision + bump-to-attack
│   │   └── index.ts
│   ├── input/                 # NEW — input handling
│   │   ├── input-manager.ts   # Keyboard → action mapping
│   │   ├── actions.ts         # GameAction enum, default key bindings
│   │   └── types.ts           # InputHandler, ActionMap types
│   ├── states/                # NEW — game state definitions
│   │   ├── game-states.ts     # Loading, MainMenu, Playing, Paused, GameOver configs
│   │   └── types.ts           # GameState enum
│   ├── events/                # (Phase 1 — exists, extended)
│   │   └── types.ts           # Add TURN_START, TURN_END, BUMP_ATTACK, etc.
│   ├── entities/              # (Phase 1 — exists)
│   └── setup.ts               # NEW — sole bootstrap wiring point (ARCH-03)
```

### Pattern 1: Generic Finite State Machine

**What:** A reusable `StateMachine<TState>` class in the engine layer that manages state transitions with enter/exit hooks and transition validation. Game-agnostic — knows nothing about Loading, Playing, etc.

**When to use:** Any system needing validated state transitions (game states, AI behavior states in future phases).

```typescript
// Engine layer — src/engine/state-machine/types.ts
interface StateConfig<TState extends string, TContext = void> {
  onEnter?: (context: TContext) => void;
  onExit?: (context: TContext) => void;
}

// src/engine/state-machine/state-machine.ts
class StateMachine<TState extends string, TContext = void> {
  private currentState: TState;
  private states: Map<TState, StateConfig<TState, TContext>>;
  private transitions: Map<TState, Set<TState>>;  // from → allowed-to set

  constructor(
    initialState: TState,
    stateConfigs: Record<TState, StateConfig<TState, TContext>>,
    transitionTable: Array<[TState, TState]>, // [from, to] pairs
    private context?: TContext
  ) {
    // Build transition lookup and initial state
  }

  transition(to: TState): boolean {
    const allowed = this.transitions.get(this.currentState);
    if (!allowed?.has(to)) return false;  // FSM-04: invalid transition rejected

    const fromConfig = this.states.get(this.currentState);
    fromConfig?.onExit?.(this.context!);    // Exit hook

    this.currentState = to;

    const toConfig = this.states.get(to);
    toConfig?.onEnter?.(this.context!);     // Enter hook

    return true;
  }

  getCurrentState(): TState { return this.currentState; }

  canTransitionTo(to: TState): boolean {
    return this.transitions.get(this.currentState)?.has(to) ?? false;
  }
}
```

**Why this shape:**
- Generic `TState` means no game knowledge in the engine
- Transition table as `[from, to]` pairs is explicit and testable — every valid transition is declared, everything else is forbidden (FSM-04)
- `TContext` generic allows passing shared state (e.g., the Game object) to enter/exit hooks without the FSM knowing the shape
- `transition()` returns boolean rather than throwing — caller decides how to handle invalid transitions
- Enter/exit hooks are optional — not every state needs them

**Transition table for game states (FSM-02):**
```typescript
// Game layer — src/game/states/game-states.ts
const GAME_TRANSITIONS: Array<[GameState, GameState]> = [
  ['Loading',  'MainMenu'],
  ['MainMenu', 'Playing'],
  ['Playing',  'Paused'],
  ['Playing',  'GameOver'],
  ['Paused',   'Playing'],
  ['Paused',   'MainMenu'],
  ['GameOver', 'MainMenu'],
];
```

**System activation per state (FSM-03):**

| State | Active System Phases | Rationale |
|-------|---------------------|-----------|
| Loading | none | Asset loading only, no game logic |
| MainMenu | render | Display menu visuals |
| Playing | pre-turn, action, post-turn, render | Full game loop |
| Paused | render | Freeze game logic, keep rendering |
| GameOver | render | Freeze game logic, show game over screen |

Implementation: The game bootstrap associates each state with an `activePhases: Phase[]` array. When the game loop ticks, it asks the FSM for the current state, looks up active phases, and only executes systems registered in those phases.

### Pattern 2: Energy-Based Turn Manager

**What:** Turn orchestrator that implements the accumulate-to-threshold energy model with deterministic ordering and player input gating.

**Core algorithm:**

```
LOOP:
  1. AWAIT_INPUT: World is frozen. Wait for player input.
  2. Player provides action → validate → apply → deduct energy cost
  3. PRE_TURN: Execute pre-turn systems (status effect ticks, etc.)
  4. ENEMY_TURNS: Collect actors with energy ≥ 1000, sorted by entity ID
     ascending, skip dead (TURN-04). Each enemy acts once, energy deducted.
  5. POST_TURN: Execute post-turn systems (death cleanup, FOV recalc, UI sync)
  6. ENERGY_TICK: All living actors gain energy += speed
  7. Check if player has energy ≥ 1000:
     - Yes → go to step 1 (await player input)
     - No → go to step 4 (enemies with energy act; skip pre-turn to avoid
       double-ticking status effects — they tick once per player turn, not
       per energy tick)
  8. Repeat step 6-7 until player has enough energy
```

**Key implementation detail — the "sub-tick" loop:** When the player's speed is lower than some enemies', the player may need multiple energy ticks before reaching threshold 1000. During those ticks, faster enemies accumulate enough energy to act. The turn manager must process those enemy turns without waiting for player input. This is steps 6-8 above.

```typescript
// src/engine/turn/types.ts
const ENERGY_THRESHOLD = 1000;

enum TurnPhase {
  AWAIT_INPUT = 'AWAIT_INPUT',
  PLAYER_ACTION = 'PLAYER_ACTION',
  PRE_TURN = 'PRE_TURN',
  ENEMY_TURNS = 'ENEMY_TURNS',
  POST_TURN = 'POST_TURN',
  ENERGY_TICK = 'ENERGY_TICK',
}

interface TurnManagerConfig {
  energyThreshold: number;       // 1000
  defaultActionCost: number;     // e.g., 1000 for standard actions
  waitActionCost: number;        // e.g., 500 for wait/skip
}

// src/engine/turn/turn-manager.ts
class TurnManager {
  private phase: TurnPhase = TurnPhase.AWAIT_INPUT;
  private inputLocked: boolean = true;

  // Called when player submits an action
  submitAction(action: PlayerAction): void {
    if (this.phase !== TurnPhase.AWAIT_INPUT) return; // Input gating (TURN-06)
    this.inputLocked = true;

    // 1. Apply player action, deduct energy
    this.processPlayerAction(action);

    // 2. Pre-turn phase
    this.executeSystems(Phase.PRE_TURN);

    // 3. Process all ready enemies this tick
    this.processEnemyTurns();

    // 4. Post-turn phase
    this.executeSystems(Phase.POST_TURN);

    // 5. Advance energy until player is ready again
    this.advanceUntilPlayerReady();

    // 6. Await next player input
    this.phase = TurnPhase.AWAIT_INPUT;
    this.inputLocked = false;
  }

  private processEnemyTurns(): void {
    const enemies = this.getReadyEnemies(); // energy ≥ 1000, sorted by entity ID
    for (const enemy of enemies) {
      if (!this.isAlive(enemy)) continue; // TURN-04: skip dead
      this.processEnemyAction(enemy);
    }
  }

  private advanceUntilPlayerReady(): void {
    while (!this.isPlayerReady()) {
      this.tickEnergy();           // All actors gain energy += speed
      this.processEnemyTurns();    // Process any enemies that cross threshold
    }
  }

  canAcceptInput(): boolean {
    return this.phase === TurnPhase.AWAIT_INPUT && !this.inputLocked;
  }
}
```

**Energy component design:**
```typescript
// game/components/energy.ts
const Energy = defineComponent('energy', {
  current: z.number().int(),
  speed: z.number().int().positive(),
  threshold: z.number().int().positive().default(1000),
});
// Typical values: { current: 0, speed: 100, threshold: 1000 }
// Baseline: 10 ticks to act (100 speed × 10 = 1000)
// Fast enemy: speed 150 → acts ~1.5x per player turn
// Slow enemy: speed 50 → acts ~0.5x per player turn
```

**Action energy costs:**
```typescript
interface ActionCosts {
  move: number;      // 1000 (standard)
  attack: number;    // 1000 (same as move, per CONTEXT.md bump-attack decision)
  wait: number;      // 500 (reduced, per CONTEXT.md)
}
```

**Player-first tiebreak (TURN-03):** When sorting ready actors:
```typescript
function actorSortPriority(a: ActorInfo, b: ActorInfo): number {
  // Player always first
  if (a.isPlayer) return -1;
  if (b.isPlayer) return 1;
  // Then by entity ID ascending (deterministic)
  return a.entityId - b.entityId;
}
```

**Deterministic ordering rationale:** Entity IDs are auto-incrementing integers (Phase 1 decision). Sorting by entity ID gives deterministic ordering that matches creation order. This is critical for client-server agreement in Phase 5 — same starting state + same player action must produce identical enemy turn results.

### Pattern 3: Keyboard Input Manager

**What:** Captures keyboard events, translates them through a rebindable action map, and dispatches semantic game actions. Handles browser default suppression and input gating.

```typescript
// game/input/actions.ts
enum GameAction {
  MOVE_NORTH = 'MOVE_NORTH',
  MOVE_SOUTH = 'MOVE_SOUTH',
  MOVE_EAST = 'MOVE_EAST',
  MOVE_WEST = 'MOVE_WEST',
  WAIT = 'WAIT',
  PAUSE = 'PAUSE',
  // Future: INTERACT, USE_ITEM, etc.
}

// Default bindings — use KeyboardEvent.code for layout independence
const DEFAULT_BINDINGS: Record<string, GameAction> = {
  'ArrowUp':    GameAction.MOVE_NORTH,
  'ArrowDown':  GameAction.MOVE_SOUTH,
  'ArrowRight': GameAction.MOVE_EAST,
  'ArrowLeft':  GameAction.MOVE_WEST,
  'KeyW':       GameAction.MOVE_NORTH,
  'KeyS':       GameAction.MOVE_SOUTH,
  'KeyD':       GameAction.MOVE_EAST,
  'KeyA':       GameAction.MOVE_WEST,
  'Period':     GameAction.WAIT,     // '.' — classic roguelike wait
  'Numpad5':    GameAction.WAIT,
  'Escape':     GameAction.PAUSE,
};
```

```typescript
// game/input/input-manager.ts
class InputManager {
  private actionMap: Map<string, GameAction>;
  private handler: ((event: KeyboardEvent) => void) | null = null;
  private actionCallback: ((action: GameAction) => void) | null = null;
  private enabled = false;

  constructor(bindings: Record<string, GameAction> = DEFAULT_BINDINGS) {
    this.actionMap = new Map(Object.entries(bindings));
  }

  setActionHandler(callback: (action: GameAction) => void): void {
    this.actionCallback = callback;
  }

  enable(): void {
    if (this.enabled) return;
    this.handler = (event: KeyboardEvent) => {
      const action = this.actionMap.get(event.code);
      if (action !== undefined) {
        event.preventDefault();  // INP-03: suppress browser defaults
        this.actionCallback?.(action);
      }
    };
    document.addEventListener('keydown', this.handler);
    this.enabled = true;
  }

  disable(): void {
    if (!this.enabled || !this.handler) return;
    document.removeEventListener('keydown', this.handler);
    this.handler = null;
    this.enabled = false;
  }

  rebind(keyCode: string, action: GameAction): void {
    // Remove any existing binding for this key
    this.actionMap.set(keyCode, action);
  }

  unbind(keyCode: string): void {
    this.actionMap.delete(keyCode);
  }

  getBindingsForAction(action: GameAction): string[] {
    return [...this.actionMap.entries()]
      .filter(([, a]) => a === action)
      .map(([code]) => code);
  }
}
```

**Why `event.code` over `event.key`:**
- `event.code` is physical key location: 'KeyW' is always the same physical key regardless of keyboard layout (QWERTY, AZERTY, Dvorak)
- `event.key` is the character produced: 'w' on QWERTY but 'z' on AZERTY for the same physical key
- For WASD movement, physical position matters more than character — use `code`
- Arrow keys: `event.code` and `event.key` are both 'ArrowUp' etc., so no difference there

**Input gating integration (TURN-06):** The InputManager itself doesn't enforce gating. The turn manager controls when input is accepted by calling `inputManager.enable()` / `inputManager.disable()`, or by checking `turnManager.canAcceptInput()` before dispatching the action to the turn manager. Recommended approach: the action callback checks with the turn manager:

```typescript
inputManager.setActionHandler((action) => {
  if (turnManager.canAcceptInput()) {
    turnManager.submitAction(action);
  }
  // Else: silently ignore (input is gated)
});
```

### Pattern 4: Movement System with Collision & Bump-to-Attack

**What:** A system function that processes movement intents — checks grid walkability, entity occupancy, and triggers bump-to-attack when appropriate.

```typescript
// game/systems/movement.ts
function createMovementSystem(grid: Grid, eventBus: EventBus): SystemFn {
  return (world: World) => {
    // Movement intents are queued by the turn manager when processing
    // player or enemy move actions. This system resolves them.
    const moveIntents = getMoveIntents(world); // implementation varies

    for (const intent of moveIntents) {
      const pos = world.getComponent(intent.entityId, Position);
      if (!pos) continue;

      const targetX = pos.x + intent.dx;
      const targetY = pos.y + intent.dy;

      // 1. Bounds + walkability check (MOV-02)
      if (!grid.isWalkable(targetX, targetY)) continue;

      // 2. Entity occupancy check
      const occupants = grid.getEntitiesAt(targetX, targetY);
      let blocked = false;

      for (const occupantId of occupants) {
        if (occupantId === intent.entityId) continue;

        // Check if occupant is hostile (MOV-03)
        if (world.hasComponent(occupantId, Hostile)) {
          // Bump-to-attack: emit event, don't move (player stays in place)
          eventBus.emit('BUMP_ATTACK', {
            attacker: intent.entityId,
            defender: occupantId,
          });
          blocked = true;
          break;
        }

        // Non-hostile entity blocks movement
        if (world.hasComponent(occupantId, BlocksMovement)) {
          blocked = true;
          break;
        }
      }

      if (blocked) continue;

      // 3. Apply movement
      const oldX = pos.x;
      const oldY = pos.y;
      pos.x = targetX;
      pos.y = targetY;
      grid.moveEntity(intent.entityId, oldX, oldY, targetX, targetY);
    }
  };
}
```

**Direction deltas:**
```typescript
const DIRECTIONS = {
  MOVE_NORTH: { dx: 0, dy: -1 },
  MOVE_SOUTH: { dx: 0, dy: 1 },
  MOVE_EAST:  { dx: 1, dy: 0 },
  MOVE_WEST:  { dx: -1, dy: 0 },
} as const;
```

**Note on y-axis:** `dy: -1` for NORTH follows screen coordinates where y=0 is top. Standard for tile-based games.

### Pattern 5: Game Bootstrap (setup.ts)

**What:** Single function in `game/setup.ts` that instantiates all engine modules, registers game-specific content, and wires everything together. This is the ONLY file that crosses the engine/game boundary by importing from both.

```typescript
// game/setup.ts — sole wiring point (ARCH-03)
export interface GameContext {
  world: World;
  grid: Grid;
  eventBus: EventBus<AllEvents>;
  fsm: StateMachine<GameState>;
  turnManager: TurnManager;
  inputManager: InputManager;
}

export function createGame(config: GameConfig): GameContext {
  // 1. Instantiate engine modules
  const eventBus = new EventBus<AllEvents>();
  const world = new World(eventBus);
  const grid = new Grid(config.gridWidth, config.gridHeight);

  // 2. Register game components
  // (Phase 1 components + Phase 2 components)

  // 3. Create turn manager
  const turnManager = new TurnManager(world, grid, eventBus, {
    energyThreshold: 1000,
    defaultActionCost: 1000,
    waitActionCost: 500,
  });

  // 4. Create input manager
  const inputManager = new InputManager();

  // 5. Wire input → turn manager
  inputManager.setActionHandler((action) => {
    if (turnManager.canAcceptInput()) {
      turnManager.submitAction(action);
    }
  });

  // 6. Register systems into phase groups
  world.registerSystem(Phase.ACTION, createMovementSystem(grid, eventBus));
  // Future: combat, AI, FOV systems added in later phases

  // 7. Define game states with enter/exit hooks
  const fsm = new StateMachine<GameState, GameContext>(
    'Loading',
    {
      Loading: {
        onEnter: (ctx) => { /* register templates, load data */ },
      },
      MainMenu: {
        onEnter: (ctx) => { ctx.inputManager.disable(); },
      },
      Playing: {
        onEnter: (ctx) => {
          ctx.inputManager.enable();
          ctx.turnManager.start();
        },
        onExit: (ctx) => {
          ctx.inputManager.disable();
        },
      },
      Paused: {
        onEnter: (ctx) => { ctx.inputManager.disable(); },
      },
      GameOver: {
        onEnter: (ctx) => { ctx.inputManager.disable(); },
      },
    },
    GAME_TRANSITIONS,
  );

  // 8. Return the game context
  const context: GameContext = { world, grid, eventBus, fsm, turnManager, inputManager };
  return context;
}
```

**Engine/game boundary in Phase 2:**

| Engine (new in Phase 2) | Game (new in Phase 2) |
|------------------------|-----------------------|
| `StateMachine<TState>` — generic, reusable | GameState enum, state configs with enter/exit hooks |
| `TurnManager` — energy system, phase orchestration | Action types (GameAction), action costs |
| Turn phase types, energy threshold config | Movement system, bump-to-attack logic |
| — | InputManager (browser-specific, lives in game layer) |
| — | Component definitions (Energy, Actor, Hostile, BlocksMovement) |
| — | `setup.ts` wiring |

**Note on InputManager placement:** The InputManager uses `document.addEventListener` — a browser API. It belongs in the game layer (not engine) because the engine has zero browser dependencies (established in Phase 1). If the input abstraction needs to be engine-generic (e.g., supporting gamepads), an engine-level `InputPort` interface could be defined with the `InputManager` as a game-layer implementation. For v1, a simple game-layer class is sufficient.

**Note on TurnManager placement:** The TurnManager is engine-layer code. It knows about "actors with energy" and "turn phases" but not about "players", "goblins", or "movement." The game layer tells the turn manager what to do via action callbacks. The turn manager orchestrates when.

### Anti-Patterns to Avoid

- **State machine explosion:** Do NOT create states like `PlayingAwaitingInput`, `PlayingAnimating`, `PlayingEnemyTurn`. These are flags/phases on the TurnManager, not FSM states. Keep exactly 5 top-level states.
- **Input processing in the game loop ticker:** Do NOT poll for input every frame. Keyboard events are event-driven — use `addEventListener` and dispatch when events arrive.
- **Movement logic in the input handler:** Do NOT move the player directly in the keyboard callback. Input → semantic action → turn manager → movement system. Layered processing enables input gating, action validation, and future server validation.
- **Hardcoding player entity ID:** Do NOT assume `entityId === 1` is the player. Use a query: `world.query(Actor).find(id => world.getComponent(id, Actor).isPlayer)`. Or store the player entity ID in the GameContext.
- **Mutating grid without updating Position (or vice versa):** Position component is authoritative. Always update Position first, then sync grid spatial index. Never update grid directly without the corresponding Position change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Key code constants | String literal enum of all key codes | `KeyboardEvent.code` values directly | Browser-standard, well-documented, no maintenance |
| Complex event system for input | Custom Observable/Signal for input | Simple callback pattern | Input events are 1:1 key→action, no fan-out needed |
| Turn scheduling priority queue | Heap-based priority queue | Sorted array filter | <50 actors; sort is O(n log n) where n < 50, trivially fast |
| Direction/vector math | Vector2D class with full math ops | Plain `{ dx, dy }` objects | 4 directions, no rotation, no magnitude — objects suffice |

**Key insight:** Phase 2's "don't hand-roll" list is intentionally short because Phase 2 IS hand-rolled game logic. The FSM, turn manager, and movement system are the deliverables, not wrappers around libraries.

## Common Pitfalls

### Pitfall 1: State Machine Explosion (Pitfall 6 from project research)
**What goes wrong:** Game FSM grows beyond 5 states as sub-phases are promoted to full states.
**Why it happens:** Turn sub-phases (awaiting input, processing enemies, animating) feel like distinct states.
**How to avoid:** Hard rule — exactly 5 top-level states. Sub-phases are the `TurnPhase` enum on TurnManager (`AWAIT_INPUT`, `PLAYER_ACTION`, `ENEMY_TURNS`, etc.). The FSM state controls WHICH systems run; the TurnManager phase controls WHAT the turn system does within the Playing state.
**Warning signs:** More than 7 states in the FSM, state names concatenating two concepts.

### Pitfall 2: Turn Ordering Bugs (Pitfall 11 from project research)
**What goes wrong:** Dead entities act, enemies act before the player, status effects tick at wrong phase.
**Why it happens:** Subtle ordering requirements look simple but have many edge cases.
**How to avoid:** (1) Explicit phase enum with documented order. (2) Dead entity check (`isAlive()`) before every enemy action. (3) `canAcceptInput()` flag prevents player double-acting. (4) Deterministic enemy sort by entity ID. (5) Write turn-sequence integration tests that verify exact execution order.
**Warning signs:** Entity acting after death, player moving during enemy phase, inconsistent results between runs.

### Pitfall 3: Input Event Leaks
**What goes wrong:** Keyboard listeners are not cleaned up when transitioning states (e.g., from Playing to Paused). Events queue during paused state and fire all at once on unpause, or events continue processing during game over.
**Why it happens:** `addEventListener` without corresponding `removeEventListener`. Or enabling input in multiple places without a single source of truth.
**How to avoid:** (1) InputManager has explicit `enable()`/`disable()` methods. (2) FSM state enter/exit hooks control enable/disable. (3) `canAcceptInput()` check at the action handler level provides defense-in-depth. (4) Test: verify no action dispatches when input is gated.
**Warning signs:** Player moving during pause, queued actions executing on unpause.

### Pitfall 4: Energy System Edge Case — Infinite Sub-Tick Loop
**What goes wrong:** The `advanceUntilPlayerReady()` loop never terminates because the player entity has speed 0, or because an enemy action reduces the player's speed to 0, creating an infinite loop of enemy-only ticks.
**Why it happens:** No guard against degenerate speed values.
**How to avoid:** (1) Zod schema enforces `speed: z.number().int().positive()` (minimum 1). (2) Max sub-tick guard: if > 100 energy ticks without player reaching threshold, something is wrong — break and log error. (3) Speed is immutable during turn processing (status effects that modify speed apply at pre-turn, not mid-turn).
**Warning signs:** Game freeze, browser tab becoming unresponsive.

### Pitfall 5: Grid Spatial Index Desync
**What goes wrong:** Position component says entity is at (5,3) but grid's spatial index still has the entity at (3,2). Movement checks pass incorrectly, entities overlap without triggering bump-attack.
**Why it happens:** Position mutated directly without calling `grid.moveEntity()`. Or `grid.moveEntity()` called with wrong old coordinates.
**How to avoid:** (1) Movement system is the ONLY code that changes Position + grid together. (2) Wrap the update in a helper: `moveEntityTo(world, grid, entityId, newX, newY)`. (3) Test: after every movement, assert Position component matches grid entity location.
**Warning signs:** Entities walking through each other, bump-attack not triggering.

## Code Examples

### Complete Turn Cycle (Integration Test Shape)

```typescript
// Verified pattern: full turn cycle test
describe('TurnManager', () => {
  it('processes complete turn cycle in correct order', () => {
    const log: string[] = [];

    // Setup: player (speed 100) + 2 enemies (speed 100)
    // All start with energy 0

    // Tick energy: all gain 100. None at threshold (1000).
    // ... (9 more ticks) ...
    // After 10 ticks: all at 1000. Player + enemies all ready.

    turnManager.submitAction(GameAction.MOVE_EAST);

    // Expected execution order:
    expect(log).toEqual([
      'player_action: MOVE_EAST',  // Player acts first (tiebreak)
      'pre_turn',                   // Pre-turn systems
      'enemy_action: entity_2',     // Enemy 1 (lower ID)
      'enemy_action: entity_3',     // Enemy 2 (higher ID)
      'post_turn',                  // Post-turn systems
      // Energy tick: all gain 100. All at 100 (deducted 1000 for action).
      // ... 9 more ticks ...
      // All at 1000 again. Player ready → AWAIT_INPUT
    ]);
  });

  it('skips dead entities during enemy turns', () => {
    // Enemy 2 killed during enemy 1's action
    // Enemy 2 should be skipped
  });

  it('processes extra enemy turns when player is slower', () => {
    // Player speed: 50, Enemy speed: 100
    // Enemy reaches threshold in 10 ticks, player in 20
    // Enemy should act twice per player turn
  });
});
```

### FSM Transition Validation

```typescript
describe('StateMachine', () => {
  it('allows valid transitions and calls hooks', () => {
    const enterSpy = vi.fn();
    const exitSpy = vi.fn();

    const fsm = new StateMachine('Loading', {
      Loading: { onExit: exitSpy },
      MainMenu: { onEnter: enterSpy },
      Playing: {},
      Paused: {},
      GameOver: {},
    }, [
      ['Loading', 'MainMenu'],
      ['MainMenu', 'Playing'],
      // ...
    ]);

    expect(fsm.transition('MainMenu')).toBe(true);
    expect(exitSpy).toHaveBeenCalled();
    expect(enterSpy).toHaveBeenCalled();
    expect(fsm.getCurrentState()).toBe('MainMenu');
  });

  it('rejects invalid transitions', () => {
    // Loading → Playing should be rejected (must go through MainMenu)
    expect(fsm.transition('Playing')).toBe(false);
    expect(fsm.getCurrentState()).toBe('Loading'); // State unchanged
  });
});
```

### Input System with Gating

```typescript
describe('InputManager', () => {
  it('maps keyboard events to semantic actions', () => {
    const actionSpy = vi.fn();
    const input = new InputManager();
    input.setActionHandler(actionSpy);
    input.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    expect(actionSpy).toHaveBeenCalledWith(GameAction.MOVE_NORTH);
  });

  it('suppresses browser defaults for mapped keys', () => {
    const input = new InputManager();
    input.enable();

    const event = new KeyboardEvent('keydown', {
      code: 'ArrowUp',
      cancelable: true,
    });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores unmapped keys', () => {
    const actionSpy = vi.fn();
    const input = new InputManager();
    input.setActionHandler(actionSpy);
    input.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'F5' }));
    expect(actionSpy).not.toHaveBeenCalled();
  });

  it('supports rebinding', () => {
    const actionSpy = vi.fn();
    const input = new InputManager();
    input.setActionHandler(actionSpy);
    input.rebind('KeyX', GameAction.WAIT);
    input.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
    expect(actionSpy).toHaveBeenCalledWith(GameAction.WAIT);
  });
});
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Round-robin turn system | Energy/speed accumulation | Enables tactical depth: fast/slow entities, haste/slow effects |
| String-based key matching (`event.key`) | `event.code` for physical key | Layout-independent bindings (QWERTY/AZERTY agnostic) |
| Polling input each frame | Event-driven `addEventListener` | No wasted cycles, natural browser integration |
| Monolithic game state enum | FSM with generic state machine + turn phase flags | Prevents state explosion, keeps FSM simple and reusable |

## Open Questions

1. **TurnManager engine vs game placement**
   - The TurnManager knows about energy components and system phase execution but not about specific game actions
   - Current recommendation: engine layer (generic actor scheduling) with game layer action handlers
   - If the TurnManager needs to know about specific action types (move, attack, wait), it may need splitting: engine-side scheduler + game-side action processor
   - Recommendation: Start with engine layer. If game-specific logic creeps in, extract a game-layer `TurnProcessor` that consumes engine scheduler events.

2. **Move intent representation**
   - Options: (a) Component on entity (e.g., `MoveIntent { dx, dy }`), (b) Event on the bus, (c) Direct function call parameter
   - Recommendation: Direct parameter to the turn manager's action handler. Move intents are ephemeral — they don't need component storage or event bus overhead. The turn manager calls the movement system with the intent directly.

3. **How do enemy actions get dispatched in Phase 2?**
   - Phase 2 doesn't implement AI (that's Phase 4). Enemy turns in Phase 2 should be no-ops or simple "wait" actions.
   - Recommendation: TurnManager has an `enemyActionHandler` callback. In Phase 2, this is a no-op. In Phase 4, it's wired to the AI system.
   - Alternative: Enemies with no AI component simply skip their turn (deduct wait cost).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (created in Phase 1 Plan 01-01) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FSM-01 | Generic FSM with enter/exit hooks, transitions | unit | `npx vitest run src/engine/state-machine/state-machine.test.ts` | ❌ Wave 0 |
| FSM-02 | 5 game states defined with correct transitions | unit | `npx vitest run src/game/states/game-states.test.ts` | ❌ Wave 0 |
| FSM-03 | States control which system phases execute | integration | `npx vitest run src/game/states/game-states.test.ts -t "system activation"` | ❌ Wave 0 |
| FSM-04 | Invalid transitions rejected | unit | `npx vitest run src/engine/state-machine/state-machine.test.ts -t "invalid"` | ❌ Wave 0 |
| TURN-01 | Turn cycle: pre-turn → player → enemies → post-turn → await | integration | `npx vitest run src/engine/turn/turn-manager.test.ts -t "turn cycle"` | ❌ Wave 0 |
| TURN-02 | Nothing changes until player acts | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "frozen"` | ❌ Wave 0 |
| TURN-03 | Deterministic enemy ordering by entity ID | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "deterministic"` | ❌ Wave 0 |
| TURN-04 | Dead entities skipped | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "dead"` | ❌ Wave 0 |
| TURN-05 | Energy/speed determines turn frequency | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "energy"` | ❌ Wave 0 |
| TURN-06 | Input gated during processing | unit | `npx vitest run src/engine/turn/turn-manager.test.ts -t "input gat"` | ❌ Wave 0 |
| MOV-01 | Cardinal movement in 4 directions | unit | `npx vitest run src/game/systems/movement.test.ts -t "cardinal"` | ❌ Wave 0 |
| MOV-02 | Walkability + occupancy collision | unit | `npx vitest run src/game/systems/movement.test.ts -t "collision"` | ❌ Wave 0 |
| MOV-03 | Bump-to-attack on hostile entity | unit | `npx vitest run src/game/systems/movement.test.ts -t "bump"` | ❌ Wave 0 |
| INP-01 | Keyboard → semantic action mapping | unit | `npx vitest run src/game/input/input-manager.test.ts -t "map"` | ❌ Wave 0 |
| INP-02 | Action map rebindable | unit | `npx vitest run src/game/input/input-manager.test.ts -t "rebind"` | ❌ Wave 0 |
| INP-03 | Browser defaults suppressed | unit | `npx vitest run src/game/input/input-manager.test.ts -t "prevent"` | ❌ Wave 0 |
| ARCH-03 | setup.ts is sole wiring point | integration | `npx vitest run src/game/setup.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/engine/state-machine/state-machine.test.ts` — covers FSM-01, FSM-04
- [ ] `src/game/states/game-states.test.ts` — covers FSM-02, FSM-03
- [ ] `src/engine/turn/turn-manager.test.ts` — covers TURN-01 through TURN-06
- [ ] `src/game/systems/movement.test.ts` — covers MOV-01, MOV-02, MOV-03
- [ ] `src/game/input/input-manager.test.ts` — covers INP-01, INP-02, INP-03 (needs jsdom environment)
- [ ] `src/game/setup.test.ts` — covers ARCH-03

*(All test files are new — greenfield Phase 2 code)*

### Environment Note
Input system tests (`input-manager.test.ts`) require a DOM environment for `document.addEventListener` and `KeyboardEvent`. Use Vitest's per-file environment override:
```typescript
// @vitest-environment jsdom
```
All other Phase 2 tests run in the default Node environment (pure logic, no DOM).

## Sources

### Primary (HIGH confidence)
- Phase 1 Research (`.planning/phases/01-ecs-core-data-foundation/01-RESEARCH.md`) — World API, EventBus API, Grid API, component patterns, system patterns
- Phase 1 Plans (01-01 through 01-04) — concrete API contracts Phase 2 builds on
- Project Architecture Research (`.planning/research/ARCHITECTURE.md`) — module structure, engine/game boundary
- Project Pitfalls Research (`.planning/research/PITFALLS.md`) — Pitfall 6 (state machine explosion), Pitfall 11 (turn ordering bugs)
- CONTEXT.md decisions — energy model, bump-to-attack rules, discretion areas
- MDN Web Docs — KeyboardEvent.code, addEventListener, preventDefault (well-established browser APIs)

### Secondary (MEDIUM confidence)
- Classic roguelike energy system design — well-documented pattern across roguelike development community (roguebasin, r/roguelikedev)
- Generic FSM pattern — standard CS pattern; specific implementation shape derived from project constraints

### Tertiary (LOW confidence)
None — Phase 2 domains are well-established patterns with no ambiguity requiring external verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new external dependencies, builds on Phase 1
- Architecture (FSM): HIGH — generic FSM is a well-understood pattern; Pitfall 6 mitigations are clear
- Architecture (Turn Manager): HIGH — energy system design is locked by CONTEXT.md; implementation pattern is standard roguelike
- Architecture (Input): HIGH — browser KeyboardEvent API is stable, well-documented
- Architecture (Movement): HIGH — grid collision is a solved problem
- Architecture (Bootstrap): HIGH — single-file wiring is straightforward
- Pitfalls: HIGH — turn ordering and state explosion are well-documented roguelike development risks with clear mitigations

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable patterns, no library version sensitivity)
