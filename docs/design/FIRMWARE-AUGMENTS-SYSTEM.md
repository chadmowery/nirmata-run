# Firmware, Augments & Neural Heat System

In keeping with the **Marathon (2026) "Vibrant Decay"** aesthetic, active abilities do not rely exclusively on cooldown timers. Executing a Firmware command generates **Neural Heat**, turning every encounter into a turn-based resource management puzzle where players balance power output against **Overclock / Kernel Panic** risk.

---

## 1. Neural Heat & Venting Mechanics ([`src/game/systems/heat.ts`](../../src/game/systems/heat.ts))

* **Heat Generation**: Activating a Firmware ability adds its `heatCost` (doubled if marked `isLegacy: true`) to the player's `Heat.current`. Toggled abilities (`Extended_Sight.sys`) add `heatPerTurn` during `Phase.PRE_TURN`.
* **Safe Threshold**: Shells safely operate up to **`100` Heat** (`maxSafe: 100`).
* **Passive Dissipation**: During `Phase.PRE_TURN`, Heat dissipates automatically based on the Shell's `stability` stat:
  * Initial `baseDissipation` = `5 + currentStats.stability * 0.1`
  * Per-turn `effectiveDissipation` = `baseDissipation + shell.stability * 0.5`
* **Active Venting (`VENT`)**: Spending a turn to Vent (`VentIntent` in `Phase.ACTION`) immediately purges **50%** of current Heat (`ventPercentage: 0.5`), but sets `isVenting: true`, **reducing effective Armor to `0`** until the start of the player's next turn.

---

## 2. Firmware Abilities ([`src/game/entities/templates/`](../../src/game/entities/templates/))

Seven Firmware templates are defined in the codebase and resolved by [`FirmwareSystem`](../../src/game/systems/firmware.ts) in `Phase.ACTION`:

| Template | Name | Heat Cost | Range | Effect Type & Current Implementation |
| :--- | :--- | :---: | :---: | :--- |
| [`phase-shift.json`](../../src/game/entities/templates/phase-shift.json) | `Phase_Shift.sh` | `25` | `5` | `dash`: Teleports up to 5 tiles along a cardinal/diagonal line, bypassing obstacles (`TeleportIntent`). |
| [`neural-spike.json`](../../src/game/entities/templates/neural-spike.json) | `Neural_Spike.exe` | `40` | `6` | `ranged_attack`: Deals `15` neural damage (`DamageIntent`) to a target within 6 tiles. |
| [`extended-sight.json`](../../src/game/entities/templates/extended-sight.json) | `Extended_Sight.sys` | `10` (+`10`/turn) | Self | `toggle_vision`: Toggles `visionRadius: 12` wall-penetrating FOV awareness. |
| [`basic-strike.json`](../../src/game/entities/templates/basic-strike.json) | `BASIC_STRIKE.exe` | `15` | `1` | `melee_attack`: Deals `8` physical damage to an adjacent target. |
| [`kinetic-link.json`](../../src/game/entities/templates/kinetic-link.json) | `KINETIC_LINK.exe` | `25` | `4` | `dash_attack`: Dashes up to 3 tiles into a target and deals `5` physical damage. |
| [`ghost-pulse.json`](../../src/game/entities/templates/ghost-pulse.json) | `GHOST_PULSE.exe` | `30` | `5` | `vision_pulse` (`visionRadius: 10`). *(Effect handler pending in `firmware.ts` — see [TRACKING.md](../TRACKING.md)).* |
| [`logic-jam.json`](../../src/game/entities/templates/logic-jam.json) | `LOGIC_JAM.exe` | `20` | `3` | `stun`. *(Effect handler pending in `firmware.ts` — see [TRACKING.md](../TRACKING.md)).* |

---

## 3. Augments: The "Trigger & Payload" Synergy Engine ([`src/game/systems/augment.ts`](../../src/game/systems/augment.ts))

Augments evaluate composable boolean condition trees (`AND`, `OR`, `ON_ACTIVATION`, `ON_TARGET_HIT`, `ON_OVERCLOCK`, `ON_KILL`) during `Phase.REACTION`. When triggered, they apply payloads (`HEAL`, `SHIELD`, `VENT_HEAT`, `DAMAGE_BONUS`) and emit `AUGMENT_FLASH` for HUD feedback.

