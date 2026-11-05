import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { EngineEvents } from '../../src/engine/events/types';
import { createECSWorldDelta } from '../../src/shared/ecs-delta';
import { serializeWorld } from '../../src/shared/serialization';
import { Position } from '../../src/shared/components/position';
import { Health } from '../../src/shared/components/health';
import { Container, CorruptedNode } from '../../src/shared/components/environment';

describe('ECS World Delta Replication (Phase 3)', () => {
  let world: World<EngineEvents>;
  let eventBus: EventBus<EngineEvents>;

  beforeEach(() => {
    eventBus = new EventBus<EngineEvents>();
    world = new World<EngineEvents>(eventBus);
  });

  it('computes compact delta for modified component data', () => {
    const e1 = world.createEntity();
    world.addComponent(e1, Position, { x: 5, y: 5 });
    world.addComponent(e1, Health, { current: 100, max: 100, isAlive: true });

    const e2 = world.createEntity();
    world.addComponent(e2, Position, { x: 10, y: 10 });

    const oldState = serializeWorld(world);

    // Modify e1 position only
    world.patchComponent(e1, Position, { x: 6 });

    const newState = serializeWorld(world);
    const delta = createECSWorldDelta(oldState, newState);

    expect(delta.entitiesAdded).toEqual([]);
    expect(delta.entitiesRemoved).toEqual([]);
    expect(delta.componentsRemoved).toEqual([]);
    expect(delta.componentsSet).toHaveLength(1);
    expect(delta.componentsSet[0]).toEqual({
      component: 'position',
      entityId: e1,
      data: { x: 6, y: 5 },
    });
  });

  it('computes delta for entity addition and deletion', () => {
    const e1 = world.createEntity();
    world.addComponent(e1, Position, { x: 1, y: 1 });

    const oldState = serializeWorld(world);

    // Add e2 and destroy e1
    const e2 = world.createEntity();
    world.addComponent(e2, Position, { x: 2, y: 2 });
    world.destroyEntity(e1);

    const newState = serializeWorld(world);
    const delta = createECSWorldDelta(oldState, newState);

    expect(delta.entitiesAdded).toEqual([e2]);
    expect(delta.entitiesRemoved).toEqual([e1]);
    expect(delta.componentsSet).toEqual([
      { component: 'position', entityId: e2, data: { x: 2, y: 2 } },
    ]);
  });

  it('applies delta in-place without throwing TypeError when target store is uninitialized', () => {
    const targetWorld = new World<EngineEvents>(eventBus);

    // Apply delta to fresh world where stores Map is empty
    expect(() => {
      targetWorld.applyDelta({
        nextId: 10,
        entitiesAdded: [1, 2],
        componentsSet: [
          { component: 'position', entityId: 1, data: { x: 10, y: 20 } },
          { component: 'custom_comp', entityId: 2, data: { value: 'test' } },
        ],
      });
    }).not.toThrow();

    expect(targetWorld.getComponent(1, Position)).toEqual({ x: 10, y: 20 });
    expect(targetWorld.entityExists(1)).toBe(true);
    expect(targetWorld.entityExists(2)).toBe(true);

    // Remove component
    targetWorld.applyDelta({
      componentsRemoved: [{ component: 'position', entityId: 1 }],
    });
    expect(targetWorld.hasComponent(1, Position)).toBe(false);

    // Remove entity
    targetWorld.applyDelta({
      entitiesRemoved: [1],
    });
    expect(targetWorld.entityExists(1)).toBe(false);
  });

  it('redacts container loot and unrevealed trap types when redactForClient is enabled', () => {
    const e1 = world.createEntity();
    world.addComponent(e1, Container, {
      containerId: 'e1',
      capacity: 4,
      itemEntityIds: [],
      storedLoot: [{ templateId: 'item-nanite-injector' }],
      scrapYield: 25,
      fluxYield: 5,
      grantsAccessKey: true,
      blueprintId: 'bp-123',
    });

    const e2 = world.createEntity();
    world.addComponent(e2, CorruptedNode, {
      trapType: 'thermal_dump',
      revealed: false,
    });

    const oldState = serializeWorld(world);

    // Patch container capacity and reveal node
    world.patchComponent(e1, Container, { capacity: 5 });
    world.patchComponent(e2, CorruptedNode, { revealed: true });

    const newState = serializeWorld(world);
    const delta = createECSWorldDelta(oldState, newState, { redactForClient: true });

    const containerSet = delta.componentsSet.find((c) => c.component === 'container');
    expect(containerSet).toBeDefined();
    const cData = containerSet!.data as Record<string, unknown>;
    expect(cData.storedLoot).toBeUndefined();
    expect(cData.scrapYield).toBeUndefined();
    expect(cData.fluxYield).toBeUndefined();
    expect(cData.grantsAccessKey).toBeUndefined();
    expect(cData.blueprintId).toBeUndefined();
    expect(cData.capacity).toBe(5);

    const nodeSet = delta.componentsSet.find((c) => c.component === 'corruptedNode');
    expect(nodeSet).toBeDefined();
    const nData = nodeSet!.data as Record<string, unknown>;
    // Now that revealed is true, trapType is revealed!
    expect(nData.trapType).toBe('thermal_dump');
    expect(nData.revealed).toBe(true);
  });
});
