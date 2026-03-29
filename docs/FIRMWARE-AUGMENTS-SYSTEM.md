To truly lean into the **Marathon (2026)** aesthetic—where high-fidelity tech meets "glitchy" horror—we need to move away from standard cooldowns and toward a system that feels like you are **overclocking a machine that wasn't meant to handle this much data.**

Here is a refined technical breakdown for **Firmware** and **Augments**, centering on the "Heat/Stability" economy.

---

## **1\. Firmware: The "Neural Heat" System**

Instead of waiting for a timer to tick down, every time you execute a Firmware command, your Shell generates **Neural Heat**.

* **The Mechanic:** Each Firmware has a **Heat Value** (e.g., *Phase-Shift* costs 25 Heat).  
* **The Threshold:** Your Shell can safely handle up to **100 Heat**.  
* **Overclocking (The Risk):** You can continue to use Firmware above 100 Heat, but you enter the **Corruption Zone**. Every use above the limit has a % chance to cause a **"Kernel Panic"** (Self-damage, temporary blindness, or a random negative event trigger and/or negative status effect).  
* **Venting:** Heat dissipates slowly over time, or rapidly if you stand still (making you a sitting duck).

### **Firmware Archetypes (Winner-Created or Found)**

| Ability | Base Heat | The "Eldritch" Cost |
| :---- | :---- | :---- |
| **`Phase_Shift.sh`** | 25 | **Static Siphon:** While shifted, your vision is grayscale; you "see" nearby enemy thoughts as directional signals. |
| **`Neural_Spike.exe`** | 40 | **Logic Strain:** High damage projectile. Using this at \>75 Heat reverses your movement controls for 1.5s. |
| **`Eldritch_Sight.sys`** | 10 (per sec) | **Insight Drain:** Reveals enemies through walls. If used too long, "Echoes" of past runners appear and distract you. |

---

## **2\. Augments: The Synergy Engine**

Augments shouldn't just be "passive stats." They should be **"Interrupts"**—logic that triggers *only* when the Firmware creates a specific state. This creates the high-skill ceiling of your extraction runs.

### **The "Trigger & Payload" System**

Every Augment follows a logic gate: `IF [Firmware Action] THEN [Augment Reaction]`.

* **Trigger A: On Activation**  
  * *Augment:* `Thermal_Sink.arc` — Your next Firmware use generates 50% less Heat.  
* **Trigger B: On Target Hit**  
  * *Augment:* `Static_Siphon.arc` — Gain 5% Shield for every enemy hit by a Firmware skill. (Perfect for `Neural_Spike`).  
* **Trigger C: On Overclock (Above 100 Heat)**  
  * *Augment:* `Adrenaline_Patch.pkg` — Movement speed increases by 30% while in the "Corruption Zone."

---

## **3\. Blueprints: The "Volatile Data"**

If we are resetting blueprints weekly, we need to distinguish between the **Blueprint** (the recipe) and the **Installation** (the actual ability on your Shell).

1. **Finding the Blueprint:** You find `Phase_Shift.sh` in the dungeon. It’s a "Locked File."  
2. **Compiling (At the Hub):** You spend **Flux** to unlock it. It is now in your library for the week.  
3. **Installing:** You can install it on your Shell.  
4. **The Weekly Reset (The "Format C:"):**  
   * **Firmware/Augment Blueprints:** All uninstalled and library blueprints are **deleted**.  
   * **The "Burned" Equipment:** If you have a Firmware *already installed* on a Shell, it stays... **but it becomes "Deprioritized Data."** Its Heat cost doubles because the "Global OS" no longer supports it. This forces you to hunt for the new week's "Optimized" blueprints.

---

## **4\. Visualizing the "Stability Corruption" (Marathon Style)**

As the player builds up Heat and triggers Augments, the UI should reflect the strain:

* **Low Heat:** Clean, Cyan HUD.  
* **High Heat:** The HUD begins to jitter. The player's sprite starts "ghosting" (leaving a trail of hot pink pixels).  
* **Augment Trigger:** A high-contrast geometric shape (like a white triangle or orange square) flashes briefly in the center of the screen to signal a successful synergy.

