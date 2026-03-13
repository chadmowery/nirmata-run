# Roguelike Dungeon Crawler Engine

## What This Is

A web-based 2D roguelike dungeon crawler engine built with PixiJS, React/TypeScript, and Next.js. It provides a classic turn-based dungeon crawling experience with server-authoritative state validation, optimistic client rendering, and a clean architectural separation between engine systems and game-specific logic. V1 delivers a playable tech demo proving every core system works end-to-end.

## Core Value

A solid, server-authoritative turn-based engine foundation where every player action is validated server-side while the client remains responsive through optimistic simulation — if this doesn't work, nothing built on top of it can be trusted.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Custom lightweight ECS with JSON-composable entities
- [ ] BSP-tree dungeon generation (configurable/swappable algorithm)
- [ ] Classic turn-based game loop via state machine pattern
- [ ] PixiJS tile-based rendering with camera centered on player
- [ ] Server-authoritative action validation (movement, attacks, items, abilities, purchases)
- [ ] Optimistic client simulation with server reconciliation
- [ ] Entity composition via builder patterns, factories, registries at runtime
- [ ] Clean separation: engine logic vs. game logic, data, UI, utilities
- [ ] Lightweight UI state management reflecting game state
- [ ] Tech demo: 60-second playable dungeon (player, enemy, combat, item pickup)

### Out of Scope

- Reusable engine as a standalone library — engine is an architectural boundary, not a distributable package
- Multiplayer — server validation is for anti-cheat in single-player context
- Advanced procedural generation (WFC, etc.) — BSP first, other algorithms pluggable later
- Persistent progression / save system — tech demo only
- Audio system — visual proof of concept first
- Mobile / touch input — desktop web only for v1

## Context

- **Rendering:** PixiJS handles tile-based rendering, particle effects, spritesheets. Camera is centered on the player; the map scrolls around a fixed viewport center.
- **Turn model:** Classic roguelike — nothing moves until the player acts. Player acts → enemies act → resolve → wait for next player input.
- **Client-server flow:** Player input → optimistic client update → server validates → authoritative state pushed to client → reconcile if diverged.
- **ECS philosophy:** Entities are IDs, components are plain data objects, systems are functions that query components. All entity definitions live in JSON; assembled at runtime through builders/factories/registries.
- **State management:** In-game rendered state uses a custom lightweight approach (event-driven or snapshot-based). UI layer uses a lightweight state library (zustand/jotai-tier) to reflect game state reactively.
- **Dungeon generation:** BSP tree for v1, but the generation interface should accept different algorithms so approaches can be swapped without touching consumers.

## Constraints

- **Stack**: PixiJS + React + TypeScript + Next.js — non-negotiable
- **Architecture**: Engine and game logic must be fully separated at the package/module level
- **Validation**: All player actions must round-trip through the server before becoming authoritative
- **Composability**: Every entity type must be definable in JSON, no hardcoded entity classes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Custom lightweight ECS over existing library (bitECS, miniplex) | JSON composability + builder pattern requirements don't align cleanly with opinionated ECS libs; need full control over the component/system pipeline | — Pending |
| BSP trees for initial dungeon gen | Simple, well-understood, produces reasonable room-and-corridor layouts; other algorithms pluggable via interface | — Pending |
| Server-authoritative with optimistic client | Anti-cheat for single-player without sacrificing responsiveness; establishes the right pattern even if scope grows later | — Pending |
| Next.js as backend | Unifies the stack; API routes handle validation; same TypeScript everywhere | — Pending |
| Turn-based (classic roguelike) | Simplifies state synchronization — discrete state transitions are easier to validate than continuous | — Pending |

---
*Last updated: 2026-03-13 after initialization*