### Implemented Augment Templates
| Template | Name | Trigger Tree | Payload | Cooldown / Max per Turn |
| :--- | :--- | :--- | :--- | :---: |
| [`displacement-venting.json`](../../src/game/entities/templates/displacement-venting.json) | `Displacement_Venting.arc` | `ON_ACTIVATION` | `VENT_HEAT`: Instantly vents `15` Neural Heat. | `0` CD / `1` per turn |
| [`static-siphon.json`](../../src/game/entities/templates/static-siphon.json) | `Static_Siphon.arc` | `AND(ON_ACTIVATION, ON_KILL)` | `SHIELD`: Grants `5` Shield for `1` turn. | `2` turns CD / `1` per turn |
| [`neural-feedback.json`](../../src/game/entities/templates/neural-feedback.json) | `Neural_Feedback.arc` | `ON_KILL` | `DAMAGE_BONUS`: Grants `+25%` bonus attack damage for `1` turn. | `1` turn CD / `1` per turn |

> [!NOTE]
> Additional planned augment designs (`Thermal_Sink.arc` for next-ability heat reduction and `Adrenaline_Patch.pkg` for Overclock speed boost) and narrower trigger conditions are tracked in [TRACKING.md](../TRACKING.md).

---

## 4. Shell Archetypes & Starter Loadouts ([`src/game/shells/shared/templates/`](../../src/game/shells/shared/templates/))

| Shell Template | Display Name | Base Stats (`HP` / `Speed` / `Stability` / `Armor`) | Base Ports (`FW` / `AUG` / `SW`) | Starter Loadout |
| :--- | :--- | :---: | :---: | :--- |
| [`vanguard-v1.json`](../../src/game/shells/shared/templates/vanguard-v1.json) | `VANGUARD-v1` | `20` / `120` / `5` / `2` | `2` / `1` / `2` | `basic-strike`, `kinetic-link` |
| [`bastion-v1.json`](../../src/game/shells/shared/templates/bastion-v1.json) | `BASTION-v1` | `25` / `80` / `10` / `3` | `1` / `1` / `1` | *(None — pre-populated via default profile)* |
| [`ghost-v1.json`](../../src/game/shells/shared/templates/ghost-v1.json) | `GHOST-v1` | `15` / `100` / `8` / `1` | `2` / `2` / `3` | `ghost-pulse`, `logic-jam` |

---

## 5. Heat Visual Escalation & The Kernel Panic Table

### Visual Escalation Tiers ([`src/game/config/heat-tiers.ts`](../../src/game/config/heat-tiers.ts))
* **`0–49%` (`clean`)**: Clean Cyan HUD.
* **`50–79%` (`jitter`)**: Subtle HUD jitter.
* **`80–99%` (`ghosting`)**: Sprite ghosting and neon magenta trail.
* **`100–119%` (`inversion`)**: Corruption Zone entry; color inversion pulse.
* **`120–159%` (`screen-tear`)**: Heavy scanline screen-tearing.
* **`160%+` (`grayscale`)**: Critical thermal overload; world desaturates.

### Kernel Panic Overclock Table ([`src/game/systems/kernel-panic.ts`](../../src/game/systems/kernel-panic.ts))
When `Heat > 100%` (the **Corruption Zone**), `KernelPanicSystem` rolls against all eligible tiers during `Phase.CLEANUP` (reducing each tier's base chance by `shell.stability * 1%`):

| Tier | Heat Range | Base Panic Chance | Status Effect Applied | Effect Behavior |
| :---: | :---: | :---: | :--- | :--- |
| **1** | `101–120%` | **15%** | `HUD_GLITCH` (`2` turns) | HUD elements flicker and glitch. |
| **2** | `121–140%` | **25%** | `INPUT_LAG` (`3` turns) | 50% chance per move action for movement to fail (`movement.ts`). |
| **3** | `141–160%` | **50%** | `FIRMWARE_LOCK` (`2` turns) | All Firmware abilities are disabled (`firmware.ts`). |
| **4** | `161%+` | **100%** | `CRITICAL_REBOOT` (`3` turns) | Stuns the Shell and forces an emergency `VentIntent`. |
