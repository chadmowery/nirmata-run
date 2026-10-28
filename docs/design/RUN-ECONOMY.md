# Run Economy, Neural Deck Hub & Weekly Reset

The between-run economy connects daily preparation runs to the high-stakes **Weekly One-Shot Challenge**. Between runs, players operate from the **Neural Deck** (`src/components/ui/hub/`), a clean-room terminal interface with five tabs: **Shell**, **Loadout**, **Workshop**, **Vault**, and **Initialize**.

---

## 1. The Three-Tier Currency Ecosystem ([`economy.json`](../../src/game/entities/templates/economy.json))

| Currency | Wallet Cap | Primary Sources | Primary Uses |
| :--- | :---: | :--- | :--- |
| **Raw Scrap** (`scrap`) | `10,000` | Enemy drops (`5–50` by tier), selling Vault items, 25% Death Pity payout. | Purchasing Software in the Hub Shop (`30–250` Scrap) and installing compiled Blueprints onto a Shell (`25` Scrap Firmware / `15` Scrap Augment). |
| **Neural Blueprints** (`blueprint`) | Library | Rare drops from Tier 2 (`25%`) and Tier 3 (`100%`) enemies (`blueprint-locked.json`). | Unlocks Firmware and Augment recipes in the Workshop for compilation. |
| **Flux** (`flux`) | `1,000` | Tier 2/3 enemy drops (`5–50`), successful Anchor Extraction bonus (`10 + 2 * floor`), selling Vault items. | Compiling locked Blueprints (`50–500` Flux by rarity) and upgrading Shell stats/ports (`40` Flux base × `1.6^level`). |

---

## 2. The Core Loop: Scavenge → Compile → Equip → Initialize

### Step 1: Scavenging (Neural Simulations & Daily Runs)
* **Neural Simulations (`SIMULATION`)**: Unlimited attempts on random seeds. Used to farm Scrap, Flux, Software, and Blueprints.
* **Daily Challenge (`DAILY`)**: 1 attempt per day on a shared seed with leaderboard scoring.
* **Extraction vs. Death**:
  * **Successful Extraction (at a Stability Anchor)**: Secures 100% of collected Scrap, Flux (plus extraction bonus), and `RunInventory` Software into the player's Profile Wallet and Vault.
  * **Death / Reality Collapse**: Retains **25% of collected Scrap** as a pity payout (`pityScrapPercentage: 0.25`); all in-run Flux and unextracted inventory items are lost.

### Step 2: Compiling & Upgrading (The Workshop — [`/api/economy/*`](../../src/app/api/economy/))
* **Blueprint Compilation (`/api/economy/compile`)**: Spend Flux (`common: 50`, `uncommon: 100`, `rare: 200`, `legendary: 500`) to unlock a Blueprint permanently for the current week.
* **Blueprint Installation (`/api/economy/install`)**: Spend Scrap (`firmware: 25`, `augment: 15`) to install a compiled Firmware or Augment into a Shell's available port slots.
* **Shell Upgrades (`/api/economy/upgrade`)**: Spend Flux to upgrade a Shell's base stats (`maxHealth`, `speed`, `stability`, `armor`) or port capacities.
* **Software Shop (`/api/economy/purchase`)**: Deterministic rotating shop inventory ([`shop-rotation.ts`](../../src/game/systems/shop-rotation.ts)) selling Software modules for Scrap.

### Step 3: Vault & Loadout Management ([`/api/vault/*`](../../src/app/api/vault/))
* **Vault Storage**: Holds up to `30` items (`VAULT_MAX_SLOTS` in [`src/shared/vault.ts`](../../src/shared/vault.ts)). Any items extracted beyond capacity enter **Overflow** (`profile.overflow`), which must be resolved (moved to Vault, sold for Scrap/Flux, or discarded) before launching a new run.
* **Equipping & Uninstalling**: Items can be equipped from the Vault onto a Shell (`/api/vault/equip-from-vault`, validated against the Shell's `PortConfig` slot limits) or uninstalled back to the Vault (`/api/economy/uninstall`).
* **In-Run Equipment & Software (`InventoryOverlay.tsx`)**: During a run, players can press `I` to drag-and-drop Weapons, Armor, and Software between their Backpack (`RunInventory`) and active slots (`EQUIP`, `UNEQUIP`, `BURN_SOFTWARE`, `INVENTORY_SWAP`).

---

## 3. Weekly Reset & "Legacy Code" Entropy ([`weekly-reset.ts`](../../src/game/systems/weekly-reset.ts))

To prevent permanent power creep while respecting player investment, the weekly reset (`executeWeeklyReset`) performs a seasonal rotation:
1. **Uninstalled Blueprint Purge**: Uninstalled blueprints in `blueprintLibrary` are cleared.
2. **Legacy Code Degradation ([`legacy-code.ts`](../../src/game/systems/legacy-code.ts))**: Firmware and Augments already installed on a Shell survive the reset, but are flagged `isLegacy: true`:
   * **Legacy Firmware**: Neural Heat cost **doubles** (`baseHeatCost * 2`).
   * **Legacy Augments**: Payload magnitude is **halved** (`baseMagnitude * 0.5`).
3. **Shell Upgrade Reset & Currency Caps**: `shellUpgrades` reset to `{}` and Wallet balances cap at `10,000` Scrap / `1,000` Flux.
4. **Winner's Item Rotation**: Rotates the weekly featured `winnersItem` from `economy.json`.

> [!IMPORTANT]
> Several economy edge cases (propagating `isLegacy` onto spawned entities in `engine-factory.ts`, applying `shellUpgrades` on run launch, enforcing profile death penalties on `installedItems`, persisting extracted blueprints, and aligning the `VAULT_CAPACITY = 20` constant in `/api/action`) are tracked in [TRACKING.md](../TRACKING.md).
