# AI Debugging Guide

When working autonomously to debug gameplay systems, event pipelines, or UI interactions in Nirmata Runner, use the built-in Debug API to stimulate game states deterministically without needing to play the game manually.

## How to interact with the Debug System

You have two options depending on your available tools:

### Option 1: Headless Execution (Preferred)
If your browser automation tool supports evaluating JavaScript directly on the page, use the global `window.__DEBUG__` object.

```javascript
// Example: Force heat to maximum to test overclock limits
window.__DEBUG__.setHeat(100);

// Example: Trigger a specific Kernel Panic tier directly
window.__DEBUG__.triggerPanic(2, 'high', 'Corrupted Memory');

// Example: Spawn 50 scrap to test shop economy
window.__DEBUG__.giveScrap(50);
```

### Option 2: DOM Terminal Input (Fallback)
If your automation only allows typing and clicking, use the hidden DevTerminal.
The terminal is closed by default. You can toggle it by pressing the backtick ` `` ` key.
Once open, type commands into the input field with `id="dev-console"` and press Enter to execute them.

**Available Commands:**
- `/heat [amount]` - Sets the player's heat.
- `/hp [amount]` - Sets the player's health.
- `/stability [amount]` - Sets the player's stability.
- `/panic [tier] [severity]` - Immediately triggers a kernel panic consequence.
- `/give scrap [amount]` - Immediately picks up scrap.
- `/give flux [amount]` - Immediately picks up flux.
- `/give blueprint [id]` - Immediately picks up a specific blueprint.
- `/status [effectName] [duration]` - Applies a status effect (e.g. burning) for a number of turns.
- `/descend` - Immediately forces a floor transition (descends stairs).
- `/deadzone` - Spawns a dead zone tile directly beneath the player to test hazards.

### Notes
- The debug system is only available when `process.env.NODE_ENV === 'development'`.
- These commands dispatch actual `GameplayEvents` onto the `EventBus` without skipping standard engine reconciliation logic, ensuring you are testing the real event flow.
- If an expected response doesn't happen when using these commands, the bug is likely in the system that handles the respective event (e.g. `HeatSystem`, `KernelPanicSystem`).
