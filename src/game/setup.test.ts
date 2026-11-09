// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, deriveSemanticAction } from './setup';
import { GameState } from './states/types';
import { GameAction } from './input/actions';
import { serializeWorld } from '@shared/serialization';
import { createDefaultProfile } from '@shared/profile';
import { gameStore } from './ui/store';
import * as Components from '@shared/components';
const { Position, Actor, Energy, Hostile, Health, Attack } = Components;

describe('Game Setup Integration', () => {
  let context: ReturnType<typeof createGame>;

  beforeEach(() => {
    // Basic config for tests
    context = createGame({ gridWidth: 10, gridHeight: 10 });
    // Mock fetch for action calls
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          payload: {
            type: 'DELTA',
            world: { nextId: 100, entities: [], stores: {} },
            grid: [],
            events: [],
            turnNumber: 1,
          },
        }),
      }),
    );
  });

  it('should initialize with all required modules', () => {
    expect(context.world).toBeDefined();
    expect(context.grid).toBeDefined();
    expect(context.eventBus).toBeDefined();
    expect(context.fsm).toBeDefined();
    expect(context.turnManager).toBeDefined();
    expect(context.inputManager).toBeDefined();
    expect(context.movementSystem).toBeDefined();
  });

  it('should start in Loading state', () => {
    expect(context.fsm.getCurrentState()).toBe(GameState.Loading);
  });

  it('should disable input when transitioning to MainMenu', () => {
    // Transition to MainMenu
    context.fsm.transition(GameState.MainMenu);
    expect(context.fsm.getCurrentState()).toBe(GameState.MainMenu);
    expect(context.inputManager.isEnabled()).toBe(false);
  });

  it('should enable input and start turn manager when transitioning to Playing', () => {
    // Need to go Loading -> MainMenu -> Playing to follow transition table
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);

    expect(context.fsm.getCurrentState()).toBe(GameState.Playing);
    expect(context.inputManager.isEnabled()).toBe(true);
  });

  it('should disable input when pausing', () => {
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);
    context.fsm.transition(GameState.Paused);

    expect(context.fsm.getCurrentState()).toBe(GameState.Paused);
    expect(context.inputManager.isEnabled()).toBe(false);
  });

  it('should process movement through input -> turn manager -> movement system', () => {
    const { world, grid, fsm, turnManager, inputManager } = context;

    // 1. Get player from context
    const player = context.playerId;
    if (player === undefined) throw new Error('Player not found');

    // Ensure floor is walkable
    grid.setTile(1, 1, { terrain: 'floor', walkable: true, transparent: true });
    grid.setTile(2, 1, { terrain: 'floor', walkable: true, transparent: true });

    if (world.hasComponent(player, Position)) {
      world.patchComponent(player, Position, { x: 1, y: 1 });
    }
    if (world.hasComponent(player, Energy)) {
      world.patchComponent(player, Energy, { current: 1000, speed: 100, threshold: 1000 });
    }
    grid.removeEntity(player, 5, 4); // Remove from default spawn if any
    grid.addEntity(player, 1, 1);

    // 2. Transition to Playing
    fsm.transition(GameState.MainMenu);
    fsm.transition(GameState.Playing);

    // 3. Simulate input action via InputManager (mocking the handler call)
    // Actually we can just get the handler and call it directly
    const actionHandler = (inputManager as any).handler;
    expect(actionHandler).toBeDefined();

    // 4. Submit MOVE_EAST action
    actionHandler(GameAction.MOVE_EAST);

    // 5. Verify movement
    const pos = world.getComponent(player, Position);
    expect(pos?.x).toBe(2);
    expect(pos?.y).toBe(1);

    // 6. Verify energy deduction and replenishment (TurnManager auto-advances until ready)
    const energy = world.getComponent(player, Energy);
    expect(energy?.current).toBe(1000);
  });

  it('should handle bump-attack when moving into hostile', async () => {
    const { world, grid, fsm, inputManager, eventBus } = context;
    const emitSpy = vi.spyOn(eventBus, 'emit');

    // 1. Get player from context
    const player = context.playerId;
    if (player === undefined) throw new Error('Player not found');

    // Ensure floor is walkable
    grid.setTile(1, 1, { terrain: 'floor', walkable: true, transparent: true });
    grid.setTile(2, 1, { terrain: 'floor', walkable: true, transparent: true });

    if (world.hasComponent(player, Position)) {
      world.patchComponent(player, Position, { x: 1, y: 1 });
    }
    if (world.hasComponent(player, Energy)) {
      world.patchComponent(player, Energy, { current: 1000, speed: 100, threshold: 1000 });
    }
    world.addComponent(player, Attack, { power: 5 });
    grid.removeEntity(player, 5, 4); // Remove from default spawn
    grid.addEntity(player, 1, 1);

    // 2. Create hostile enemy
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: 2, y: 1 });
    world.addComponent(enemy, Hostile, {});
    world.addComponent(enemy, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(enemy, Actor, { isPlayer: false });
    grid.addEntity(enemy, 2, 1);

    // 3. Transition to Playing
    fsm.transition(GameState.MainMenu);
    fsm.transition(GameState.Playing);

    // Mock server response returning authoritative DAMAGE_DEALT
    const currentWorld = serializeWorld(world);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        payload: {
          type: 'DELTA',
          world: currentWorld,
          grid: [],
          events: [
            {
              type: 'DAMAGE_DEALT',
              payload: { attackerId: player, defenderId: enemy, damage: 5 },
            },
          ],
          turnNumber: 1,
          playerId: player,
        },
      }),
    } as any);

    // 4. Submit MOVE_EAST action
    const actionHandler = (inputManager as any).handler;
    await actionHandler(GameAction.MOVE_EAST);

    // 5. Verify DAMAGE_DEALT event emitted from server reconciliation
    expect(emitSpy).toHaveBeenCalledWith(
      'DAMAGE_DEALT',
      expect.objectContaining({
        attackerId: player,
        defenderId: enemy,
      }),
    );

    // 6. Verify player stayed in place
    const pos = world.getComponent(player, Position);
    expect(pos?.x).toBe(1);
  });

  it('should transition to Paused when PAUSE action is received in Playing state', () => {
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);

    const actionHandler = (context.inputManager as any).handler;
    actionHandler(GameAction.PAUSE);

    expect(context.fsm.getCurrentState()).toBe(GameState.Paused);
    expect(context.inputManager.isEnabled()).toBe(false);
  });

  it('should transition back to Playing when PAUSE action is received in Paused state', () => {
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);
    context.fsm.transition(GameState.Paused);

    // Since input is disabled in Paused state via FSM hook, we simulate the action handler call directly
    // In a real scenario, the Pause Menu would handle its own input or re-enable it.
    // For now the ActionHandler logic in setup.ts handles PAUSE mapping regardless of canAcceptInput?
    // Wait, let's look at setup.ts:
    // if (action === GameAction.PAUSE) { ... return; }
    // It's outside the turnManager.canAcceptInput() check.

    const actionHandler = (context.inputManager as any).handler;
    actionHandler(GameAction.PAUSE);

    expect(context.fsm.getCurrentState()).toBe(GameState.Playing);
    expect(context.inputManager.isEnabled()).toBe(true);
  });

  it('should close inventory instead of pausing when inventory is visible and PAUSE action is received', () => {
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);

    gameStore.setState({ inventoryVisible: true });
    expect(gameStore.getState().inventoryVisible).toBe(true);

    const actionHandler = (context.inputManager as any).handler;
    actionHandler(GameAction.PAUSE);

    expect(gameStore.getState().inventoryVisible).toBe(false);
    expect(context.fsm.getCurrentState()).toBe(GameState.Playing);
    expect(context.inputManager.isEnabled()).toBe(true);
  });

  it('should equip starter abilities when profile is passed to createGame', () => {
    const profile = createDefaultProfile('test-session-setup');
    const customContext = createGame({
      gridWidth: 10,
      gridHeight: 10,
      profile,
      shellId: 'vanguard-v1',
    });

    const player = customContext.playerId;
    expect(player).toBeDefined();
    const firmwareSlots = customContext.world.getComponent(player!, Components.FirmwareSlots);
    expect(firmwareSlots).toBeDefined();
    expect(firmwareSlots?.equipped.length).toBe(2);

    const ability0 = customContext.world.getComponent(
      firmwareSlots!.equipped[0],
      Components.AbilityDef,
    );
    const ability1 = customContext.world.getComponent(
      firmwareSlots!.equipped[1],
      Components.AbilityDef,
    );
    expect(ability0?.name).toBe('BASIC_STRIKE.exe');
    expect(ability1?.name).toBe('KINETIC_LINK.exe');
  });

  describe('deriveSemanticAction', () => {
    it('returns specific intent names for non-move intents', () => {
      expect(deriveSemanticAction({ type: 'WAIT' })).toBe('WAIT');
      expect(deriveSemanticAction({ type: 'VENT' })).toBe('VENT');
      expect(deriveSemanticAction({ type: 'USE_FIRMWARE', slotIndex: 0, targetX: 1, targetY: 1 })).toBe('FIRMWARE');
      expect(deriveSemanticAction({ type: 'INTERACT_PROP', targetPropId: 5, forceOverride: false })).toBe('SEARCH');
      expect(deriveSemanticAction({ type: 'STAIRCASE_DESCEND', staircaseId: 10, targetFloor: 2 })).toBe('DESCEND');
      expect(deriveSemanticAction({ type: 'ANCHOR_EXTRACT' })).toBe('EXTRACT');
    });

    it('resolves ATTACK when MOVE intent results in player DAMAGE_DEALT', () => {
      const intent = { type: 'MOVE' as const, dx: 1, dy: 0 };
      const events = [
        { type: 'DAMAGE_DEALT', payload: { attackerId: 1, defenderId: 99, amount: 10 } },
      ];
      expect(deriveSemanticAction(intent, events, 1)).toBe('ATTACK');
    });

    it('resolves SEARCH when MOVE intent results in PROP_INTERACTED or LOCK_UNLOCKED', () => {
      const intent = { type: 'MOVE' as const, dx: 0, dy: 1 };
      const events = [
        { type: 'PROP_INTERACTED', payload: { entityId: 1, propId: 44, propClass: 'cache' } },
      ];
      expect(deriveSemanticAction(intent, events, 1)).toBe('SEARCH');
    });

    it('resolves PICKUP when MOVE intent results in ITEM_PICKED_UP or CURRENCY_PICKED_UP', () => {
      const intent = { type: 'MOVE' as const, dx: -1, dy: 0 };
      const events = [
        { type: 'ITEM_PICKED_UP', payload: { entityId: 1, itemId: 55 } },
      ];
      expect(deriveSemanticAction(intent, events, 1)).toBe('PICKUP');
    });

    it('defaults to MOVE for standard movement without special events', () => {
      const intent = { type: 'MOVE' as const, dx: 0, dy: -1 };
      const events = [
        { type: 'ENTITY_MOVED', payload: { entityId: 1, fromX: 2, fromY: 2, toX: 2, toY: 1 } },
      ];
      expect(deriveSemanticAction(intent, events, 1)).toBe('MOVE');
    });
  });
});
