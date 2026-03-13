# Feature Landscape

**Domain:** Web-based 2D Roguelike Dungeon Crawler Engine (ENGINE systems, not game content)
**Researched:** 2026-03-13
**Scope:** V1 Engine Core + Tech Demo (60-second playable dungeon: player, enemy, combat, item pickup)

---

## Table Stakes

Features the engine doesn't function without. Missing any of these = the tech demo can't run.

### Core Infrastructure

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **ECS Core Runtime** | Everything in the engine is built on this. Entities as IDs, components as plain data, systems as functions. Component add/remove, entity lifecycle, system registration & ordered execution, archetype/tag queries. | HIGH | Foundational — nothing works until this works. JSON composability requirement adds complexity over minimal ECS. |
| **Entity Composition Pipeline** | JSON entity definitions → runtime entity assembly via builders/factories/registries. Template composition (e.g., "goblin" = Position + Health + AI + Sprite + Melee). Component validation at assembly time. | MEDIUM-HIGH | Depends on ECS Core. Zod validation on JSON schemas. This is what makes the engine data-driven rather than hardcoded. |
| **Event Bus / Message System** | Decouples systems. Combat system emits `damage_dealt`, death system listens — neither knows about the other. Events: `entity_died`, `item_picked_up`, `damage_dealt`, `turn_started`, `turn_ended`, `fov_changed`. | LOW-MEDIUM | eventemitter3 or hand-rolled typed emitter. Keep events as plain data objects. Systems subscribe, not entities. |
| **Game State Machine** | Controls what runs and when. States: Loading → MainMenu → Playing → Paused → GameOver. Each state defines which systems execute (rendering always runs, AI only in Playing, input blocked in GameOver). Enter/exit hooks for setup/teardown. | MEDIUM | Without this, there's no way to pause, no menu, no game-over screen. State transitions drive the entire application flow. |

### Gameplay Loop

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Turn Manager** | The heartbeat of a roguelike. Player acts → process player action → each enemy gets a turn → resolve effects → wait for next input. Must handle turn phases: pre-turn (status tick), action, post-turn (cleanup). Even v1 needs a basic turn queue. | MEDIUM | Classic roguelike: nothing happens until player acts. Simple round-robin for v1 (player → all enemies → repeat). Energy/speed system is a differentiator upgrade. |
| **Grid / Tilemap Data System** | The world is a 2D grid. Tile types (wall, floor, door), walkability queries, entity-at-position lookups, multi-layer support (terrain layer, entity layer, item layer). Spatial indexing for queries like "what's at (5,3)?" | LOW-MEDIUM | Flat 2D array or Map<string, Tile>. Performance matters — FOV and pathfinding hit this constantly. Separate from rendering; this is the authoritative world data. |
| **Dungeon Generation Pipeline** | BSP tree algorithm for v1. Room carving, corridor placement, door insertion, spawn point selection (player start, enemy positions, item locations). Must output a populated Grid. | HIGH | Algorithm itself is well-understood (binary space partitioning). Complexity comes from the interface design — must accept different algorithms via a common contract so BSP can be swapped for cellular automata, drunkard's walk, etc. later. Seed-based via rot-js RNG for reproducibility. |
| **Movement System** | Grid-based cardinal movement (4-directional for v1, 8-directional is easy to add). Collision detection against walls and other entities. Bump-to-attack: moving into an enemy tile triggers combat instead of movement. | LOW | Simple: check destination tile walkability + entity occupancy. The bump-to-attack convention is core roguelike UX — it's not an optional interaction, it's how combat initiates. |
| **Input System** | Keyboard event capture → action abstraction. Maps keys to semantic actions (ArrowUp → `MOVE_NORTH`, not ArrowUp → `move(0, -1)`). Rebindable action map. Input gating: ignore input during turn processing or animations. | LOW | Thin layer. Capture `keydown`, map through action table, dispatch to game loop. Must suppress browser defaults (arrow key scrolling). Action-based abstraction keeps input decoupled from game logic. |

