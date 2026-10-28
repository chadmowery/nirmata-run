# Phase 5 Research: Server Authority

## Standard Stack

*   **Framework**: **Next.js (API Routes)** - Use standard Node.js runtime routes (not Edge) to maintain stable in-memory session support during development and single-instance production.
*   **Validation**: **Zod** - The project already uses Zod for entity templates; reuse this for `ActionIntent` payloads and `StateDelta` validation to ensure type safety across the network boundary.
*   **State Deltas**: **`json-diff-ts`** - A high-performance, modern diffing library. It is preferred over `jsondiffpatch` for its smaller bundle size and better handling of object-based state (like our ECS stores).
*   **Session Management**: **`nanoid`** - For generating compact, URL-safe session IDs to track authoritative world state in a server-side `Map`.
*   **Serialization**: **Custom JSON-safe POJO format** - Since `World` and `Grid` use `Map` and `Set`, a manual serialization layer is required to convert these to standard JSON objects before sending/receiving.

## Architecture Patterns

*   **Pure Action Pipeline**: Extract movement, combat, and AI logic into a pure function `(world, grid, action) => StateDelta`. This function must be imported by both the client (for optimistic prediction) and the server (for authoritative validation).
*   **Single Round-Trip Turn Processing**: A single HTTP POST request handles the player's action intent AND all subsequent enemy turns. This minimizes network overhead and prevents the "cascading request" problem common in turn-based games.
*   **Authoritative In-Memory Session**: A server-side singleton `Map<SessionId, { world, grid }>` stores the current state of each active game. This avoids the latency of a database for the V1 tech demo.
*   **Snap-to-Truth Reconciliation**: Upon receiving a server delta, the client immediately overwrites its predicted state with the authoritative values. If a player is mid-animation, the sprite "snaps" to the server-confirmed position.
*   **Input Gating**: Disable player input while a server request is "in-flight". This simplifies reconciliation by ensuring only one action is ever being predicted/validated at a time.

## Don't Hand-Roll

*   **JSON Diffing/Patching**: Do NOT write a custom recursive object differ. Use `json-diff-ts`. It handles nested objects and provides a clean changeset format that is easy to apply.
*   **Payload Validation**: Do NOT use manual `if (typeof ...)` checks. Use Zod schemas. This allows you to generate TypeScript types directly from the validation logic.
*   **Unique ID Generation**: Do NOT use `Math.random()`. Use `nanoid` or the native `crypto.randomUUID()` to prevent session ID collisions.
*   **HTTP Communication**: Use the standard `fetch` API. Do NOT pull in heavy libraries like Axios unless complex interceptors are needed.

## Common Pitfalls

*   **Next.js Cold Starts**: On platforms like Vercel, serverless functions spin down after inactivity. Since state is in-memory, players will lose their game progress if they don't act for a few minutes. 
    *   *Mitigation*: For v1, document this as a limitation. For v2, move state to Redis.
*   **Serialization of Sets/Maps**: `JSON.stringify` ignores `Map` and `Set`. If you try to send the `Grid` or `World` directly, the payload will be empty.
    *   *Mitigation*: Implement `serializeWorld(world)` and `deserializeWorld(data)` helpers that convert to/from POJOs.
*   **Floating Point Desync**: If the client and server use different OS/environments, `0.1 + 0.2` might vary slightly.
    *   *Mitigation*: Since this is a grid-based game, use only integers for positions and stats.
*   **Client/Server Code Divergence**: If you modify `movement.ts` but forget to update the shared pipeline, the client will predict movements that the server rejects, causing "rubber-banding."
    *   *Mitigation*: Enforce the engine/game boundary strictly and run shared tests against both local and "simulated network" environments.

## Code Examples

### 1. Action Intent Schema (Shared)
```typescript
import { z } from 'zod';

export const ActionIntentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MOVE'), direction: z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST']) }),
  z.object({ type: z.literal('ATTACK'), targetId: z.number() }),
  z.object({ type: z.literal('PICKUP') })
]);

export type ActionIntent = z.infer<typeof ActionIntentSchema>;
```

### 2. World Serialization Helper
```typescript
export function serializeWorld(world: World) {
  return {
    entities: Array.from(world.entities),
    stores: Object.fromEntries(
      Array.from(world.stores.entries()).map(([key, store]) => [
        key,
        Object.fromEntries(store.entries())
      ])
    )
  };
}
```

### 3. Server API Route Skeleton
```typescript
// app/api/action/route.ts
export async function POST(req: Request) {
  const sessionId = req.headers.get('x-session-id');
  const body = await req.json();
  const action = ActionIntentSchema.parse(body);
  
  const state = sessionMap.get(sessionId);
  const { delta } = runActionPipeline(state.world, state.grid, action);
  
  return Response.json({ delta });
}
```
