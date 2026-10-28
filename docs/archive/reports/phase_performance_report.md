# Turn Manager & Phase System Performance Analysis

## Executive Summary
You noticed that the 4-phase ECS sequence (`GATHER_INTENT`, `ACTION`, `REACTION`, `CLEANUP`) runs entirely for the player, and then repeats fully for each individual ready enemy, generating a large number of system execution logs per API call. 

While it looks "chatty" in the logs, **this is the mathematically correct behavior for a sequential turn-based roguelike** and is highly performant. Attempting to parallelize all entities into a single 4-phase pass would fundamentally change the game's mechanics to a Simultaneous Turn Resolution model and introduce major gameplay bugs.

## Performance Evaluation
### The Overhead is Negligible
The `world.executeSystems` function and the underlying `world.query()` are extremely lightweight by design.
1. **Time Complexity:** The ECS query iterates over Javascript `Set` structures (the component stores). Finding the intersection of components takes `O(N * M)` where N is the smallest store size and M is the number of components queried. Map lookups (`.has()`) are `O(1)`.
2. **Scale:** Even with 50 entities on the map and 20 registered systems across the 4 core phases, running the full sequence for 10 ready enemies results in roughly 200 system executions per action API call. 
3. **Execution Time:** In a modern V8 Node.js environment, executing this loop takes less than a millisecond. The server API call payload generation (serialization) and network latency will be orders of magnitude slower than the ECS phase execution.

## Why We Cannot Combine Phases per API Call
To answer your question directly: *Could we combine them so each phase triggers only once?* 
Technically, yes, by marking all ready entities as `Acting` simultaneously, but **it would break the game rules**.

### 1. Sequential Turn Mechanics vs Simultaneous Mechanics
Traditional roguelikes rely on strict sequential resolution: The player acts, the world state updates. Then Enemy A evaluates the *new* state and acts, the world updates. Then Enemy B evaluates the *newest* state and acts.
If we merged them into one macro phase loop:
- **AI Pathfinding:** Enemies would run `Phase.GATHER_INTENT` before the player resolves `Phase.ACTION`. This means enemies would target the player's *old* tile rather than reacting to where the player just moved.
- **Combat & Death Protocols:** If the player attacks and kills an enemy, the current system immediately processes the death during the player's `CLEANUP` phase. The `TurnManager` then checks `isAlive(id)` and skips the dead enemy's turn. In a combined loop, the dead enemy would have already gathered its `AttackIntent` at the start of the turn, allowing it to strike the player from beyond the grave during `Phase.REACTION`.

### 2. Collision & Determinism Race Conditions
Currently, movement collisions are avoided because the `MovementSystem` runs on exactly one actor's turn cycle at a time, updating the spatial grid immediately before the next actor acts. If we grouped all movements into a single `Phase.ACTION`:
- If both the Player and an Enemy attempted to move into the exact same tile, the winner would be determined by the arbitrary iteration order of `world.query(MoveIntent)`. This introduces non-determinism and frustrating edge cases.

### 3. Transient Tag Scoping
The ECS architecture heavily relies on transient tags (`MovedThisTurn`, `DealtDamageThisTurn`, `Acting`) that are expected to exist only for the duration of a single actor's turn sequence. 
- In the current system, `TagCleanupSystem` wipes these tags during `Phase.CLEANUP` before the next actor's sequence begins. 
- Grouping them would cause these tags to overlap across multiple entities simultaneously. This would require systems like `ItemPickupSystem` or `PackCoordinatorSystem` to constantly verify *which* entity triggered the action, rather than simply querying for the existence of the tag.

## Conclusion
The current TurnManager loop:
1. **Pre-Turn** (Global: e.g. Heat dissipation)
2. **Player Action Sequence** (Gather -> Action -> Reaction -> Cleanup)
3. **Enemy 1 Action Sequence** (Gather -> Action -> Reaction -> Cleanup)
4. **Enemy 2 Action Sequence** (Gather -> Action -> Reaction -> Cleanup)
5. **Post-Turn** 

This design perfectly maps discrete turn-based game rules onto the continuous ECS pipeline without sacrificing performance. The verbosity in the logs is simply proof that the engine is deterministically isolating every actor's state changes, exactly as designed. No refactoring is necessary here.
