# Phase 15: Neural Deck Hub UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 15-neural-deck-hub-ui
**Areas discussed:** Hub navigation structure, Shell maintenance rack, Equipment interaction, Run launch ceremony

---

## Hub Navigation Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Tabbed top bar | Horizontal tabs, one section visible at a time | ✓ |
| Sidebar terminal nav | Vertical command list, server-room aesthetic | |
| Single scrollable page | All sections stacked vertically | |
| Hub "desktop" with panels | Central Shell display with clickable panels around it | |

**User's choice:** Tabbed top bar
**Notes:** Simple, familiar, maps cleanly to 5 areas. Works with existing single-page state-driven rendering.

---

### Wallet in Tab Bar

| Option | Description | Selected |
|--------|-------------|----------|
| Wallet embedded in tab bar | Scrap/Flux always visible on the right side | ✓ |
| Wallet on specific tabs only | Currency shows contextually per tab | |
| You decide | Agent picks | |

**User's choice:** Wallet embedded in tab bar
**Notes:** Player always knows what they can afford.

---

### Tab Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Full sci-fi | SHELL / LOADOUT / WORKSHOP / VAULT / INITIALIZE | ✓ |
| Abbreviated codes | SHL / LDT / WKS / VLT / RUN | |
| You decide | Agent picks | |

**User's choice:** Full sci-fi
**Notes:** Leans into the terminal/server-room vibe, readable.

---

### Default Landing Tab

| Option | Description | Selected |
|--------|-------------|----------|
| SHELL | Player sees their Shell first | |
| INITIALIZE | Run launcher front and center | |
| Context-dependent | After run = VAULT, fresh session = SHELL | ✓ |

**User's choice:** Context-dependent
**Notes:** Post-run lands on VAULT to handle loot, fresh session lands on SHELL.

---

### Hub vs MainMenu

| Option | Description | Selected |
|--------|-------------|----------|
| Hub replaces MainMenu | Boot straight into Hub, remove MainMenu | |
| MainMenu stays as splash | Minimal splash → Hub → game | ✓ |
| You decide | Agent picks | |

**User's choice:** MainMenu stays as splash
**Notes:** "Because we will eventually ask the player to login on the main menu." Future-proofing for auth.

---

### Vault Overflow Surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking modal | Forced overflow resolution before Hub loads | |
| VAULT tab with alert badge | Warning badge, INITIALIZE locked until resolved | ✓ |
| You decide | Agent picks | |

**User's choice:** VAULT tab with alert badge
**Notes:** Player can still browse but can't launch with overflow.

---

### Leaderboard Placement

| Option | Description | Selected |
|--------|-------------|----------|
| On the INITIALIZE tab | Scores alongside run mode selection | ✓ |
| Separate SCORES tab | 6th tab dedicated to leaderboards | |
| You decide | Agent picks | |

**User's choice:** On the INITIALIZE tab
**Notes:** Competition visible right at the point of commitment. Keeps tab count at 5.

---

### Shell Selection Location

| Option | Description | Selected |
|--------|-------------|----------|
| On the SHELL tab | Shell carousel with Switch Shell button | ✓ |
| Part of INITIALIZE flow | Pick Shell when launching run | |
| You decide | Agent picks | |

**User's choice:** On the SHELL tab

---

### Data Fetching Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Single fetch on Hub mount | Full profile once, optimistic updates | ✓ |
| Per-tab lazy fetch | Each tab fetches its data on activation | |
| You decide | Agent picks | |

**User's choice:** Single fetch on Hub mount

---

## Shell Maintenance Rack

| Option | Description | Selected |
|--------|-------------|----------|
| ASCII/text schematic | Stylized ASCII art or text wireframe | |
| Stat card layout | Clean card with stats, archetype icon, Port boxes | ✓ |
| Blueprint diagram | Technical drawing with labeled hardpoints | |
| You decide | Agent picks | |

**User's choice:** Stat card layout
**Notes:** Functional, readable, like a character sheet. Good scope call.

---

### Stats Display

| Option | Description | Selected |
|--------|-------------|----------|
| Base + upgrade split | `SPEED: 5 (+2)` format | ✓ |
| Single combined value | Just show total | |
| You decide | Agent picks | |

**User's choice:** Base + upgrade split
**Notes:** Player always sees what's at risk on weekly reset.

---

### Shell Switcher

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal carousel | Arrow buttons, one Shell centered | ✓ |
| Grid of cards | All Shells shown as smaller cards | |
| You decide | Agent picks | |

**User's choice:** Horizontal carousel

---

### Port Slot Display

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped slot boxes | `FIRMWARE [■][■][□]` visual rows | ✓ |
| Itemized list | Text list with installed names | |
| You decide | Agent picks | |

