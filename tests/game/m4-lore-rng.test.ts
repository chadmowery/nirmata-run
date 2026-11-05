import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  Prop,
  Container,
  InteractPropIntent,
} from '@shared/components';
import {
  createPropInteractionSystem,
  CORPORATE_FORENSICS_LOGS,
} from '../../src/game/systems/prop-interaction';

describe('M4: Seeded Deterministic Forensics Lore Selection', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
  });

  it('uses seeded rng instead of Math.random to pick atmospheric lore log', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random');

    const propId = world.createEntity();
    world.addComponent(propId, Prop, {
      propId: 'prop_cyber_1',
      faction: 'cyberacme',
      propClass: 'workstation',
      isSearched: false,
    });
    world.addComponent(propId, Position, { x: 5, y: 6 });
    world.addComponent(propId, Container, {
      containerId: 'container_1',
      storedLoot: [],
      itemEntityIds: [],
    });

    const mockRng = { random: vi.fn().mockReturnValue(0.99) };
    const propSystem = createPropInteractionSystem(
      world,
      grid,
      eventBus,
      undefined,
      undefined,
      mockRng,
    );
    propSystem.init();

    const messageSpy = vi.fn();
    eventBus.on('MESSAGE_EMITTED', messageSpy);

    world.addComponent(playerId, InteractPropIntent, {
      targetPropId: propId,
    });

    propSystem.update(world);
    eventBus.flush();

    // Verify Math.random was NOT called for lore selection
    expect(mathRandomSpy).not.toHaveBeenCalled();
    expect(mockRng.random).toHaveBeenCalled();

    const expectedLogs = CORPORATE_FORENSICS_LOGS.cyberacme;
    const expectedLog = expectedLogs[expectedLogs.length - 1];
    expect(messageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expectedLog,
        type: 'info',
      }),
    );

    mathRandomSpy.mockRestore();
  });
});
