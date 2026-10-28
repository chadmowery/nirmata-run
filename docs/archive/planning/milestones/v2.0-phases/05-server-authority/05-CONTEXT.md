# Phase 5: Server Authority - Context

**Gathered:** 2026-03-14
**Status:** Ready for research/planning

<domain>
## Phase Boundary

Moves the game from local-only execution to a validated client-server model using Next.js API routes. Delivers: Action intent pipeline, in-memory server sessions, authoritative state validation (movement, combat, items), server-side enemy turn processing, and optimistic client reconciliation with delta-based updates. Builds on the complete local gameplay systems from Phases 1-4.

</domain>

<decisions>
## Implementation Decisions

### Reconciliation & Visual Continuity
- **Snap-to-Truth:** When a server snapshot arrives, if an entity is in the middle of a tween, the tween is cancelled and the entity snaps to the server-authoritative position immediately.
- **Optimistic Message Log:** Messages are printed to the log immediately upon player action. If the server response contradicts the event (e.g., action rejected), the message is removed or "settled" to reflect the truth.
- **Instant Position Correction:** Player desyncs result in an instant snap back to the valid tile, rather than a corrective animation.
- **Strict Input Gating:** Input is locked while a server request is "in flight." The player can only perform one action per round-trip (classic turn-based feel).

### Server-Side State Lifecycle
- **In-Memory Sessions:** Authoritative world state lives in a server-side `Map<SessionId, WorldState>`. No database is used for V1; state is lost on server restart.
- **Delta Snapshots:** The server returns only the entities and components that changed during the action processing (overriding the original "full-state-replace" roadmap item).
- **Single Round-Trip Turn Processing:** A single POST request validates the player action AND processes all subsequent enemy turns until the next player-wait state. The response includes the full set of changes from both player and enemy turns.
- **Unoptimized Payloads:** For the V1 tech demo, we send full component data for changed entities without aggressive compression; the 30x30 dungeon size makes payload overhead negligible.

### Optimistic "Gating" & Side Effects
- **Predictive Combat:** Show "hit" visuals (flashes, lunge) immediately on the client. If the server rejects the hit or changes the damage amount, the client corrects the state upon reconciliation.
- **Snap-up Items:** Items are optimistically removed from the ground and added to the player's predicted inventory state immediately upon walking over them.
- **Snap-removal Death:** Entities that die are simply removed from the world when the authoritative delta arrives. No "late" animations are triggered if the death wasn't predicted.
- **Optimistic FOV:** The fog of war is revealed on the client as the player moves, without waiting for server confirmation of the new "visible" set.

### Validation Failure & Security
- **Silent Rubber-band:** Validation failures (e.g., walking into a wall that the server thinks is closed) result in a silent snap back to the last valid position. No "Error" message is shown to the user.
- **Always Recoverable:** Any desync is considered transient. The authoritative delta is the source of truth, and the client will always align with it, preventing "fatal" sync errors.
- **Developer-Only Logging:** Action rejections are logged to the browser console for debugging but are hidden from the in-game message log.
- **Soft Rejection:** "Invalid" or "cheating" actions (e.g., walking through walls) are ignored by the server, which simply returns the current (unmodified) state as the response.

### Claude's Discretion
- The specific mechanism for tracking "deltas" on the server (e.g., a "dirty" flag system or snapshot comparison).
- The JSON structure for the `ActionIntent` and `StateDelta` payloads.
- Session ID generation and management (e.g., cookie vs. header).
- Next.js API route structure and error handling.
- The `ActionPipeline` pure function's internal validation logic.

</decisions>

<specifics>
## Specific Ideas

- **Pivot to Delta:** The decision to use Delta updates is a significant architectural upgrade from the original roadmap. It requires the server to be able to identify what changed during the execution of a single player/enemy turn cycle.
- **Single Request Loop:** Processing the entire turn cycle (Player + all Enemies) in one request keeps the game feeling snappy despite the network hop.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/ecs`: Foundational ECS core is ready.
- `src/engine/turn`: Turn manager logic exists but needs to be adapted for server-side execution.
- `src/game/systems`: Combat, AI, and Movement systems are implemented as local systems and will need to be wrapped in the `ActionPipeline`.

### Established Patterns
- **Pure Action Pipeline:** The goal is to move the logic from `src/game/systems` into a pure function that can be imported by both the client (for prediction) and the server (for validation).
- **Zod Validation:** Already used in Phase 1 for templates; should be used for Action payloads.

### Integration Points
- **Next.js API Routes:** The primary entry point for the server authority.
- **Shared Directory:** `src/shared` (or similar) will be needed to hold the types and pipeline logic used by both environments.

</code_context>

<deferred>
## Deferred Ideas

- Persistent database storage (deferred to V2).
- Diff/Merge reconciliation (we are using "Snap-to-Truth" for simplicity).
- True multiplayer / lobby systems (out of scope).

</deferred>

---

*Phase: 05-server-authority*
*Context gathered: 2026-03-14*