---

## **5\. Summary: Why this works**

This system turns every encounter into a **Resource Management Puzzle**.

* *Do I use my dash now and risk a Kernel Panic?*  
* *Do I equip the Augment that gives me shields, or the one that reduces my Heat?*

## **1\. Starter Loadouts: The "Initial Boot" Bundles**

### **Bundle A: The "Vanguard" (Aggressive CQC)**

* **Shell:** `STRIKER-v1` (High Speed, Low Armor, 1 Augment Port).  
* **Firmware:** `Phase_Shift.sh` — A rapid teleport-dash that ignores enemy collision.  
* **Augment:** `Displacement_Venting.arc` — **IF** you dash through an enemy, **THEN** instantly vent 15 Neural Heat.  
* **Playstyle:** High-intensity "Dance" combat. You use your ability to initiate, and as long as you are accurate with your positioning, you never overheat.

### **Bundle B: The "Operator" (Mid-Range Tactical)**

* **Shell:** `BASTION-v1` (Low Speed, High Armor, 1 Augment Port).  
* **Firmware:** `Neural_Spike.exe` — Fires a high-velocity bolt of data that deals heavy damage and stuns for 0.5s.  
* **Augment:** `Static_Siphon.arc` — **IF** `Neural_Spike` kills an enemy, **THEN** generate a small digital shield (5 HP).  
* **Playstyle:** The "Tank." You move slowly but can lock down dangerous Tier 2 enemies. You rely on the shield to survive while waiting for your Heat to dissipate.

### **Bundle C: The "Ghost" (Recon & Utility)**

* **Shell:** `SIGNAL-v1` (Balanced Stats, 2 Augment Ports).  
* **Firmware:** `Extended_Sight.sys` — Toggled ability. Reveals enemies and loot through walls; slows down time by 10% while active.  
* **Augment:** `Neural_Feedback.arc` — **IF** you kill an enemy while `Extended_Sight` is active, **THEN** your next shot deals 25% bonus damage.  
* **Playstyle:** Calculated and slow. You spend more time "Scanning" and picking the perfect moment to strike, managing the slow Heat-tick of your toggle ability.

---

## **2\. The Kernel Panic Table (The Overclock Risk)**

When a player exceeds **100 Neural Heat**, the UI begins to "bleed" Neon Magenta. Every time Firmware is used while in this state, roll on the **Kernel Panic Table** based on current Heat levels.

| Heat Level | Visual/Audio Tell | Panic Chance | Effect on Failure |
| :---- | :---- | :---- | :---- |
| **101-120%** | HUD jitters; faint "mechanical screaming" in audio. | **15%** | **`UI_GLITCH`**: HUD elements (Mini-map, Ammo) flicker and disappear for 5 seconds. |
| **121-140%** | Screen colors invert; trails of "dead pixels" follow the player. | **30%** | **`INPUT_LAG`**: Movement becomes "slippery" (delayed response) for 3 seconds as the Shell struggles to process commands. |
| **141-160%** | Heavy screen-tearing; the Shell sprite turns into a red wireframe. | **50%** | **`FIRMWARE_LOCK`**: All Firmware is disabled for 8 seconds. The player must rely purely on their weapons. |
| **161% \+** | Constant high-pitched "Digital Feedback"; world turns grayscale. | **75%** | **`CRITICAL_REBOOT`**: The Shell takes 20% Stability damage and is stunned for 2 seconds while the system "force-restarts." |

---

## **4\. Design Critical: The "Death Screen"**

In a Marathon-style web game, the "Game Over" shouldn't be a fade-to-black.

* **The Look:** A "Blue Screen of Death" (BSOD) but in the game’s signature Safety Orange.  
* **The Text:** It lists the "Reason for Failure" (e.g., `FATAL_EXCEPTION: KERNEL_PANIC_DURING_COMBAT`).  
