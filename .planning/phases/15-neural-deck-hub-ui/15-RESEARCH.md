# Phase 15: Neural Deck Hub UI — Research

**Researched:** 2026-04-05
**Phase Requirements:** HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, HUB-06, HUB-07, HUB-08

---

## RESEARCH COMPLETE

---

## 1. Current Architecture Assessment

### 1.1 Game State Machine

The `GameState` enum (`src/game/states/types.ts`) currently has 5 states: `Loading`, `MainMenu`, `Playing`, `Paused`, `GameOver`. Phase 15 adds `Hub` between `MainMenu` and `Playing`.

**Key integration points:**
- `page.tsx` uses `status === GameState.Playing` to trigger engine initialization — Hub must NOT trigger this
- `page.tsx` Effect 2 destroys engine on `status === GameState.MainMenu` — need to decide if returning to Hub destroys engine
- `GameState.Hub` rendering is purely UI (React) — no PixiJS canvas needed
- The `GAME_TRANSITIONS` array in `src/game/states/game-states.ts` defines valid state transitions — must be extended

**Proposed state flow:**
```
MainMenu → Hub → Playing → (death/extract) → Hub
```

### 1.2 Zustand Store Architecture

The `gameStore` (`src/game/ui/store.ts`, 260 lines) is a vanilla Zustand store. Hub state needs to be added here.

**Design decision: Single store vs. separate Hub store**
- **Recommendation: Extend existing `gameStore`** — the Hub needs to read `gameStatus` and wallet data that already lives here. A separate store would require cross-store subscriptions.
- Hub-specific fields are a clean `HubState` interface merged into `UIState`
- Hub state is reset when leaving Hub (transitioning to Playing)

**Store additions needed (from UI-SPEC §State Management):**
```typescript
interface HubState {
  activeTab: 'shell' | 'loadout' | 'workshop' | 'vault' | 'initialize';
  playerProfile: PlayerProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  selectedShellIndex: number;
  draggedItem: VaultItem | null;
  dragOverSlot: string | null;
  compilingBlueprintId: string | null;
  selectedRunMode: RunMode | null;
  modeAvailability: ModeAvailability | null;
  ritualActive: boolean;
  bootSequenceActive: boolean;
  hasOverflow: boolean;
  overflowCount: number;
}
```

### 1.3 API Surface Audit

All required backend endpoints exist and are operational:

| Endpoint | Method | Purpose | Hub Tab |
|----------|--------|---------|---------|
| `/api/vault/equip-from-vault` | POST | Equip item from Vault to Shell | LOADOUT |
| `/api/vault/move-to-vault` | POST | Move/unequip item to Vault | LOADOUT |
| `/api/vault/sell` | POST | Sell overflow item for Scrap | VAULT |
| `/api/vault/discard` | POST | Delete overflow item | VAULT |
| `/api/vault/overflow` | POST/GET | Get/clear overflow items | VAULT |
| `/api/economy/compile` | POST | Compile Blueprint (Flux) | WORKSHOP |
| `/api/economy/install` | POST | Install compiled item | WORKSHOP |
| `/api/economy/uninstall` | POST | Uninstall item | LOADOUT |
| `/api/economy/purchase` | POST | Buy Software (Scrap) | WORKSHOP |
| `/api/economy/upgrade` | POST | Upgrade Shell stat (Flux) | WORKSHOP |
| `/api/run-mode/available` | GET | List mode availability | INITIALIZE |
| `/api/run-mode/launch` | POST | Launch run in mode | INITIALIZE |
| `/api/leaderboard/daily` | GET | Daily leaderboard | INITIALIZE |
| `/api/leaderboard/weekly` | GET | Weekly leaderboard | INITIALIZE |
| `/api/session` | POST | Create game session | Boot sequence |

**Missing API: Profile fetch endpoint**
- CONTEXT.md D-08 specifies "Single fetch of full PlayerProfile on Hub mount"
- Currently there is NO `/api/profile` GET endpoint
- `profileRepository.load(sessionId)` exists server-side but isn't exposed as an API route
- **Action needed:** Create `/api/profile/route.ts` — GET endpoint that loads and returns full `PlayerProfile`

**Missing API: Shell templates endpoint**
- Hub SHELL tab needs all registered Shell templates with their stats to render the carousel
- Shell templates exist in `src/game/shells/templates/*.json` and are registered in `globalShellRegistry`
- **Action needed:** Create `/api/shells/route.ts` — GET endpoint returning all Shell templates and player's Shell records

