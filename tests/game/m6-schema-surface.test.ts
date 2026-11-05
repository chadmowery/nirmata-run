import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  Heat,
  Health,
  Prop,
  Container,
  InteractiveSurface,
  RunCurrency,
  RunInventory,
  InteractPropIntent,
} from '@shared/components';
import { DamageIntent } from '@shared/components/intents';
import { handlePropDestruction } from '../../src/game/systems/combat';
import { createPropInteractionSystem } from '../../src/game/systems/prop-interaction';

describe('M6: Schema Surface Implementations & Pruning', () => {
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
    world.addComponent(playerId, Health, { current: 50, max: 50, isAlive: true });
    world.addComponent(playerId, Heat, {
      current: 10,
      maxSafe: 100,
      baseDissipation: 5,
      ventPercentage: 0.5,
      isVenting: false,
    });
    world.addComponent(playerId, RunCurrency, { stacks: [] });
    world.addComponent(playerId, RunInventory, {
      maxSlots: 10,
      software: [],
      equipment: [],
    });
  });

  it('triggers thermal_burst hazard dealing 8 environmental damage and injecting Heat on destroy', () => {
    const propId = world.createEntity();
    world.addComponent(propId, Position, { x: 5, y: 6 }); // Distance 1
    world.addComponent(propId, InteractiveSurface, {
      surfaceId: 'thermal_manifold',
      destructible: true,
      hazardOnDestroy: 'thermal_burst',
      cascadeRadius: 2,
    });

    handlePropDestruction(world, grid, eventBus, propId, 999);

    // Player should have received DamageIntent of 8 environmental damage
    const damageIntent = world.getComponent(playerId, DamageIntent);
    expect(damageIntent).toBeDefined();
    expect(damageIntent?.amount).toBe(8);
    expect(damageIntent?.damageType).toBe('environmental');

    // Player should have received +25 Heat: 10 -> 35
    const heat = world.getComponent(playerId, Heat)!;
    expect(heat.current).toBe(35);
  });

  it('yields blueprints from containers with blueprintId on search', () => {
    const propId = world.createEntity();
    world.addComponent(propId, Prop, {
      propId: 'locked_vault_container',
      faction: 'cyberacme',
      propClass: 'encrypted_safe',
      isSearched: false,
    });
    world.addComponent(propId, Position, { x: 5, y: 6 });
    world.addComponent(propId, Container, {
      containerId: 'vault_safe_1',
      capacity: 4,
      storedLoot: [],
      itemEntityIds: [],
      blueprintId: 'phase-shift',
      blueprintType: 'firmware',
    });

    const propSystem = createPropInteractionSystem(world, grid, eventBus);
    propSystem.init();

    world.addComponent(playerId, InteractPropIntent, { targetPropId: propId });
    propSystem.update(world);

    // Verify blueprint stack was added to RunCurrency
    const runCurrency = world.getComponent(playerId, RunCurrency)!;
    const bpStack = runCurrency.stacks.find(
      (s) => s.currencyType === 'blueprint' && s.blueprintId === 'phase-shift',
    );
    expect(bpStack).toBeDefined();
    expect(bpStack?.amount).toBe(1);
    expect(bpStack?.blueprintType).toBe('firmware');
  });
});
