## Stability Anchor UX Flow: The "Extraction Decision Loop"

1. Approach: Player finds a glowing "Stability Anchor" (a floating white cube with a hole in the center).  
2. Interaction: Player holds 'E' (or taps on mobile). The System Handshake UI takes over the screen.  
3. The Pause: The game world freezes. This gives the player a "Safe Breath" to look at their loot and check their Stability.  
4. Execution: Player chooses.  
   * Extract: End-of-run screen shows loot gained.  
   * Descend: A "Reality Refill" animation plays (vibrant flash), and the next floor's enemies are immediately visible.

### Stability Anchor UI Layout & Components

In line with the Marathon (2026) aesthetic, the Stability Anchor UI shouldn't just be a static menu. It should feel like a "System Override" or a "Firmware Handshake" between your Shell and the Dungeon’s reality.

Think bold, condensed typography, high-contrast color blocks (Safety Cyan vs. Warning Magenta), and glitchy, screen-tearing transitions.

#### A. The "Risk/Reward" Header

Top of the screen. A flickering status bar.

* Text: FLOOR\_12 // STABILITY\_STATUS: CRITICAL (22%)  
* Visual: A progress bar made of vertical blocks. As Stability drops, the blocks turn from Cyan to Pink and start "jittering" (shifting a few pixels left and right).

#### B. The "Inventory Manifest" (Left Side)

A scrolling list of everything currently "Unsecured" in your Shell.

* Software: Vampire.exe \[UNSECURED\]  
* Augments: Feedback\_Loop.arc \[UNSECURED\]  
* Materials: x14 Scrap  
* Vibe: Each item should have a small "Marathon-style" icon—a simple geometric shape or a high-contrast glyph.

#### C. The Decision Fork (Center)

This is the core UX. Two massive, clickable blocks.

##### Option 1: \[DE-REZZ & EXTRACT\] (The Coward's/Tactician's Path)

* Color: Solid Neon Cyan.  
* Sub-text: TRANSFER\_DATA\_TO\_STASH\_100%\_SUCCESS\_RATE  
* Interaction: Clicking this triggers an animation where your pixel-art Shell "digitizes" from the feet up and disappears.  

##### Option 2: \[STABILIZE & DESCEND\] (The Hero's/Gambler's Path)

* Color: Transparent with a thick Electric Pink border.  
* Sub-text: REPAIR\_STABILITY\_BY\_40% // COST: 500 INSIGHT  
* Risk Warning: WARNING: LOSS\_OF\_UNSECURED\_DATA\_ON\_DEATH  
* Interaction: The UI "shatters" and the world snaps back into full color with an aggressive "Oversaturated" filter.
