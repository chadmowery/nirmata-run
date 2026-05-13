# Phase 15: Neural Deck Hub UI - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Between-run management interface (the "Neural Deck Hub") that lets the player prepare, customize, and launch runs. Covers: Shell inspection/selection with stat card display, equipment management via drag-and-drop onto Port slots, Blueprint compilation workshop with Software shop and Shell upgrades, Vault inventory grid with overflow management, run mode selection with leaderboard display, and the pre-run Ritual launch ceremony. All backed by existing Phase 13/14 API endpoints.

</domain>

<decisions>
## Implementation Decisions

### Hub Navigation Structure
- **D-01:** Tabbed top bar with 5 tabs: `SHELL` / `LOADOUT` / `WORKSHOP` / `VAULT` / `INITIALIZE`. Full sci-fi naming per HUB-07.
- **D-02:** Wallet (Scrap + Flux) embedded in the tab bar, always visible regardless of active tab.
- **D-03:** Context-dependent default tab: after extraction/death, land on VAULT (handle loot/overflow); from fresh session, land on SHELL.
- **D-04:** MainMenu stays as splash/login gateway. New `GameState.Hub` added to the state enum. Flow: `MainMenu → Hub → Playing → (death/extract) → Hub`.
- **D-05:** Vault overflow surfaced via alert badge on VAULT tab (pulsing border/count). INITIALIZE tab locked until overflow is cleared. No blocking modal.
- **D-06:** Leaderboard displayed on the INITIALIZE tab alongside run mode selection. No separate scores tab — keeps the tab count at 5.
- **D-07:** Shell selection happens on the SHELL tab via horizontal carousel with arrows to cycle Shells. Not part of the launch flow.
- **D-08:** Single fetch of full PlayerProfile on Hub mount. All tabs read from local state. Actions (equip, compile, sell) hit APIs and optimistically update local state.

### Shell Maintenance Rack (SHELL Tab)
- **D-09:** Stat card layout — Shell name, archetype icon (simple geometric shape per archetype), stat bars (Speed/Stability/Armor), Port slot boxes. Functional and readable, like a character sheet.
- **D-10:** Stats display base + upgrade split: `SPEED: 5 (+2)` format. Upgrade bonus in distinct color. Player sees what they'd lose on weekly reset.
- **D-11:** Shell switcher is a horizontal carousel — arrow buttons to cycle, one Shell card centered at a time. Scales from 3 to 10+ Shells.
- **D-12:** Port slots shown as grouped slot boxes: `FIRMWARE [■][■][□]` / `AUGMENT [■][□]` / `SOFTWARE [■][■][■][□]`. Filled for occupied, empty for available.
- **D-13:** Legacy items show desaturated/dimmed slot box with "LEGACY" tag. Penalty info ("2x HEAT" for Firmware, "0.5x PAYLOAD" for Augments) visible on hover tooltip.

### Equipment Management (LOADOUT Tab)
- **D-14:** Drag-and-drop only interaction model. No click fallback. Commit fully to the drag metaphor. Desktop-only per PROJECT.md.
- **D-15:** Split panel layout — Shell slot boxes (droppable) on the left, scrollable Vault item list with type filters (Firmware/Augment/Software) on the right. Drag right→left to equip, left→right to unequip.
- **D-16:** Vault items in the list show name + rarity badge + type icon. Compact and scannable. Legacy items show "DEPRECATED" tag.
- **D-17:** Slot rejection glow on drag — incompatible slots highlight pink/red, compatible empty slots highlight cyan. Item snaps back on invalid drop.
- **D-18:** Hover tooltips on all items across the Hub — floating tooltip with full item details (name, type, rarity, stat effects, extraction floor, Legacy status). Appears on hover, disappears on mouseout.

### Workshop (WORKSHOP Tab)
- **D-19:** Blueprint compilation as two-column layout: Locked Files (uncompiled) on the left, compiled Library on the right. Compile animates transfer from left to right.
- **D-20:** Software shop section below Blueprint compilation on the same WORKSHOP tab. Workshop is the "spending" tab — compile Blueprints (Flux), purchase Software (Scrap).
- **D-21:** Shell upgrades (stats + Port slots, Flux cost) also on the WORKSHOP tab. All currency spending consolidated: Blueprint compilation + Software shop + Shell upgrades.