**User's choice:** Grouped slot boxes

---

### Legacy Items on Shell Card

| Option | Description | Selected |
|--------|-------------|----------|
| Visual differentiation | Dimmed slot, "LEGACY" tag, penalty on hover | ✓ |
| No Shell tab treatment | Legacy shown only in LOADOUT/WORKSHOP | |
| You decide | Agent picks | |

**User's choice:** Visual differentiation in slots

---

## Equipment Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Click-to-equip | Click Vault item then click slot | |
| Drag-and-drop | Drag items from Vault onto Shell slots | ✓ |
| List-and-assign | Select slot, dropdown of compatible items | |
| You decide | Agent picks | |

**User's choice:** Drag-and-drop

---

### Click Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Drag primary, click fallback | Both interaction models | |
| Drag only | Commit fully to drag metaphor | ✓ |

**User's choice:** Drag only

---

### LOADOUT Tab Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Split panel | Shell slots left, Vault browser right | ✓ |
| Full Shell top, Vault bottom | Vertical stacking | |
| You decide | Agent picks | |

**User's choice:** Split panel

---

### Vault Item Display

| Option | Description | Selected |
|--------|-------------|----------|
| Name + rarity + type icon | Compact, scannable | ✓ |
| Name + rarity + stat preview | More info, taller items | |
| You decide | Agent picks | |

**User's choice:** Name + rarity + type icon

---

### Drag Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Slot rejection glow | Red/pink invalid, cyan valid | ✓ |
| Filter by drag | Incompatible slots dim on drag start | |
| You decide | Agent picks | |

**User's choice:** Slot rejection glow

---

### Blueprint Workshop Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Blueprint list with compile buttons | Single list, compile button per item | |
| Two-column: Locked Files ↔ Library | Left→right compile animation | ✓ |
| You decide | Agent picks | |

**User's choice:** Two-column layout

---

### Software Shop Location

| Option | Description | Selected |
|--------|-------------|----------|
| On the WORKSHOP tab | Alongside Blueprint compilation | ✓ |
| On the VAULT tab | Alongside Vault management | |
| You decide | Agent picks | |

**User's choice:** On the WORKSHOP tab
**Notes:** Workshop is the "spending" tab.

---

### Vault Tab Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Grid view | 30-box RPG inventory, overflow above, slot counter | ✓ |
| List view | Sortable/filterable list with columns | |
| You decide | Agent picks | |

**User's choice:** Grid view

---

### Shell Upgrade Location

| Option | Description | Selected |
|--------|-------------|----------|
| On the SHELL tab | Upgrade buttons per stat | |
| On the WORKSHOP tab | All Flux spending consolidated | ✓ |
| You decide | Agent picks | |

**User's choice:** On the WORKSHOP tab
**Notes:** All currency spending in one place.

---

### Item Detail Display

| Option | Description | Selected |
|--------|-------------|----------|
| Hover tooltip | Floating tooltip with full details | ✓ |
| Click-to-expand detail panel | Side panel or modal on click | |
| You decide | Agent picks | |

**User's choice:** Hover tooltip

---

## Run Launch Ceremony

| Option | Description | Selected |
|--------|-------------|----------|
| Quick launch | Minimal friction, just go | |
| Ritual sequence | Multi-step overlay: review → confirm | ✓ |
| Mode-dependent | Quick for Sim, ritual for Daily/Weekly | |

**User's choice:** Ritual sequence for all modes

---

### Run Mode Selector

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side cards | Three equal cards in a row | ✓ |
| Stacked list with emphasis | Vertical, Weekly largest | |
| You decide | Agent picks | |

**User's choice:** Side-by-side cards

---

### Ritual Confirmation Steps

| Option | Description | Selected |
|--------|-------------|----------|
| Loadout → Risk → Launch | Three steps | |
| Compressed: Risk + Loadout → Launch | Two steps combined | ✓ |
| You decide | Agent picks | |

**User's choice:** Compressed two-step

---

### Launch Transition

| Option | Description | Selected |
|--------|-------------|----------|
| Terminal boot sequence | Text animation lines, ~1-2 seconds | ✓ |
| Glitch cut | Hard glitch effect, ~300ms | |
| You decide | Agent picks | |

**User's choice:** Terminal boot sequence

---

## Agent's Discretion

- Exact CSS module structure and component hierarchy
- React component decomposition
- Drag-and-drop implementation approach
- Tooltip positioning and z-index
- Carousel animation timing
- Loading/error state UI
- Leaderboard display format
- Software shop purchase flow
- Shell upgrade UI within Workshop
- Animation timings throughout

## Deferred Ideas

None — discussion stayed within phase scope.
