# Future Growth Guidance — Event Tier Assignment

When adding new events to the game, follow this classification hierarchy to ensure proper architectural layering and type safety.

## Classification Hierarchy

| Tier | Layer | Rule of thumb |
|------|-------|---------------|
| **EngineEvents** | `src/engine/` | ECS lifecycle & structural plumbing. No game semantics. Would exist in *any* ECS engine. |
| **GameplayEvents** | `src/shared/` | Gameplay-meaningful events that the authoritative pipeline and reconciliation need to emit or consume. Shared between client & server. |
| **GameEvents** | `src/game/` | Client-only, UI-bound, or rendering-specific events. Never emitted or consumed by server-side code. |

## Decision Heuristic

Ask: **"Does the server/pipeline need to emit or react to this event during authoritative action processing?"**

| Answer | Place it in |
|--------|-------------|
| Yes — it's part of the action→result data flow | `GameplayEvents` in `src/shared/events/types.ts` |
| No — it's a client-only UI/rendering signal | `GameEvents` in `src/game/events/types.ts` |
| No — it's pure ECS plumbing (create/destroy/component lifecycle) | `EngineEvents` in `src/engine/events/types.ts` |

## Examples of future events and where they'd go:

| Future Event | Recommended Tier | Why |
|-------------|-----------------|-----|
| `STATUS_EFFECT_APPLIED` | GameplayEvents | Server computes status effects during action processing |
| `ABILITY_COOLDOWN_TICK` | GameplayEvents | Energy/cooldown managed by authoritative pipeline |
| `INVENTORY_CHANGED` | GameplayEvents | Item adds/removes are authoritative |
| `QUEST_OBJECTIVE_UPDATED` | GameplayEvents | Quest state is server-authoritative |
| `TOOLTIP_SHOWN` | GameEvents | Pure UI interaction, no server relevance |
| `CAMERA_SHAKE` | GameEvents | Rendering effect, client-only |
| `ANIMATION_COMPLETED` | GameEvents | Render system lifecycle, client-only |
