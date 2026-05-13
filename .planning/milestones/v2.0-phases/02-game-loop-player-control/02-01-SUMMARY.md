# Phase 02 Wave 1 Summary: Game State Machine

## Objective
Implemented a generic finite state machine (engine layer) and game state definitions (game layer) to control game flow and system execution phases.

## Changes
- **Core Engine**: Added `StateMachine<TState, TContext>` with transition validation and lifecycle hooks.
- **Game Logic**: Defined `GameState` enum and transition table.
- **System Control**: Mapped game states to active ECS `Phase` values (e.g., `Playing` state runs all phases, `Paused` only runs `RENDER`).

## Stats
- **New Files**: 6
- **Tests**: 13 passing
- **Coverage**: Full coverage of transition logic and phase lookups.

## Next Steps
- Implement Keyboard and Mouse input handling.
- Build the Input System to map raw events to game actions.
