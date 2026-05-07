# Plan 16-03 Summary: Starter Loadouts & Bundle Pre-loading

Implemented the starter loadout system for Shells, providing each archetype with a thematic set of starting abilities.

## Key Changes

### Shell Template Updates
- Updated `ShellTemplate` interface in `src/game/shells/types.ts` to include `starterLoadout: string[]`.
- Updated existing and new shell archetypes in `src/game/shells/templates/`:
  - `VANGUARD-v1`: Starts with `basic-strike` and `kinetic-link`.
  - `GHOST-v1`: Starts with `ghost-pulse` and `logic-jam`.
  - `BASTION-v1`: Retains existing stats (loadout can be added later).

### Starter Item Templates
- Created 4 new item templates in `src/game/entities/templates/`:
  - `basic-strike.json`: Low-heat melee attack.
  - `kinetic-link.json`: Mid-heat dash attack with 3-tile displacement.
  - `ghost-pulse.json`: Vision-based utility pulse.
  - `logic-jam.json`: Close-range stun utility.
- Registered all new items in `src/game/entities/index.ts`.

### Pre-loading Logic
- Updated `src/game/engine-factory.ts`:
  - Implemented logic in `createEngineInstance` to detect if a player has no equipped items (either due to a missing profile or an empty one).
  - Automatically spawns and equips items defined in the shell's `starterLoadout`.
  - Ensures items are correctly mapped to `firmwareSlots` in `playerOverrides`.

## Verification
- Verified shell registration in `src/game/shells/index.ts`.
- Verified item registration in `src/game/entities/index.ts`.
- Fixed core type regressions in `engine-factory.ts` related to `Health.isAlive` and `ENTITY_DIED.isPlayer`.
