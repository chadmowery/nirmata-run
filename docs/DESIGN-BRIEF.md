# Design Brief: Dungeon Runner

## DRAFT | Feb 22, 2026

## Introduction

"Nirmata Runner" is a high-stakes, community-driven, web-based extraction roguelike game set in a Sci-Fi universe (**Marathon (2026)** aesthetic). The core innovation is the "One Shot" Weekly Challenge, where players get exactly one life per week to compete on a public seed.

## Core Hook: The "Singular" Extraction

Unlike traditional extraction shooters (where you can grind all day), *Nirmata Runner* centers on Temporal Scarcity. You have one "official" shot per week at the Global Seed. Everything else—the extraction, the looting, and the customization—serves as the "Training Ground" or "Scavenge Runs" to prepare for that one definitive moment.

## Gameplay Mechanics: The Customization Hierarchy

To ensure depth, we must clearly define the layers of the "Shell" system.

* Shells (The Body): Archetypes with unique base stats (Speed, Stability, Armor) and unique "Port" configurations (e.g. a Heavy Shell has 4 Software slots but only 1 Augment slot). Generally players have access to any shell type at all times.  
* Firmware (The Brain): These are Active Abilities (e.g. *Phase-Shift Dash, Blink, Sight*).  
  * *Design Suggestion:* Firmware should have "Heat" costs to lean into the Sci-Fi runner shell theme.  
* Augments (The Nervous System): These are Passive Synergies that trigger *when* Firmware is used.  
  * *Example:* If Firmware is "Chain Lightning," an Augment could be "Static Siphon" (Gain 5% shield for every enemy hit by a skill).  
* Software (The Tools): These are Modular Item Tweaks.  
  * *Example:* "Bleed.exe" (Adds damage over time to a physical blade) or "Auto-Loader.msi" (Reduces reload time of ammo-based weapons/guns).

## Progression & Extraction System

* The Stash: Because this is a web-based game, the economy must be tightly controlled to prevent inflation: a "Blueprint" vs. "Material" system. You extract with raw materials to *craft* your ideal loadout for the Weekly Challenge.  
* The Risk: In standard runs, you lose your Firmware/Software/Augments on death. Shells are not lost, but may not always be available to runners every week depending on conditions or other live events happening in the game.

## Visual Identity: "Vibrant Decay"

Instead of a dark, muddy horror, we go for "Oversaturated Dread".

* The Look: High-fidelity pixel sprites with "flat" shading. When an enemy appears, it doesn't just look like a monster; it looks like a graphical artifact—a tear in the game's UI.  
* The HUD: Minimalist, using bold typography.

### Visual Design: The "System Handshake"

Because this is a web-based game, we want the UI to be "Heavy on Style, Light on Assets."

* Color Palette: Base of \#000000 (Black) and \#FFFFFF (White) for text, with \#00F0FF (Neon Cyan) for "Secure" actions and \#FF0055 (Electric Pink) for "Risk" actions.  
* The Transition: When you touch a physical Stability Anchor in the game world, the game world desaturates into grayscale, and the HUD "zooms" into the center.  
* Typography: Large, "crushed" sans-serif headers (e.g., "ANCHOR\_LINK\_ESTABLISHED").

# Gameplay Systems

## Weekly/Daily/Neural Simulation Runs

* Neural Simulation Runs (Unlimited): Low-stakes. You use "Virtual Shells." You can find and extract Firmware/Software/Augments. Players use this mode to build their stash, collect currencies, and prepare for the weekly/daily runs.  
* The Daily Run: Players compete for daily cumulative “high score” on a leaderboard. Gives them more competition opportunities while waiting for weekly run refreshes and additional reasons to use stash items for their loadouts.  
* The Real Run (Weekly): You "Upload" your best gear from your Stash into a physical Shell. This is the only run that counts for the leaderboard. This creates a loop: Scavenge all week → Build the ultimate "God-Slayer" → Risk it all on Sunday.

## Run Resolution: The "Stability" Extraction

**Stability Threshold:**

* The Mechanic: As you go deeper, your "Reality Stability" (a secondary bar) drops.  
* The Choice: At specific depth intervals (e.g., Floors 5, 10, 15), a Stability Anchor appears.  
  * Option A: Extract. Leave now. Keep all Software, Augments, and Materials found.  
  * Option B: Stabilize. Spend currency to "refill" your stability and keep going deeper for better loot, but the Anchor breaks. You must reach the next one to leave.  
  * The Risk: If you die or your Stability hits zero, the "Software" fries. You return to the lobby with just your Shell and a handful of "Scrap" (pity currency).

## The Meta-Game: "Software Crafting"

Since you lose Software on death but keep the Shell, the "Between-Run" gameplay should focus on Research & Development (R\&D).

| Component | Status on Death | Purpose |
| :---- | :---- | :---- |
| Shell | Persistent | Base stats and Slot counts. Upgraded via "Materials." |
| Firmware | Lost | Your "Active" build. Harder to find, often requires a boss kill. |
| Augements | Lost | “Modifiers” on your active build. Harder to find, often requires a boss kill. |
| Software | Lost | The "Tweaks." High-frequency drops that allow for "Daily" experimentation. |
