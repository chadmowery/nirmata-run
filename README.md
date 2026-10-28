# Nirmata Runner

A web-based, turn-based **extraction roguelike** set in a Sci-Fi **"Vibrant Decay"** universe (**Marathon (2026)** aesthetic). Built on a custom server-authoritative **Entity-Component-System (ECS)** engine with **PixiJS 8** WebGL rendering, **React 19**, **Zustand**, **Zod**, and **Next.js 16**.

---

## Core Concept: The "One-Shot" Extraction Loop

Unlike traditional extraction games built on endless grinding, **Nirmata Runner** centers on **Temporal Scarcity**:
- **Weekly One-Shot (`WEEKLY`)**: Players get **one life per week** on a global public seed to post their definitive leaderboard run.
- **Daily Challenge (`DAILY`)**: One attempt per day on a shared daily seed.
- **Neural Simulation (`SIMULATION`)**: Unlimited low-stakes runs to scavenge **Raw Scrap**, **Flux**, **Neural Blueprints**, and **Software** for the Vault.

### Key Gameplay Systems
1. **4-Tier Shell Customization**:
   - **Shells** (`VANGUARD-v1`, `BASTION-v1`, `GHOST-v1`): Hardware chassis defining base stats (`HP`, `Speed`, `Stability`, `Armor`) and `PortConfig` slot limits.
   - **Firmware**: Active tactical abilities (`Phase_Shift.sh`, `Neural_Spike.exe`, `Extended_Sight.sys`, `BASIC_STRIKE.exe`, `KINETIC_LINK.exe`) that generate **Neural Heat**.
   - **Augments**: Passive "Trigger & Payload" interrupts (`Displacement_Venting.arc`, `Static_Siphon.arc`, `Neural_Feedback.arc`) that fire automatically when combat/ability conditions are met.
   - **Weapons, Armor & Software**: Tiered physical gear (`rifle-v1..v3`, `armor-v1..v3`) and modular Software tweaks (`Bleed.exe`, `Auto-Loader.msi`, `Vampire.exe` across rarities `v0`–`v3`).
2. **Neural Heat & Kernel Panic**:
   - Executing Firmware builds Heat (`0–100%` safe zone). Pushing past `100%` enters the **Corruption Zone**, risking escalating **Kernel Panic** malfunctions (`HUD_GLITCH`, `INPUT_LAG`, `FIRMWARE_LOCK`, `CRITICAL_REBOOT`) accompanied by progressive CRT/glitch shader effects.
   - Players can spend a turn to actively **Vent** 50% Heat at the cost of dropping their Armor to `0` until their next turn.
3. **Reality Stability & Stability Anchors**:
   - Descending deeper (Floors 1–15) drains **Reality Stability** per turn and per floor transition.
   - Every 5th floor (Floors 5, 10, 15) spawns a **Stability Anchor**, pausing the run for a high-stakes choice: **De-Rezz & Extract** with all unsecured loot, or **Stabilize & Descend** deeper into Tier 2/3 corruption.

---

## Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework & API** | Next.js `^16.4.3` (App Router), React `^19.3.1`, TypeScript `^5.9.3` |
| **2D Rendering** | PixiJS `^8.22.0`, `@pixi/tilemap` `^5.0.2`, `pixi-filters` `^6.1.5` |
| **Roguelike Toolkit** | `rot-js` `^2.2.1` (FOV, Dijkstra/A* pathfinding, deterministic PRNG) |
| **State & Validation** | Custom ECS (`@engine`), Zustand `^5.0.16`, Zod `^4.6.7`, `json-diff-ts` `^4.10.4` |
| **Testing & Quality** | Vitest `^4.1.12`, Testing Library, ESLint `^9.39.5` (`eslint-plugin-import-x`), Prettier |

---

## Getting Started

### Prerequisites
- **Node.js** (v20+ recommended)
- **npm**

### Installation & Development
```bash
# Install dependencies
npm install

# Start the development server (http://localhost:3000)
npm run dev
```

