# Phase 6: UI & Integration - Context

**Gathered:** 2026-03-14
**Status:** Ready for research/planning

<domain>
## Phase Boundary

React UI layer presents game state reactively; complete tech demo is playable end-to-end. Delivers: Zustand state bridge, monolithic `useGameStore` with event-driven updates, HUD with dynamic buffs and stat bars, clickable message log with tooltips, main menu/game over screens, and the final 60-second tech demo integration. Builds on the server-authoritative engine from Phase 5.

</domain>

<decisions>
## Implementation Decisions

### React-Engine Bridge & Synchronization
- **Monolithic `useGameStore`:** A single Zustand store holds all reactive UI state (player stats, log, visible entities, UI metadata). This simplifies state synchronization for the V1 tech demo.
- **Event-Driven Updates:** The engine's `EventBus` is the sole driver for store updates. Systems emit specific events (e.g., `PLAYER_STAT_CHANGED`, `ENTITY_SPOTTED`) which the store listeners pick up to sync state.
- **Filtered Entity Mirror:** The engine maintains a list of "relevant" entities (those currently in the player's FOV) and pushes this subset to the Zustand store for HUD display (e.g., a "Nearby Enemies" list).
- **Input System Bridge:** UI interactions (like clicking a "Wait" button) are routed through the `InputSystem`. This ensures UI actions are mapped to the same semantic actions as keyboard input, preserving the action pipeline's integrity.

### HUD Depth & Interactive Elements
- **Dynamic Status Display:** The HUD shows core bars (HP/XP) and dynamically displays icons for active status effects or buffs/debuffs as they are applied.
- **Clickable Log/Lists:** Log entries and entity lists are interactive. Clicking an entity name in the log selects or highlights that entity on the PixiJS map.
- **Cross-Layer Tooltips:** Hovering an entity in the UI (e.g., in the "Nearby" list) triggers a tooltip or "pop-up" info box on the PixiJS canvas near that entity's sprite.
- **Classic Terminal Aesthetic:** The UI follows a "Retro Roguelike" theme: monospace fonts, high-contrast borders (e.g., double-line ASCII style), and a minimal, punchy color palette.

### Message Log & Tech Demo Flow (Defaults)
- **Log Retention:** The message log retains the last 50 messages. Identical consecutive messages are collapsed (e.g., "The goblin hits you x3").
- **Seamless Transitions:** "Start Game" triggers an immediate transition from the menu to the generated dungeon. "Game Over" shows a summary of the run (turns survived, enemies killed) before offering the "Restart" option.
- **Focus Management:** The PixiJS canvas maintains primary focus for keyboard input, but the UI is accessible via mouse-clicks for inspection and log interaction.

### Claude's Discretion
- Specific layout of the HUD components (sidebar vs. bottom bar).
- CSS-in-JS or CSS Modules strategy for the "Classic Terminal" styling.
- The exact Z-index and positioning of the PixiJS tooltips triggered by the UI.
- Transition animations between game states (MainMenu -> Playing).

</decisions>

<specifics>
## Specific Ideas

- **UI-to-Pixi Tooltips:** This creates a tight integration between the DOM layer (React) and the WebGL layer (PixiJS), making the world feel cohesive despite the tech split.
- **Event-Driven Store:** Avoids the overhead of polling the engine state, ensuring the UI only re-renders when something meaningfully changes.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/events`: Typed `EventBus` will be the primary source for Zustand store updates.
- `src/game/input`: Will be extended to accept "Action Dispatches" from the React UI.
- `src/rendering`: Camera and coordinate conversion utilities will be needed to position tooltips correctly based on UI hovers.

### Established Patterns
- **No Engine-to-React Imports:** The engine must remain unaware of React/Zustand; all communication is via the `EventBus` listener in the React layer.
- **Monospace Theming:** The "Classic Terminal" look aligns with the geometric placeholder sprites established in Phase 3.

### Integration Points
- **Next.js `page.tsx`:** The main entry point where the PixiJS `Renderer` and the React HUD are mounted side-by-side.
- **Zustand Vanilla Store:** Created outside of React components to allow engine-side event listeners to update it.

</code_context>

<deferred>
## Deferred Ideas

- Advanced log filtering (Combat vs. System) - deferred to V2.
- Interactive inventory management - deferred to V2.
- Mobile/Touch UI layout - explicitly out of scope for V1.

</deferred>

---

*Phase: 06-ui-integration*
*Context gathered: 2026-03-14*