### Rendering & View

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Tile Rendering System** | PixiJS + @pixi/tilemap. Renders the grid to screen. Layer ordering: terrain → items → entities → effects. Spritesheet/atlas loading via PixiJS Assets. Only re-renders tiles that changed (dirty flagging or full redraw per turn — turn-based means this is cheap). | MEDIUM-HIGH | @pixi/tilemap handles batched GPU rendering. Complexity is in the integration: ECS render system must sync PixiJS display objects with ECS entity state every turn. Sprite lookups from component data (entity has `sprite: "goblin_idle"`). |
| **Camera System** | Viewport centered on player entity. The map scrolls; the player stays at screen center. Viewport culling: only submit visible tiles to the renderer. Handles maps larger than the screen. | LOW-MEDIUM | PixiJS container positioning. Calculate offset so player's grid position maps to viewport center. Culling = only add tiles within viewport bounds to the tilemap batch. Snap-to-grid for v1; smooth scrolling is a differentiator. |
| **FOV / Visibility System** | Field of view via recursive shadowcasting (rot-js `FOV.RecursiveShadowcasting`). Three tile visibility states: **visible** (in current FOV), **explored** (previously seen, dimmed), **hidden** (never seen, black). Fog of war rendering. | MEDIUM | rot-js provides the algorithm. Engine complexity is in: (1) updating visibility components on tiles each turn, (2) rendering three visual states (full brightness, dimmed tint, not rendered), (3) entities only visible when their tile is in FOV. This is what makes a dungeon feel like a dungeon. |

### Combat & AI

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Combat System (Basic)** | Attack resolution: attacker's attack vs defender's defense → damage. Health component tracking. Death handling: entity removal, event emission (`entity_died`), optional loot drop. Damage numbers or feedback. | MEDIUM | Keep the formula simple for v1 (attack - defense = damage, minimum 1). The system processes `AttackAction` events. Death triggers cleanup: remove entity from grid, remove PixiJS display object, emit event for UI log. |
| **AI System (Basic)** | Enemy behavior: idle (wander or wait), chase (move toward player), attack (bump-attack when adjacent). FOV-aware: enemies only chase when they can see the player. Pathfinding via rot-js A*. Basic state per enemy (idle/chasing). | MEDIUM-HIGH | Each enemy runs its AI on its turn. Needs: FOV check ("can I see the player?"), pathfinding ("how do I reach the player?"), action selection ("am I adjacent? attack. Otherwise? move along path."). Even "basic" AI has many edge cases (blocked paths, multiple enemies competing for positions). |
| **Item Pickup System** | Walk-over-to-collect or bump-to-collect items. Item → inventory (if inventory exists) or immediate effect (health potion heals on pickup). Required by tech demo spec: "item pickup." | LOW-MEDIUM | Minimal for v1: items are entities on the ground with an `Item` component. Pickup trigger adds to a simple inventory list or applies effect immediately. |