### Quality & Verification Scripts
```bash
# Run the full Vitest unit & integration suite
npm test

# Run Vitest in interactive watch mode
npm run test:watch

# Run TypeScript compiler typecheck
npm run typecheck

# Run ESLint (includes architectural boundary checks)
npm run lint

# Format source files with Prettier
npm run format

# Build production Next.js bundle
npm run build
```

### Developer Tools
- **Game Data Studio (`/dev/gamedata`)**: Navigate to `http://localhost:3000/dev/gamedata` while the dev server is running to inspect and edit JSON Entity Templates, Mixins, Shell Archetypes, Spawn Tables, and Zod Component Schemas in the browser.
- **In-Game Dev Terminal**: Press `` ` `` (backtick) during a run to open the debug console and event timeline inspector.

---

## Project Structure

```text
nirmata-run/
├── src/
│   ├── engine/       # (@engine/*) Pure, game-agnostic ECS World, Grid, EventBus, TurnManager, BSP
│   ├── shared/       # (@shared/*) Zod component schemas, GameplayEvents, ECS deltas, reconciliation
│   ├── game/         # (@game/*) 23 phased gameplay systems, JSON templates, shells, input, UI store
│   ├── rendering/    # (@rendering/*) PixiJS renderer, tilemap, camera, FOV, shaders, sprite map
│   ├── server/       # (@server/*) In-memory SessionManager & LeaderboardService
│   ├── components/   # (@components/*) React HUD overlays, Inventory drag-and-drop, Neural Deck Hub
│   └── app/          # Next.js App Router pages, authoritative REST API routes (/api/*), persistence
├── tests/            # Cross-layer integration, API security, rendering, and delta sync tests
└── docs/             # Project documentation
    ├── TRACKING.md   # Active backlog, known bugs, and future work roadmap
    ├── architecture/ # System overview, ECS guidelines, and Gravedigger Death Protocol
    ├── design/       # Canonical game design specifications
    └── archive/      # Historical audits, completed refactoring plans, and retired GSD artifacts
```

---

## Documentation Index

- **Agent & Engineering Rules**: [`AGENTS.md`](./AGENTS.md)
- **Project Backlog & Future Work**: [`docs/TRACKING.md`](./docs/TRACKING.md)
- **Architecture Documentation**:
  - [`docs/architecture/SYSTEM_OVERVIEW.md`](./docs/architecture/SYSTEM_OVERVIEW.md) — Layer hierarchy, client prediction, and server delta reconciliation flow
  - [`docs/architecture/ENGINE_GUIDELINES.md`](./docs/architecture/ENGINE_GUIDELINES.md) — Phase-Driven Intent pattern and turn lifecycle
  - [`docs/architecture/DEATH_PROTOCOL.md`](./docs/architecture/DEATH_PROTOCOL.md) — The `Dying` component lifecycle and `GravediggerSystem`
- **Game Design Specifications**:
  - [`docs/design/DESIGN-BRIEF.md`](./docs/design/DESIGN-BRIEF.md) — Core hook, customization hierarchy, and "Vibrant Decay" aesthetic
  - [`docs/design/FIRMWARE-AUGMENTS-SYSTEM.md`](./docs/design/FIRMWARE-AUGMENTS-SYSTEM.md) — Neural Heat, Firmware abilities, Augment triggers, and Kernel Panic table
  - [`docs/design/ENEMY-HIERARCHY.md`](./docs/design/ENEMY-HIERARCHY.md) — Tier 1–3 enemy archetypes and AI behaviors
  - [`docs/design/RUN-ECONOMY.md`](./docs/design/RUN-ECONOMY.md) — Scrap/Blueprints/Flux economy, Neural Deck Hub, Vault, and Weekly Reset
  - [`docs/design/STABILITY-ANCHOR-SYSTEM.md`](./docs/design/STABILITY-ANCHOR-SYSTEM.md) — Reality Stability drain and Anchor extraction UX
- **Archive**: [`docs/archive/README.md`](./docs/archive/README.md)
