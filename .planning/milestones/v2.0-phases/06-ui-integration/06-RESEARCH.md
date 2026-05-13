# Phase 6 Research: UI & Integration

## Standard Stack

- **UI Framework:** React 19 (Latest) + Next.js (App Router).
- **State Management:** Zustand 5.x.
  - **Vanilla API:** Used by the engine/systems to update state without React hooks.
  - **React Hooks:** Used by UI components to subscribe to state slices.
- **Styling:** CSS Modules.
  - **Aesthetic:** "Classic Terminal" (Amber-on-Black or Green-on-Black).
  - **Typography:** Monospace fonts (e.g., `JetBrains Mono`, `Courier New`).
- **Icons:** `lucide-react` (for minimal, high-contrast icons).
- **Tooling:** `clsx` and `tailwind-merge` (if needed for utility-first styling, though CSS Modules are preferred for the retro look).

## Architecture Patterns

### 1. The Sync Bridge (Vanilla-to-React)
The core architecture follows a "Push" model where the engine drives the UI state.
- **The Store:** A singleton Zustand store created via `createStore` (vanilla).
- **The Listener:** A dedicated `syncEngineToStore(context)` function is called during game initialization. It attaches listeners to the `EventBus`.
- **The Trigger:** When a `DAMAGE_DEALT` or `TURN_START` event occurs, the listener queries the `World` for the latest stats and calls `store.setState()`.

### 2. Message Log Collapsing
To prevent log spam, the store logic should handle message merging:
- Store state: `messages: Array<{ id: string, text: string, count: number, type: 'info' | 'combat' | 'error' }>`.
- When adding a message: If `newMsg.text === lastMsg.text`, increment `lastMsg.count` instead of pushing.

### 3. Focus Management & Input Bridge
- **Priority:** The PixiJS canvas holds keyboard focus by default.
- **Input Forwarding:** UI buttons (e.g., "Wait") call `gameContext.inputManager.dispatchAction(action)`.
- **Strict Mode Guard:** `InputManager.enable()` must be idempotent to handle React 18+ double-mounting in dev.

### 4. Tooltip Coordinate Mapping
- **UI-to-World:** To show a tooltip over a sprite when hovering a UI list item:
  1. Get `entityId` from UI item.
  2. Get `sprite` from `SpriteMap`.
  3. Use `sprite.getGlobalPosition()` to get screen coordinates.
  4. Position a fixed-position React `div` at those coordinates.

## Don't Hand-Roll

- **State Management:** Do not use `useContext` or custom event listeners for global state. Use Zustand.
- **Event Bus:** Use the existing `src/engine/events/EventBus.ts`. Do not create a second one for the UI.
- **Scroll Logic:** Use standard CSS `overflow-y: auto` and `flex-direction: column-reverse` (or `scrollTo` refs) for the message log.
- **Animations:** Use CSS Transitions for UI fades/slides. Game world animations stay in PixiJS.

## Common Pitfalls

- **Zustand Selectors:** Failing to use selectors (`useStore(store, s => s.health)`) will cause the entire UI to re-render on every turn change. **Always use granular selectors.**
- **Strict Mode Lifecycle:** Mounting the `createGame` instance multiple times will leak event listeners and WebGL contexts. Ensure `destroyGame()` cleanup is thorough.
- **Z-Index Fighting:** Ensure the React UI overlay has a higher z-index than the PixiJS canvas, but doesn't block mouse events on the canvas (use `pointer-events: none` on the overlay container and `pointer-events: auto` on interactive elements).
- **Coordinate Desync:** Tooltips will "lag" if positioned in React while the PixiJS camera is lerping. Update tooltip positions via `requestAnimationFrame` or by syncing them to the `RenderSystem` tick.

## Code Examples

### Vanilla Store Definition
```typescript
import { createStore } from 'zustand/vanilla';

interface GameState {
  playerHealth: { current: number; max: number };
  messages: string[];
  setHealth: (current: number, max: number) => void;
  addMessage: (text: string) => void;
}

export const gameStore = createStore<GameState>((set) => ({
  playerHealth: { current: 0, max: 0 },
  messages: [],
  setHealth: (current, max) => set({ playerHealth: { current, max } }),
  addMessage: (text) => set((state) => ({ 
    messages: [...state.messages.slice(-49), text] 
  })),
}));
```

### React Consumption
```tsx
import { useStore } from 'zustand';
import { gameStore } from './store';

export function HUD() {
  const health = useStore(gameStore, (s) => s.playerHealth);
  return <div className="health-bar">HP: {health.current} / {health.max}</div>;
}
```

### Engine Sync
```typescript
// src/game/ui/sync.ts
export function syncUI(context: GameContext) {
  context.eventBus.on('DAMAGE_DEALT', (ev) => {
    if (ev.defenderId === context.playerId) {
      const health = context.world.getComponent(ev.defenderId, Health);
      gameStore.getState().setHealth(health.current, health.max);
    }
  });
}
```

## Confidence & Verification

- **Zustand Vanilla Integration:** High Confidence (Standard documented pattern for non-React contexts).
- **React 19 + Next.js:** High Confidence (Primary target for this architecture).
- **Coordinate Mapping:** Medium Confidence (Depends on the exact scale/zoom of the PixiJS stage; coordinate transforms may require careful handling of `app.stage.scale`).
- **Performance:** High Confidence (Zustand selectors effectively mitigate re-render cascades in 60fps environments).
- **Message Log Collapsing:** High Confidence (Common pattern in roguelikes like *Tales of Maj'Eyal* and *DCSS*).