### Network / Authority

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Server-Authoritative Action Pipeline** | Client sends action intent (e.g., `{ type: "move", direction: "north" }`) → Next.js API route validates (is the tile walkable? is it the player's turn?) → applies to authoritative state → returns result. All game-state-changing actions go through this. | HIGH | This is the architectural centerpiece. Actions: move, attack, pickup, use-item. Server holds authoritative game state. Validation = re-check every precondition. Must be stateless per-request or use server-side session state. |
| **Optimistic Client Simulation** | Client predicts action result immediately (move the sprite, show damage) before server responds. If server confirms, no visible change. If server rejects, roll back to server state. Keeps the game feeling responsive despite round-trip latency. | HIGH | Complexity: maintaining a "pending" state, detecting server rejection, rolling back cleanly without visual glitch. For turn-based games, latency is less critical than real-time — but optimistic updates still matter for perceived responsiveness. |
| **State Reconciliation** | When server response arrives, compare authoritative state with predicted client state. If they match, discard prediction. If they diverge, snap client to server state. Handle edge cases: what if player moved optimistically but server says "enemy was there"? | MEDIUM-HIGH | Depends on how state is structured. Simplest approach for turn-based: server returns full relevant state slice after each action, client replaces its state. More sophisticated: delta-based reconciliation. For v1, full-state-replace is fine — state is small. |

### UI Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **UI State Bridge (Engine → React)** | Engine systems write to Zustand stores after each turn. Stores: player health/stats, message log entries, inventory contents, current game state. React UI subscribes and re-renders. Unidirectional: engine → store → React. User input goes React → input system → engine (not through stores). | LOW-MEDIUM | Zustand's vanilla `createStore` API is key — engine writes `setState()` without React hooks. Keep stores domain-scoped: `playerStore`, `messageStore`, `gameStateStore`. Don't mirror entire ECS state — only what the UI needs to display. |
| **HUD System** | Display player health, basic stats, current dungeon level. Minimal but required — player needs feedback. React components reading from Zustand stores. | LOW | Simple React components. Health bar, maybe XP or level. Updates on `playerStore` changes. |

---

## Differentiators

Features that elevate the engine beyond minimum viable. Not expected for a bare-bones tech demo, but add significant value. **Recommended: pick 2-3 for v1 to make the demo feel polished.**

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Energy/Speed System** | Replaces simple round-robin turns with speed-weighted turn ordering. Fast enemies act more often, slow enemies less. Enables haste/slow effects. Makes encounters tactically richer — a core roguelike differentiator. | MEDIUM | Each entity has `energy` component. Each tick, entities gain energy equal to their `speed`. When energy ≥ threshold, entity takes a turn. Simple to implement, dramatically changes gameplay feel. **Recommended for v1** — round-robin feels flat. |
| **Animation / Tween System** | Smooth movement between tiles (lerp over ~100ms), attack animations (sprite shake/flash), death animations (fade out), hit particles. Input gating during animations prevents action queuing. | MEDIUM-HIGH | Without this, entities teleport between tiles — functional but ugly. Even simple tweens (slide sprite from tile A to tile B) make the game feel 10x more polished. Use PixiJS ticker + simple easing functions. **Recommended for v1.** |
| **Message Log System** | Scrollable text log: "You hit the Goblin for 5 damage." "The Goblin dies." "You pick up a Health Potion." Categorized messages (combat, discovery, system). | LOW | Trivial to implement: array of message objects, React component renders last N. Events push messages. High UX value for low cost. **Recommended for v1.** |
| **Status Effect System** | Buffs/debuffs as components: poison (damage per turn), stun (skip turn), strength boost (temporary attack increase). Duration tracking, stacking rules, tick processing in pre-turn phase. | MEDIUM | Adds tactical depth to combat. Component-based: `StatusEffect { type, duration, magnitude, stackable }`. System processes each turn: decrement duration, apply effect, remove when expired. |
| **Interaction System** | Generic `Interactable` component. Doors (open/close, optionally locked/keyed), stairs (level transition trigger), chests (contain items). Bump-to-interact or explicit interact action. | MEDIUM | Extends the bump-to-X pattern: bump wall = nothing, bump enemy = attack, bump door = open. Adds environmental interaction beyond empty rooms and corridors. |
| **Inventory & Equipment System** | Inventory: ordered list of held items with capacity limit. Equipment: slots (weapon, armor, ring) that modify stats. Use/equip/unequip/drop actions. Required for meaningful item gameplay beyond "potion heals on pickup." | MEDIUM | Component: `Inventory { items: EntityId[], capacity: number }`, `Equipment { slots: Record<SlotType, EntityId> }`. Systems: pickup adds to inventory, equip moves from inventory to slot and applies stat modifiers. |
| **Ability / Targeting System** | Actions beyond bump-attack. Ranged attacks, area-of-effect abilities, self-targeted abilities. Targeting modes: single-tile, directional, area. Requires cursor/selection UI for target picking. | HIGH | Significant complexity: targeting UI (highlight valid targets), range validation, area calculation, server validation of target legality. High gameplay value but large implementation surface. Defer unless combat depth is a v1 priority. |
| **Minimap** | Small overview showing explored dungeon layout, player position, stairs/exits. Renders from explored tile data. | LOW-MEDIUM | Separate small canvas or PixiJS container. Reads from the same grid/FOV data. Nice polish, low risk. |
| **Debug / Inspector Tools** | Entity inspector: click entity → see all components. FOV overlay: visualize shadowcasting. Pathfinding overlay: show A* paths. God mode: invincible, see all. Map reveal. Teleport. Turn-by-turn step mode. | MEDIUM | Development velocity multiplier. Not user-facing but dramatically speeds up debugging ECS state, AI behavior, generation output. Build incrementally as issues arise. |
| **Procedural Generation Config Interface** | Expose generation parameters: room size ranges, corridor width, enemy density, item density, room count. Configurable via JSON. Enables creating diverse dungeon experiences without code changes. | LOW-MEDIUM | BSP already needs parameters — this is about exposing them cleanly. Seed + config → deterministic dungeon. Enables automated testing of generation too. |
| **Smooth Camera** | Lerp camera position when player moves instead of snapping. Subtle but makes movement feel fluid. Camera shake on damage/impact events. | LOW | Simple tween on camera container position. Small effort, nice feel. |

---

## Anti-Features

Things to **deliberately NOT build** for v1. Each has a clear reason. Resist scope creep.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Audio System** | Explicitly out of scope per project definition. Audio integration is a separate concern with its own asset pipeline, browser autoplay restrictions, and spatial audio complexity. | Defer entirely. Design event bus so audio hooks can subscribe later — but build zero audio infrastructure now. |
| **Save / Load / Serialization** | Tech demo runs once for 60 seconds. Serializing full ECS state is a non-trivial problem (entity references, component cycles, version migration). | Skip. If state needs debugging, use the debug inspector. Save system is a future milestone. |
| **Multiplayer / Real-time Sync** | Server-authoritative is for anti-cheat in single-player. Multiplayer requires fundamentally different networking (WebSockets, tick synchronization, conflict resolution, bandwidth management). | Use HTTP request/response for action validation. The architecture supports upgrading to WebSockets later, but don't build the infrastructure now. |
| **Advanced Procedural Generation (WFC, cellular automata, etc.)** | BSP is well-understood and sufficient for v1. Wave Function Collapse is significantly more complex to implement correctly and debug. | Build the generator interface so algorithms are swappable. Implement BSP only. Other algorithms are future milestones. |
| **Mobile / Touch Input** | Desktop web only. Touch input requires virtual d-pad, gesture recognition, responsive UI layout, touch event handling — all orthogonal to engine validation. | Keyboard input only. Don't add touch event listeners, don't make UI responsive. |
| **Character Creation / Classes / Races** | Game content, not engine systems. The engine provides components and systems. What specific components exist on a "Warrior" vs "Mage" is game data loaded from JSON. | The entity composition pipeline handles this. Character templates are just JSON entity definitions — no special engine support needed. |
| **Skill Trees / Talent Systems / Leveling** | Game content layered on top of the status effect and stat systems. Significant UI complexity (tree visualization, prerequisite logic, point allocation). | If the engine has components and stat modifiers, skill trees are game-level JSON data + UI. Not an engine concern for v1. |
| **Quest / Objective System** | Game content. Tracking objectives, triggers, completion conditions — this is content pipeline, not engine infrastructure. | Not relevant to a 60-second tech demo. |
| **Dialogue / NPC Conversation System** | Game content. Dialogue trees, branching logic, NPC state — content system, not engine. | No NPCs in v1 tech demo. |
| **Crafting System** | Game content. Recipe definitions, material tracking, result generation — content feature. | Not relevant to tech demo scope. |
| **Item Modifiers / Enchantments / Affixes** | Complex game content (prefix/suffix system, modifier stacking, rarity tiers). Requires significant data modeling and UI. | Items in v1 are simple: "Health Potion: heals 10 HP." Modifier systems are a future content layer. |
| **Multiple Dungeon Floors / World Map** | V1 is a single-floor tech demo. Floor transitions require state management (preserve previous floors? regenerate?), stairs linking, difficulty scaling. | Generate one dungeon. Play it. Demo ends. Multi-floor is a future milestone. |
| **Persistent Meta-progression (Roguelite unlocks)** | Roguelite feature (unlock new items across runs). Requires persistence layer, unlock tracking, meta-currency — none relevant to engine validation. | Not building a roguelite. Classic roguelike: each run is self-contained. |
| **Modding API / Plugin System** | Engine is an architectural boundary, not a distributable package. Building a stable public API for modders is enormous surface area. | JSON entity definitions provide data-driven extensibility. That's sufficient. No formal plugin contracts. |
| **Replay System** | Recording and replaying action sequences. Requires deterministic simulation, action log serialization, playback UI. | Cool but not needed to validate the engine works. Defer. |
| **Accessibility (Screen reader, high contrast, etc.)** | Important but post-v1 polish. Requires research into canvas accessibility (ARIA live regions, semantic overlays), colorblind-safe palettes, font scaling. | Note as a future milestone. Don't ignore permanently — but don't block v1 on it. |
| **Localization / i18n** | No user-facing text content worth localizing in a tech demo. i18n infrastructure adds string indirection overhead everywhere. | All v1 text is English developer-facing debug output. |
| **Tutorial / Onboarding System** | Game content for teaching players. Tech demo audience is the developer — they know how to play. | Skip entirely for v1. |

---

## Feature Dependencies

```
ECS Core Runtime
├── Entity Composition Pipeline (assembles entities from JSON into ECS)
├── Event Bus (systems communicate through events)
├── Grid / Tilemap Data (world data as components)
│   ├── Dungeon Generation Pipeline (populates the grid)
│   ├── Movement System (queries grid for walkability)
│   │   └── Combat System (bump-to-attack triggers from movement)
│   ├── FOV / Visibility System (raycasts against grid)
│   │   ├── AI System (FOV-aware enemy behavior)
│   │   │   └── Pathfinding [rot-js] (AI uses A* on grid)
│   │   └── Tile Rendering (fog of war states from FOV)
│   └── Item Pickup System (items on grid tiles)
├── Tile Rendering System (syncs PixiJS with ECS state)
│   └── Camera System (viewport positioning)
└── Game State Machine (controls which systems run)
    └── Turn Manager (orchestrates action within Playing state)
        ├── Movement System (processes during turn)
        ├── Combat System (processes during turn)
        ├── AI System (enemy turns)
        └── [Status Effect System] (ticks in pre-turn phase)

Server-Authoritative Pipeline (parallel to client systems)
├── Movement validation
├── Combat validation
├── Item pickup validation
└── State Reconciliation (compares server result with client prediction)

UI State Bridge (reads from ECS/events, writes to Zustand)
├── HUD System (React, reads player store)
└── [Message Log] (React, reads message store)

[Animation System] (hooks into rendering, gates input)
├── Tile Rendering System (animates sprites)
└── Input System (blocks input during animation)
```

`[Brackets]` = differentiator, not required for minimum viable.

### Critical Path

The dependency chain that must be built first, in order:

1. **ECS Core Runtime** — nothing works without it
2. **Grid / Tilemap Data** — the world
3. **Entity Composition Pipeline** — populate the world from JSON
4. **Game State Machine** — control flow
5. **Input System** — player can act
6. **Turn Manager** — process player actions
7. **Movement System** — player can move
8. **Tile Rendering + Camera** — player can SEE (parallelizable with 5-7 if rendering is decoupled)
9. **FOV / Visibility** — fog of war
10. **Combat System** — player can fight
11. **AI System + Pathfinding** — enemies fight back
12. **Dungeon Generation** — real levels instead of test grids
13. **Item Pickup** — minimal item interaction
14. **Server-Authoritative Pipeline** — validate everything
15. **Optimistic Client + Reconciliation** — responsive despite server round-trip
16. **UI Bridge + HUD** — display game state in React
17. **Event Bus** — decouple systems (can be woven in incrementally)

Note: Event Bus is listed last but in practice should be introduced early (step 2-3) as a lightweight utility that systems adopt incrementally. The numbered order reflects when each system must be *functional*, not when code is first written.

---

## MVP Recommendation

For a 60-second tech demo proving every core system works end-to-end:

**Prioritize (all table stakes):**
1. ECS Core + Entity Composition — the foundation
2. Grid + BSP Dungeon Generation — the world
3. Game State Machine + Turn Manager — the loop
4. Movement + Collision — player moves
5. FOV + Fog of War — dungeon atmosphere
6. Combat (basic bump-to-attack) — player fights
7. AI (chase + attack) — enemies fight back
8. Item Pickup (immediate-effect items) — health potions
9. Tile Rendering + Camera — see the game
10. Server-Authoritative Pipeline + Optimistic Client — the architectural bet
11. UI Bridge + HUD — health bar, basic info

**Add 3 differentiators for polish (recommended):**
1. **Message Log** — LOW complexity, HIGH user feedback value. "You hit the Goblin for 5."
2. **Animation/Tween System** — MEDIUM complexity, transforms the feel from "prototype" to "game." Even 100ms slide tweens between tiles.
3. **Energy/Speed System** — MEDIUM complexity, replaces flat round-robin with tactical depth. Fast rats, slow ogres.

**Defer everything else.** Especially defer: Ability/Targeting System (HIGH complexity, low v1 ROI), Inventory/Equipment (MEDIUM complexity, not needed if items are immediate-effect), Status Effects (cool but not needed for 60-second demo).

---

## Sources

- Domain knowledge: Classic roguelike design patterns (Brogue, DCSS, Cogmind, Caves of Qud architecture discussions)
- rot-js feature set (FOV, pathfinding, RNG): standard roguelike toolkit — HIGH confidence
- PixiJS rendering patterns: validated in STACK.md research — HIGH confidence
- Server-authoritative patterns: standard game networking architecture adapted for turn-based — HIGH confidence
- ECS patterns: well-established in game engine design (Unity DOTS, Bevy ECS, custom lightweight implementations) — HIGH confidence
- Turn-based game loop patterns: standard roguelike implementation (energy systems, round-robin) — HIGH confidence
