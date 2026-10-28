# Design Brief: Nirmata Runner

## Introduction

**Nirmata Runner** is a high-stakes, turn-based web extraction roguelike set in a Sci-Fi **"Vibrant Decay"** universe (**Marathon (2026)** aesthetic). Built on a server-authoritative ECS engine with PixiJS WebGL rendering and a React/Next.js UI, the core innovation is the **"One Shot" Weekly Challenge**, where players get exactly one life per week to compete on a public seed.

## Core Hook: The "Singular" Extraction

Unlike traditional extraction games built around endless grinding, *Nirmata Runner* centers on **Temporal Scarcity**. You have one official shot per week at the Global Seed. Everything else—Neural Simulations, Daily Challenges, Vault scavenging, and Shell customization—serves as preparation for that one definitive moment.

---

## Gameplay Mechanics: The Customization Hierarchy

The player's build is structured as a 4-tier hardware/software hierarchy:

* **Shells (The Chassis)**: Persistent hardware archetypes ([`src/game/shells/shared/templates/`](../../src/game/shells/shared/templates/)) with distinct base stats (`maxHealth`, `speed`, `stability`, `armor`) and `PortConfig` slot limits (`maxFirmware`, `maxAugment`, `maxSoftware`):
  * **`VANGUARD-v1`** (`vanguard-v1`): Speed `120`, Stability `5`, Armor `2`, HP `20` | Ports: `2` Firmware, `1` Augment, `2` Software.
  * **`BASTION-v1`** (`bastion-v1`): Speed `80`, Stability `10`, Armor `3`, HP `25` | Ports: `1` Firmware, `1` Augment, `1` Software.
  * **`GHOST-v1`** (`ghost-v1`): Speed `100`, Stability `8`, Armor `1`, HP `15` | Ports: `2` Firmware, `2` Augment, `3` Software.
* **Firmware (The Brain)**: Active tactical abilities ([`src/shared/components/ability-def.ts`](../../src/shared/components/ability-def.ts)) that generate **Neural Heat** on activation instead of relying solely on traditional cooldowns (e.g., `Phase_Shift.sh`, `Neural_Spike.exe`, `Extended_Sight.sys`, `BASIC_STRIKE.exe`, `KINETIC_LINK.exe`).
* **Augments (The Nervous System)**: Passive synergy interrupts ([`src/shared/components/augment-data.ts`](../../src/shared/components/augment-data.ts)) that evaluate boolean trigger trees (`ON_ACTIVATION`, `ON_TARGET_HIT`, `ON_OVERCLOCK`, `ON_KILL`) when Firmware or combat events occur (e.g., `Displacement_Venting.arc`, `Static_Siphon.arc`, `Neural_Feedback.arc`).
* **Weapons, Armor & Software (The Tools)**: Physical equipment (`rifle-v1..v3`, `armor-v1..v3`) and modular Software tweaks (`Bleed.exe`, `Auto-Loader.msi`, `Vampire.exe` across rarity tiers `v0`–`v3`) that modify combat damage, action economy, and survivability.

---

## Visual Identity: "Vibrant Decay"

Instead of dark, muddy horror, *Nirmata Runner* uses **"Oversaturated Dread"**:
* **The Look**: High-contrast pixel sprites with neon aberration, scanlines, and particle effects. Enemies appear as graphical artifacts and system errors given form.
* **Color Palette**: Base `#000000` (Black) and `#FFFFFF` (White) typography, paired with `#00F0FF` (Neon Cyan) for secure/system states and `#FF0055` (Electric Pink) for risk/corruption states.
* **The System Handshake**: Stepping onto a **Stability Anchor** (Floors 5, 10, 15) desaturates the world into grayscale and opens the high-contrast extraction decision overlay (`ANCHOR_LINK_ESTABLISHED`).
* **Fatal Exception Screen**: Player death triggers a signature Safety Orange / Magenta **BSOD** (`BSODScreen.tsx`) reporting the exact failure reason (`FATAL_EXCEPTION`, `FATAL: REALITY_ANCHOR_COLLAPSED`, `FATAL: ADMIN_CONTACT`).

---

## Core Gameplay Systems

### 1. Run Modes ([`src/shared/run-mode.ts`](../../src/shared/run-mode.ts))
* **Neural Simulation (`SIMULATION`)**: Unlimited attempts on random seeds. Low-stakes environment to scavenge currencies, blueprints, and gear for the Vault.
* **Daily Challenge (`DAILY`)**: 1 attempt per day on a shared daily seed with a daily leaderboard.
* **Weekly One-Shot (`WEEKLY`)**: 1 attempt per week on the global weekly seed. High-stakes competitive leaderboard run.

### 2. Run Resolution: Reality Stability & Extraction
* **Reality Stability**: Starts at `100`. Drains each turn (`0.01` base bleed) and drops in chunks on floor descent (`5 + (floor - 1) * 0.5`). Hitting `0` Stability collapses reality and ends the run immediately.
* **Staircases vs. Stability Anchors**:
  * **Staircases** spawn on Floors 1–14 for standard floor descent.
  * **Stability Anchors** spawn on Floors 5, 10, and 15, pausing the simulation to present two choices:
    * **Option A (`DE-REZZ & EXTRACT`)**: End the run safely, securing collected Software, Scrap, and Flux (plus a depth Flux bonus) into your profile Vault and Wallet.
    * **Option B (`STABILIZE & DESCEND`)**: Continue deeper into the next floor for higher-tier loot tables. *(Note: Scrap cost deduction and 40% Stability repair on Anchor descent are tracked for implementation in [TRACKING.md](../TRACKING.md)).*

### 3. Meta-Progression & Risk Table

| Component | Intended Status on Death | Purpose |
| :--- | :--- | :--- |
| **Shell** | Persistent (Upgrades reset on Weekly failure) | Base chassis stats and Port counts. Upgraded via **Flux** in the Neural Deck Workshop. |
| **Firmware** | Lost on Death *(enforcement tracked in [TRACKING.md](../TRACKING.md))* | Active build abilities. Compiled from Blueprints with **Flux**, installed with **Scrap**. |
| **Augments** | Lost on Death *(enforcement tracked in [TRACKING.md](../TRACKING.md))* | Conditional synergy triggers that react to Firmware activation, hits, and kills. |
| **Software & Gear** | Lost on Death (25% Pity Scrap retained) | High-frequency tiered modifiers (`v0`–`v3`) and weapons/armor (`v1`–`v3`) looted in-run or bought in the Hub. |
