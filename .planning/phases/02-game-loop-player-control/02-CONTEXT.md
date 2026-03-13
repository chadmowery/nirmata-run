# Phase 2: Game Loop & Player Control - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn-based game loop processes player actions and state transitions through a complete turn cycle. Delivers: generic FSM with game states (Loading/MainMenu/Playing/Paused/GameOver), turn manager with energy/speed scheduling, keyboard→action input mapping, cardinal movement with collision checking, bump-to-attack detection, and game/setup.ts as the sole bootstrap wiring point. Builds on Phase 1 ECS, event bus, and grid.

</domain>

<decisions>
## Implementation Decisions

### Turn Pacing & Energy Model
- Accumulate-to-threshold energy system — every tick, all actors gain energy equal to their speed; when energy ≥ threshold (1000), they can act
- High energy threshold (1000) with granular speed values — baseline speed 100, allows fine-grained speed differences between entity types
- Variable energy cost per action type — different actions cost different amounts (e.g., move, attack, wait each have distinct costs)
- Interleaved turns — one action per actor per tick, round-robin style; no actor takes consecutive actions from speed alone
- Player waits like any other actor — if player has no energy, enemies with energy act until player can go again
- Player-first tiebreak — among actors with enough energy in the same tick, the player always goes first, then entity ID tiebreak for remaining actors
- Wait action available with reduced energy cost — player can skip their turn, costing less energy than a standard action

### Bump-to-Attack Detection
- Automatic bump-attack — moving into an occupied enemy tile triggers a melee attack immediately, no confirmation needed
- Same energy cost as a standard attack action — bump is treated identically to a deliberate attack
- Player stays in place — after a bump-attack, the player does not move into the target tile
- Hostility flag determines bump behavior — only entities flagged as hostile trigger bump-attack; non-hostile entities block movement (future-proofed for friendly NPCs in v2)

### Claude's Discretion
- State machine implementation details (state object shape, transition table structure)
- Input system architecture (event listener management, action mapping data structure)
- Movement system collision checking approach
- Game bootstrap wiring pattern in setup.ts
- System registration and ordering details within FSM-controlled phases

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred all technical implementation details to Claude's discretion beyond the decisions captured above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing application code — greenfield project (Phase 1 not yet executed)

### Established Patterns (from Phase 1 decisions)
- Systems are pure functions: `(world) => void` — stateless, registered into named phase groups (pre-turn, action, post-turn, render)
- Game state machine controls system activation — Playing runs all game systems, Paused skips AI/input
- Queued event delivery with end-of-turn flush
- Components are mutable POJOs; no change tracking
- Position component is authoritative; grid spatial index synced from Position components

### Integration Points
- Phase 1 ECS core (World, entities, components, systems, queries)
- Phase 1 event bus (typed, queued with end-of-turn flush)
- Phase 1 2D grid (walkability queries, entity-at-position lookups, spatial indexing)
- Phase 1 entity composition pipeline (templates, builder, registry, factory)
- Research documents in `.planning/research/` covering architecture and stack decisions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-game-loop-player-control*
*Context gathered: 2026-03-13*
