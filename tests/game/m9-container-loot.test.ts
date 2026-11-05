import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import {
  Position,
  Actor,
  Health,
  Prop,
  Container,
  Children,
  RunInventory,
  RunCurrency,
  SoftwareDef,
  TemplateId,
  RarityTier,
  EquipmentDef,
  Dying,
  COMPONENTS_REGISTRY,
} from '@shared/components';
import { InteractPropIntent } from '@shared/components/environment';
import { GameplayEvents } from '@shared/events/types';
import { createPropInteractionSystem } from '../../src/game/systems/prop-interaction';
import { createGravediggerSystem } from '../../src/game/systems/gravedigger';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { ComponentRegistry } from '@engine/entity/types';
import { ComponentDef } from '@engine/ecs/types';

describe('M9: Container Loot Transfer & Ground Overflow Invariants', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let entityRegistry: EntityRegistry;
  let factory: EntityFactory;
  let registry: ComponentRegistry;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    const componentsMap: Record<string, ComponentDef<unknown>> = Object.fromEntries(
      COMPONENTS_REGISTRY.map((component) => [component.key, component]),
    );
    registry = {
      get: (key: string) => componentsMap[key],
      has: (key: string) => !!componentsMap[key],
    };

    entityRegistry = new EntityRegistry();
    entityRegistry.register({
      name: 'item-software-bleed',
      components: {
        softwareDef: {
          name: 'Bleed.exe',
          type: 'bleed',
          targetSlot: 'weapon',
          baseMagnitude: 5,
          effectType: 'dot',
          description: 'Applies bleed DoT on target hit',
        },
        rarityTier: { tier: 'v1.x', scaleFactor: 1.0 },
      },
    });
    entityRegistry.register({
      name: 'item-rifle',
      components: {
        equipmentDef: { name: 'Rifle Mk.I', slotType: 'weapon' },
        rarityTier: { tier: 'v1.x', scaleFactor: 1.0 },
      },
    });
    factory = new EntityFactory(entityRegistry);
  });

  it('transfers searched container items directly into player RunInventory', () => {
    const propSys = createPropInteractionSystem(world, grid, eventBus, factory, registry);
    propSys.init();

    // Player at (5, 5) with empty inventory (maxSlots: 10)
    const player = world.createEntity();
    world.addComponent(player, Position, { x: 5, y: 5 });
    world.addComponent(player, Actor, { isPlayer: true });
    world.addComponent(player, RunInventory, {
      software: [],
      equipment: [],
      maxSlots: 10,
    });
    world.addComponent(player, RunCurrency, { stacks: [] });

    // Container at (5, 6) with 2 stored loot items
    const container = world.createEntity();
    world.addComponent(container, Position, { x: 5, y: 6 });
    world.addComponent(container, Prop, {
      propId: 'traxus_crate_1',
      propClass: 'locker',
      faction: 'traxus',
      isSearched: false,
    });
    world.addComponent(container, Container, {
      containerId: 'crate_1',
      storedLoot: [
        { templateId: 'item-software-bleed', rarityTier: 'common' },
        { templateId: 'item-rifle', rarityTier: 'common' },
      ],
    });

    world.addComponent(player, InteractPropIntent, {
      targetPropId: container,
      forceOverride: true,
    });

    world.executeSystems(Phase.ACTION);
    eventBus.flush();

    // Container should be searched with empty storedLoot
    const contData = world.getComponent(container, Container)!;
    expect(contData.storedLoot).toEqual([]);
    expect(contData.itemEntityIds).toEqual([]); // No ground overflow
    expect(world.hasComponent(container, Children)).toBe(false);

    // Player inventory received both items
    const inv = world.getComponent(player, RunInventory)!;
    expect(inv.software.length).toBe(1);
    expect(inv.software[0].templateId).toBe('item-software-bleed');
    expect(inv.equipment.length).toBe(1);
    expect(inv.equipment[0].templateId).toBe('item-rifle');
  });

  it('overflows uncollected items to the ground when inventory is full and avoids Children attachment', () => {
    const propSys = createPropInteractionSystem(world, grid, eventBus, factory, registry);
    propSys.init();
    const gravedigger = createGravediggerSystem(world, grid);
    gravedigger.init();

    // Player at (5, 5) with a FULL inventory (maxSlots: 1, 1 item already equipped)
    const player = world.createEntity();
    world.addComponent(player, Position, { x: 5, y: 5 });
    world.addComponent(player, Actor, { isPlayer: true });
    world.addComponent(player, RunInventory, {
      software: [
        {
          entityId: 999,
          templateId: 'existing-software',
          rarityTier: 'common',
          pickedUpAtFloor: 1,
          pickedUpAtTimestamp: 0,
        },
      ],
      equipment: [],
      maxSlots: 1,
    });
    world.addComponent(player, RunCurrency, { stacks: [] });

    // Container at (5, 6) with stored loot
    const container = world.createEntity();
    world.addComponent(container, Position, { x: 5, y: 6 });
    world.addComponent(container, Prop, {
      propId: 'traxus_safe_1',
      propClass: 'encrypted_safe',
      faction: 'traxus',
      isSearched: false,
    });
    world.addComponent(container, Container, {
      containerId: 'safe_1',
      storedLoot: [{ templateId: 'item-rifle', rarityTier: 'common' }],
    });

    world.addComponent(player, InteractPropIntent, {
      targetPropId: container,
      forceOverride: true,
    });

    world.executeSystems(Phase.ACTION);
    eventBus.flush();

    // Player inventory was full, so item could not be added
    const inv = world.getComponent(player, RunInventory)!;
    expect(inv.equipment.length).toBe(0);

    // Loot overflowed to ground
    const contData = world.getComponent(container, Container)!;
    expect(contData.itemEntityIds?.length).toBe(1);
    const groundItemId = contData.itemEntityIds![0];

    // Assert container does NOT have Children component (to protect ground loot from Gravedigger cascade)
    expect(world.hasComponent(container, Children)).toBe(false);

    // Assert ground item has Position at (5, 6)
    const itemPos = world.getComponent(groundItemId, Position);
    expect(itemPos).toBeDefined();
    expect(itemPos?.x).toBe(5);
    expect(itemPos?.y).toBe(6);

    // Now condemn container with Dying and run Phase.CLEANUP
    world.addComponent(container, Dying, { killerId: player, reason: 'environmental_destruction' });
    world.executeSystems(Phase.CLEANUP);
    eventBus.flush();

    // Container is destroyed by Gravedigger
    expect(world.entityExists(container)).toBe(false);

    // CRITICAL INVARIANT: Ground item is NOT destroyed because it was not attached as a child!
    expect(world.entityExists(groundItemId)).toBe(true);
  });
});