### Vault Management (VAULT Tab)
- **D-22:** Grid view — 30 boxes like an RPG inventory grid. Overflow items in a separate highlighted section above the grid. Slot counter visible (`23/30`).
- **D-23:** Right-click or action button per item for sell/discard actions on the Vault grid.

### Run Launcher (INITIALIZE Tab)
- **D-24:** Side-by-side mode cards: SIMULATION / DAILY / WEEKLY. Each shows mode name, rule summary, attempt limits, stakes, seed type, and availability status (e.g., "ATTEMPT USED"). Leaderboard scores below Daily/Weekly cards.
- **D-25:** Ritual launch sequence — deliberate multi-step overlay on "INITIALIZE" click:
  - Step 1: Combined loadout review + risk assessment (Shell, equipped items, mode-specific death stakes, bold warning for Weekly "SHELL FACTORY RESET ON DEATH")
  - Step 2: "CONFIRM INITIALIZATION" button
- **D-26:** Terminal boot sequence transition after confirm: `INITIALIZING SESSION...` → `LOADING NEURAL DECK...` → `SEED: [hash]` → `DEPLOYING SHELL...` — text lines appearing rapidly (~1-2 seconds), then fade to game.

### Agent's Discretion
- Exact CSS module structure and component hierarchy
- React component decomposition (shared components like Tooltip, SlotBox, ItemCard)
- Drag-and-drop implementation approach (HTML5 DnD API vs pointer events)
- Vault grid responsiveness within the fixed viewport
- Tooltip positioning logic and z-index management
- Carousel animation timing and easing
- Tab transition animations (if any)
- Loading state UI while fetching profile on Hub mount
- Error state handling for failed API calls (compile, equip, sell)
- Leaderboard display format (top N entries, player's rank highlight)
- Software shop item card design and purchase confirmation flow
- Shell upgrade UI within the Workshop tab (button layout, cost display)
- Exact animation timing for compile transfer, boot sequence text

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Neural Deck (Hub UI) — HUB-01 through HUB-08 define Hub layout, Shell inspection, equipment management, Blueprint workshop, Stash/Vault UI, run mode launcher, sci-fi terminology, aesthetic
- `.planning/ROADMAP.md` §Phase 15 — Success criteria, plan breakdown (15-01 through 15-04), dependencies

### Direct Dependencies (Prior Phases)
- `.planning/phases/14-stash-vault-run-modes/14-CONTEXT.md` — Vault persistence (D-01), overflow management API (D-07/D-08), Ritual API (D-13/D-14), run mode rules matrix (D-12), attempt tracking (D-15/D-17), leaderboard (D-18-D-22)
- `.planning/phases/13-currency-economy-blueprint-system/13-CONTEXT.md` — Blueprint lifecycle (D-09-D-16), economy.json config (D-28), Software shop rotation (D-29-D-31), Shell upgrades (D-19/D-26), Legacy items (D-35/D-36), PlayerProfile persistence (D-34)
- `.planning/phases/12-multi-floor-generation-stability-extraction/12-CONTEXT.md` — Post-run destination redirect (D-33), run results screen (D-29-D-31), BSOD death screen (D-32)
- `.planning/phases/07-shell-equipment-data-model/07-CONTEXT.md` — Shell archetypes, Port configurations, equipment slots, Shell persistence

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, data flow
- `.planning/codebase/STRUCTURE.md` — Directory layout, naming conventions
- `.planning/codebase/CONVENTIONS.md` — Code style, import organization

### Key Source Files
- `src/app/page.tsx` — Main entry point. Needs GameState.Hub routing and Hub component mounting
- `src/game/states/types.ts` — GameState enum. Add `Hub` state
- `src/game/ui/store.ts` — Zustand store. Extend with Hub-specific state (active tab, profile data, overflow status)
- `src/components/ui/MainMenu.tsx` — Current splash screen. Modify to transition to Hub instead of Playing
- `src/shared/profile.ts` — PlayerProfile, VaultItem, BlueprintEntry, InstalledItem, ShellUpgrades schemas
- `src/app/persistence/fs-profile-repository.ts` — ProfileRepository implementation for server-side profile loading
- `src/app/api/vault/` — Vault management endpoints (equip-from-vault, move-to-vault, sell, discard, overflow)
- `src/app/api/economy/` — Economy endpoints (compile, install, uninstall, purchase, upgrade)
- `src/app/api/run-mode/` — Run mode endpoints (available, launch)
- `src/app/api/leaderboard/` — Leaderboard endpoints (daily, weekly, submit)
- `src/app/api/session/route.ts` — Session initialization endpoint
- `src/app/globals.css` — Existing CSS design tokens (Vibrant Decay palette, spacing, typography)
- `src/components/ui/styles.module.css` — Existing shared CSS module pattern
- `src/components/ui/AnchorOverlay.tsx` — Reference for overlay patterns (React + Zustand integration)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CSS design tokens in `globals.css` — Vibrant Decay palette (`--vibrant-cyan`, `--vibrant-pink`), spacing tokens, typography tokens already defined
- CSS Modules pattern — per-component `.module.css` files established across all existing UI components
- Zustand vanilla store (`gameStore`) — manages all UI state with typed interfaces, `useStore` hook pattern
- `AnchorOverlay` / `RunResultsScreen` / `BSODScreen` — Reference implementations for overlay patterns, Zustand integration, CSS module styling
- `PlayerProfileSchema` with Zod — full schema for wallet, vault, overflow, blueprintLibrary, installedItems, shellUpgrades, attemptTracking
- All backend APIs exist: vault management, economy operations, run mode launch, leaderboard CRUD
- `MainMenu` component — simple state-driven rendering pattern to extend

### Established Patterns
- State-driven rendering via GameState enum + conditional rendering in `page.tsx`
- CSS Modules for component-scoped styles (`.module.css`)
- Zustand vanilla store with typed state interfaces and actions
- API calls via `fetch()` with JSON body/response
- Component files in `src/components/ui/` with co-located CSS modules

### Integration Points
- `src/game/states/types.ts` — Add `Hub = 'Hub'` to GameState enum
- `src/app/page.tsx` — Add `GameState.Hub` rendering with Hub component, modify MainMenu→Hub→Playing flow
- `src/game/ui/store.ts` — Extend with Hub state: activeTab, playerProfile, overflowItems, selectedShell, selectedRunMode
- `src/components/ui/MainMenu.tsx` — Change "Initialize Session" to transition to Hub state instead of Playing
- `src/components/ui/` — New components: HubLayout, TabBar, ShellTab, LoadoutTab, WorkshopTab, VaultTab, InitializeTab, RitualOverlay, ShellCarousel, SlotBox, ItemTooltip, VaultGrid

</code_context>

<specifics>
## Specific Ideas

- The tabbed top bar with wallet always visible creates a persistent "resource awareness" — player always knows what they can afford while browsing any tab. Buying decisions are never blind.
- Context-dependent landing tab (VAULT after run, SHELL on fresh session) creates natural workflow: extract → see your loot → manage it → prep loadout → launch. No wasted clicks.
- Drag-and-drop without click fallback commits to the "maintenance rack" metaphor — you physically move equipment between your Shell and your Vault. Desktop-only scope makes this safe.
- The WORKSHOP tab consolidating all spending (compile + shop + upgrades) prevents the "which tab do I spend Flux on?" confusion. One tab for spending, clear mental model.
- The Ritual sequence (loadout+risk review → confirm → terminal boot) creates a psychological "point of no return" that makes every run launch feel significant, especially Weekly.
- Terminal boot sequence (`INITIALIZING SESSION...`) is a natural loading screen that masks the engine initialization time with atmosphere instead of a spinner.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-neural-deck-hub-ui*
*Context gathered: 2026-04-05*