### 1.4 Component Architecture

Existing UI components (`src/components/ui/`) use a consistent pattern:
- `'use client'` directive at top
- `useStore(gameStore, selector)` for state access
- Co-located CSS modules (`Component.module.css`)
- `styles` import from CSS module

Hub components live in `src/components/ui/hub/` subdirectory per UI-SPEC.

**Component count: 21 new components** (from UI-SPEC §Component Inventory)
- 5 tab content components (ShellTab, LoadoutTab, WorkshopTab, VaultTab, InitializeTab)
- 1 root layout (HubLayout)
- 1 tab bar (TabBar)
- 14 sub-components (ShellCarousel, ShellStatCard, LoadoutSlotPanel, StashItemList, SlotBox, ItemCard, ItemTooltip, BlueprintPanel, SoftwareShop, ShellUpgradePanel, VaultGrid, VaultOverflowBanner, RunModeCard, LeaderboardPanel, RitualOverlay, BootSequence)

### 1.5 CSS Design System

Existing tokens in `globals.css` (:root):
- **Colors:** `--vibrant-cyan: #00F0FF`, `--vibrant-pink: #FF0055`, `--safety-orange: #FF9500`
- **Semantic:** `--color-extract`, `--color-descend`, `--color-danger`, `--color-success`
- **Typography:** `--font-body`, `--font-size-*` (display/heading/body/label), `--font-weight-*`
- **Spacing:** `--space-xs` through `--space-2xl` (4px–48px)
- **Overlay:** `--overlay-bg: rgba(0, 0, 0, 0.90)`

New tokens needed (from UI-SPEC §CSS Custom Properties):
- Hub-specific sizing: `--hub-tab-height`, `--hub-slot-size`, `--hub-grid-columns`, `--hub-grid-gap`, `--hub-card-min-width`
- Semantic mode colors: `--color-mode-simulation`, `--color-mode-daily`, `--color-mode-weekly`
- Interaction colors: `--color-drop-valid`, `--color-drop-invalid`
- Animation tokens: `--transition-fast`, `--transition-standard`, `--transition-slow`, `--pulse-duration`

---

## 2. Technical Patterns & Considerations

### 2.1 Drag-and-Drop Implementation

CONTEXT.md D-14 specifies drag-and-drop only (no click fallback). Desktop-only per PROJECT.md.

**Options:**
1. **HTML5 Drag and Drop API** — Built-in, simpler, but limited visual customization of drag ghost
2. **Pointer Events (manual)** — Full control over drag visuals, custom ghost rendering, works better for slot-based UI

**Recommendation: Pointer Events (manual drag)**
- HTML5 DnD has poor ghost customization (can't easily style the drag preview)
- UI-SPEC requires "Ghost follows cursor at 80% opacity" — easier with pointer events
- Need slot highlighting (cyan/pink glow) during drag — pointer events give precise hit testing
- `onPointerDown` → set `draggedItem` in store → `onPointerMove` → update ghost position → `onPointerUp` → check drop target
- Keyboard fallback (UI-SPEC §Accessibility): Tab to item → Enter to "pick up" → Tab to slot → Enter to "place"

### 2.2 Shell Data Flow

**Challenge:** Shell templates are registered at import time in `src/game/shells/index.ts` using `globalShellRegistry`. This runs server-side. The Hub UI running client-side needs Shell data.

**Solution:**
1. New `/api/shells` endpoint returns: `{ templates: ShellTemplate[], records: ShellRecord[] }`
2. Hub fetches this on mount alongside PlayerProfile
3. Cross-references `profile.installedItems` with Shell `shellId` to show equipped items per Shell
4. Cross-references `profile.shellUpgrades[shellId]` to compute stat bonuses

### 2.3 Session Management

**Problem:** The current `page.tsx` creates a session via `POST /api/session` inside the `start()` function, which only runs when transitioning to `GameState.Playing`. The Hub needs a `sessionId` before that.

**Solution:**
- The Hub creates/loads its own session on mount via the existing profile system
- When launching a run, the Hub uses `/api/run-mode/launch` which creates the engine session internally
- The `sessionId` used for profile management (Hub) is the same one used for the run
- On initial Hub mount: check `localStorage` for existing sessionId, or create one via `/api/session`

### 2.4 Hub ↔ Game Lifecycle

**State transitions:**
```
MainMenu → Hub: setGameStatus(GameState.Hub)
Hub → Playing: run-mode/launch API → setGameStatus(GameState.Playing) → engine init
Playing → Hub (extract/death): RunResults → "Return to Deck" → setGameStatus(GameState.Hub)
Hub → MainMenu: (logout/back) → setGameStatus(GameState.MainMenu)
```

**Engine lifecycle:**
- Hub does NOT initialize PixiJS/engine — pure React UI
- Engine is only initialized when `GameState.Playing` is entered
- Returning to Hub from a run destroys the engine (like current return-to-menu behavior)
- `page.tsx` needs to handle `GameState.Hub` in the render tree — show `<HubLayout />` component

### 2.5 Profile Loading Strategy

CONTEXT.md D-08: "Single fetch of full PlayerProfile on Hub mount. All tabs read from local state."

**Implementation:**
1. `HubLayout` mounts → dispatches `loadProfile(sessionId)` store action
2. Store sets `profileLoading: true`, fetches `/api/profile?sessionId=...`
3. On success: sets `playerProfile` data, derives `hasOverflow` and `overflowCount`
4. On failure: sets `profileError` for error UI
5. Tab components read from `playerProfile` via selectors
6. Mutations (equip, compile, sell) call API → optimistically update `playerProfile` in store
7. On mutation failure: revert optimistic update, show error

### 2.6 Context-Dependent Default Tab

CONTEXT.md D-03: "After extraction/death, land on VAULT; from fresh session, land on SHELL."

**Implementation:**
- Store action `setActiveTab` on Hub mount
- Check if returning from a run: if `runResults` data exists → default to `'vault'`
- Otherwise → default to `'shell'`
- The choice happens in `HubLayout` on mount, using URL or store state

---

## 3. Dependency Analysis

### 3.1 Files Modified (Existing)

| File | Modification |
|------|-------------|
| `src/game/states/types.ts` | Add `Hub = 'Hub'` to `GameState` enum |
| `src/game/states/game-states.ts` | Add Hub transitions to `GAME_TRANSITIONS` |
| `src/app/page.tsx` | Add `GameState.Hub` rendering branch, modify Playing transition |
| `src/game/ui/store.ts` | Add Hub state fields and actions |
| `src/components/ui/MainMenu.tsx` | Change "Initialize Session" to transition to Hub |
| `src/app/globals.css` | Add Phase 15 CSS custom properties |
| `src/components/ui/RunResultsScreen.tsx` | Change "Return to Menu" to "Return to Deck" (Hub) |

### 3.2 Files Created (New)

**API routes:**
| File | Purpose |
|------|---------|
| `src/app/api/profile/route.ts` | GET — fetch full PlayerProfile |
| `src/app/api/shells/route.ts` | GET — fetch Shell templates and records |

**Hub components (all in `src/components/ui/hub/`):**
| File | CSS Module | Purpose |
|------|------------|---------|
| `HubLayout.tsx` | `HubLayout.module.css` | Root layout with tab bar and content area |
| `TabBar.tsx` | `TabBar.module.css` | 5-tab navigation with wallet |
| `ShellTab.tsx` | `ShellTab.module.css` | Shell inspection tab |
| `ShellCarousel.tsx` | `ShellCarousel.module.css` | Horizontal Shell switcher |
| `ShellStatCard.tsx` | `ShellStatCard.module.css` | Shell stats and Port display |
| `LoadoutTab.tsx` | `LoadoutTab.module.css` | Equipment management tab |
| `LoadoutSlotPanel.tsx` | `LoadoutSlotPanel.module.css` | Shell slot boxes (drop targets) |
| `StashItemList.tsx` | `StashItemList.module.css` | Scrollable item list with filters |
| `SlotBox.tsx` | `SlotBox.module.css` | Individual port slot |
| `ItemCard.tsx` | `ItemCard.module.css` | Draggable item card |
| `ItemTooltip.tsx` | `ItemTooltip.module.css` | Hover tooltip |
| `WorkshopTab.tsx` | `WorkshopTab.module.css` | Blueprint + shop + upgrades tab |
| `BlueprintPanel.tsx` | `BlueprintPanel.module.css` | Two-column compilation UI |
| `SoftwareShop.tsx` | `SoftwareShop.module.css` | Software purchasing |
| `ShellUpgradePanel.tsx` | `ShellUpgradePanel.module.css` | Shell stat/port upgrades |
| `VaultTab.tsx` | `VaultTab.module.css` | Vault management tab |
| `VaultGrid.tsx` | `VaultGrid.module.css` | 6x5 inventory grid |
| `VaultOverflowBanner.tsx` | `VaultOverflowBanner.module.css` | Overflow warning section |
| `InitializeTab.tsx` | `InitializeTab.module.css` | Run mode selection |
| `RunModeCard.tsx` | `RunModeCard.module.css` | Individual mode card |
| `LeaderboardPanel.tsx` | `LeaderboardPanel.module.css` | Ranked score list |
| `RitualOverlay.tsx` | `RitualOverlay.module.css` | Launch ceremony |
| `BootSequence.tsx` | `BootSequence.module.css` | Terminal boot animation |

---

## 4. Risk Assessment

### 4.1 High Risk

- **Drag-and-drop complexity:** Custom pointer-event-based drag system with slot validation, visual feedback (cyan/pink glow, shake animation, snap-back), and keyboard accessibility fallback. This is the most complex interaction pattern in the Hub. Mitigation: Isolate drag logic in a custom hook (`useDragAndDrop`) with clear state machine.

### 4.2 Medium Risk

- **Store size growth:** Adding Hub state to the existing gameStore increases its surface area significantly. Mitigation: Use precise selectors in components to avoid unnecessary re-renders.
- **Optimistic updates:** Mutations (equip/compile/sell/upgrade) update local state before server confirmation. Rollback on failure needs careful state management. Mitigation: Snapshot profile before mutation, revert on error.
- **Boot sequence timing:** The terminal boot animation must mask engine initialization time. If engine init takes longer than ~1.5s, the boot sequence needs to wait for completion. Mitigation: Use a Promise.race/Promise.all pattern — boot sequence plays for minimum 1.5s, but waits for engine ready if longer.

### 4.3 Low Risk

- **API endpoints:** All backend endpoints already exist and are tested. Only need 2 new simple GET routes.
- **CSS tokens:** Additive changes to globals.css, no conflicts with existing styles.
- **State transitions:** Adding Hub state to FSM is straightforward — well-established pattern.

---

## 5. Validation Architecture

### 5.1 Automated Verification

**TypeScript compilation:**
- `npx tsc --noEmit` must pass after all changes

**Component rendering:**
- Each Hub component should render without errors when given valid PlayerProfile data
- Test with empty profile (no items, no blueprints, no overflow)
- Test with full profile (30 vault items, overflow, multiple Shells, compiled blueprints)

**API integration:**
- Verify `/api/profile` returns valid PlayerProfile for existing sessionId
- Verify `/api/shells` returns Shell templates matching `src/game/shells/templates/*.json`

### 5.2 Manual Verification

**State flow verification:**
1. MainMenu → click "Enter Neural Deck" → Hub renders with SHELL tab
2. Navigate all 5 tabs — content renders correctly
3. SHELL tab: carousel navigates between Shells, stats display correctly
4. LOADOUT tab: drag items between Stash and Shell slots (requires test data)
5. WORKSHOP tab: compile Blueprint (requires Flux), purchase Software (requires Scrap)
6. VAULT tab: grid renders items, overflow banner shows when applicable
7. INITIALIZE tab: mode cards render, launch triggers Ritual → boot sequence → game
8. After death/extraction: RunResults → "Return to Deck" → Hub on VAULT tab

### 5.3 Acceptance Criteria Mapping

| Requirement | How to Verify |
|-------------|---------------|
| HUB-01 | Hub renders with Shell in maintenance rack view — ShellStatCard shows name, archetype, stats, ports |
| HUB-02 | Shell carousel navigates, stats include base + upgrade split, Port config visible |
| HUB-03 | LOADOUT tab: drag item from Stash to Shell slot succeeds, drag to incompatible slot rejects |
| HUB-04 | WORKSHOP tab: Locked Files section shows uncompiled blueprints, compile button works |
| HUB-05 | VAULT tab: grid shows items, sell/discard context menu works |
| HUB-06 | INITIALIZE tab: 3 mode cards render, launch opens Ritual overlay, confirm starts boot sequence |
| HUB-07 | All UI copy uses "Compile"/"Initialize" terminology per copywriting contract |
| HUB-08 | Hub uses Vibrant Decay palette: black background, cyan accents, pink accents, condensed typography |

---

*Research completed: 2026-04-05*
*Source: Codebase analysis of 25+ source files, 14 API endpoints, 3 Shell templates, UI-SPEC, CONTEXT.md*
