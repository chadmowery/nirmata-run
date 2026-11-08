import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { GameplayEvents } from '../events/types';
import {
  serializeWorld,
  deserializeWorld,
  serializeGrid,
  deserializeGrid,
  redactWorldForClient,
  redactDeltaForClient,
} from '../serialization';
import { Position } from '../../shared/components/position';
import { Health } from '../../shared/components/health';
import { Container, CorruptedNode } from '../components/environment';
import { AIState, AIBehavior, AIBehaviorType } from '../components/ai-state';
import { createECSWorldDelta } from '../ecs-delta';

describe('Serialization', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new World(eventBus);
    grid = new Grid(10, 10);
  });

  describe('World Serialization', () => {
    it('should perform a lossless round-trip for world state', () => {
      const entityId = world.createEntity();
      world.addComponent(entityId, Position, { x: 5, y: 5 });
      world.addComponent(entityId, Health, Health.schema.parse({ current: 10, max: 10 }));

      const serialized = serializeWorld(world);
      const newWorld = deserializeWorld(serialized, eventBus);

      expect(newWorld.entityExists(entityId)).toBe(true);
      expect(newWorld.getComponent(entityId, Position)).toEqual({ x: 5, y: 5 });
      expect(newWorld.getComponent(entityId, Health)).toEqual(
        expect.objectContaining({ current: 10, max: 10, isAlive: true }),
      );
      expect(serializeWorld(newWorld)).toEqual(serialized);
    });

    it('redacts secret container rolls and unrevealed trap types when redactForClient is true', () => {
      const c1 = world.createEntity();
      world.addComponent(c1, Container, {
        containerId: 'c1',
        capacity: 4,
        itemEntityIds: [],
        highestRarity: 'legendary',
        storedLoot: [{ templateId: 'item-nanite-injector', rarityTier: 'legendary' }],
        scrapYield: 50,
        fluxYield: 15,
        grantsAccessKey: true,
        blueprintId: 'bp-overclock',
        blueprintType: 'firmware',
      });

      const n1 = world.createEntity();
      world.addComponent(n1, CorruptedNode, {
        corruptionLevel: 2,
        trapType: 'thermal_dump',
        revealed: false,
      });

      const n2 = world.createEntity();
      world.addComponent(n2, CorruptedNode, {
        corruptionLevel: 1,
        trapType: 'acoustic_alert',
        revealed: true,
      });

      // 1. Unredacted serialization preserves all secrets (server persistence)
      const serverState = serializeWorld(world);
      const serverContainer = serverState.stores['container']?.[String(c1)] as Record<string, unknown>;
      expect(serverContainer.storedLoot).toBeDefined();
      expect(serverContainer.scrapYield).toBe(50);
      expect(serverContainer.fluxYield).toBe(15);
      expect(serverContainer.grantsAccessKey).toBe(true);
      expect(serverContainer.blueprintId).toBe('bp-overclock');

      const serverNode1 = serverState.stores['corruptedNode']?.[String(n1)] as Record<string, unknown>;
      expect(serverNode1.trapType).toBe('thermal_dump');

      // 2. Redacted serialization strips secrets for client transmission
      const clientState = serializeWorld(world, { redactForClient: true });
      const clientContainer = clientState.stores['container']?.[String(c1)] as Record<string, unknown>;
      expect(clientContainer.storedLoot).toBeUndefined();
      expect(clientContainer.scrapYield).toBeUndefined();
      expect(clientContainer.fluxYield).toBeUndefined();
      expect(clientContainer.grantsAccessKey).toBeUndefined();
      expect(clientContainer.blueprintId).toBeUndefined();
      expect(clientContainer.blueprintType).toBeUndefined();
      // Public inspection properties must remain
      expect(clientContainer.highestRarity).toBe('legendary');
      expect(clientContainer.capacity).toBe(4);
      expect(clientContainer.itemEntityIds).toEqual([]);

      // Unrevealed node trapType is redacted
      const clientNode1 = clientState.stores['corruptedNode']?.[String(n1)] as Record<string, unknown>;
      expect(clientNode1.trapType).toBeUndefined();
      expect(clientNode1.revealed).toBe(false);

      // Revealed node trapType is preserved
      const clientNode2 = clientState.stores['corruptedNode']?.[String(n2)] as Record<string, unknown>;
      expect(clientNode2.trapType).toBe('acoustic_alert');
      expect(clientNode2.revealed).toBe(true);
    });

    it('redactWorldForClient does not mutate the source worldData', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, Container, {
        containerId: 'e1',
        capacity: 4,
        itemEntityIds: [],
        storedLoot: [{ templateId: 'item-stim' }],
        scrapYield: 10,
      });

      const raw = serializeWorld(world);
      const redacted = redactWorldForClient(raw);

      const rawContainer = raw.stores['container']?.[String(e1)] as Record<string, unknown>;
      expect(rawContainer.storedLoot).toBeDefined();
      expect(rawContainer.scrapYield).toBe(10);

      const redactedContainer = redacted.stores['container']?.[String(e1)] as Record<string, unknown>;
      expect(redactedContainer.storedLoot).toBeUndefined();
      expect(redactedContainer.scrapYield).toBeUndefined();
    });

    it('redacts AIState server timers and inlineTree from world state', () => {
      const e1 = world.createEntity();
      world.addComponent(e1, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        sightRadius: 6,
        cooldowns: { phase_ambush: 2 },
        remainingMemoryTurns: 4,
        inlineTree: { type: 'ACTION', task: { action: 'WAIT' } },
      });

      const raw = serializeWorld(world);
      const redacted = redactWorldForClient(raw);

      const rawAi = raw.stores['aiState']?.[String(e1)] as Record<string, unknown>;
      expect(rawAi.cooldowns).toBeDefined();
      expect(rawAi.remainingMemoryTurns).toBe(4);
      expect(rawAi.inlineTree).toBeDefined();

      const redactedAi = redacted.stores['aiState']?.[String(e1)] as Record<string, unknown>;
      expect(redactedAi.cooldowns).toBeUndefined();
      expect(redactedAi.remainingMemoryTurns).toBeUndefined();
      expect(redactedAi.inlineTree).toBeUndefined();
    });

    it('redactWorldForClient strips lastEvaluatedPath on non-visible entities when visibleEntityIds is supplied', () => {
      const visibleEnemy = world.createEntity();
      world.addComponent(visibleEnemy, AIState, {
        behavior: AIBehavior.ATTACKING,
        behaviorType: AIBehaviorType.BASIC,
        lastEvaluatedPath: 'root > attack [SUCCESS]',
      });

      const hiddenEnemy = world.createEntity();
      world.addComponent(hiddenEnemy, AIState, {
        behavior: AIBehavior.CHASING,
        behaviorType: AIBehaviorType.BASIC,
        lastEvaluatedPath: 'root > sneaky-flank [SUCCESS]',
      });

      const raw = serializeWorld(world);
      const redacted = redactWorldForClient(raw, {
        visibleEntityIds: new Set([visibleEnemy]),
      });

      const visibleAi = redacted.stores['aiState']?.[String(visibleEnemy)] as Record<string, unknown>;
      expect(visibleAi.lastEvaluatedPath).toBe('root > attack [SUCCESS]');

      const hiddenAi = redacted.stores['aiState']?.[String(hiddenEnemy)] as Record<string, unknown>;
      expect(hiddenAi.lastEvaluatedPath).toBeUndefined();
    });
  });

  describe('Delta Redaction', () => {
    it('redactDeltaForClient strips container secrets, unrevealed trapType, and AI timers', () => {
      const oldWorld = serializeWorld(world);

      const e1 = world.createEntity();
      world.addComponent(e1, Container, {
        containerId: 'e1',
        capacity: 4,
        itemEntityIds: [],
        storedLoot: [{ templateId: 'item-stim' }],
        scrapYield: 10,
      });
      const e2 = world.createEntity();
      world.addComponent(e2, CorruptedNode, {
        trapType: 'hud_glitch',
        revealed: false,
      });
      const e3 = world.createEntity();
      world.addComponent(e3, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        sightRadius: 6,
        cooldowns: { phase_ambush: 2 },
        remainingMemoryTurns: 3,
        inlineTree: { type: 'ACTION', task: { action: 'WAIT' } },
      });

      const newWorld = serializeWorld(world);
      const delta = createECSWorldDelta(oldWorld, newWorld, { redactForClient: true });

      const containerComp = delta.componentsSet.find((c) => c.component === 'container');
      expect(containerComp).toBeDefined();
      const containerData = containerComp!.data as Record<string, unknown>;
      expect(containerData.storedLoot).toBeUndefined();
      expect(containerData.scrapYield).toBeUndefined();

      const nodeComp = delta.componentsSet.find((c) => c.component === 'corruptedNode');
      expect(nodeComp).toBeDefined();
      const nodeData = nodeComp!.data as Record<string, unknown>;
      expect(nodeData.trapType).toBeUndefined();

      const aiComp = delta.componentsSet.find((c) => c.component === 'aiState');
      expect(aiComp).toBeDefined();
      const aiData = aiComp!.data as Record<string, unknown>;
      expect(aiData.cooldowns).toBeUndefined();
      expect(aiData.remainingMemoryTurns).toBeUndefined();
      expect(aiData.inlineTree).toBeUndefined();
    });

    it('redactDeltaForClient strips lastEvaluatedPath for non-visible entities', () => {
      const delta = {
        componentsSet: [
          {
            component: 'aiState',
            entityId: 10,
            data: {
              behavior: AIBehavior.CHASING,
              lastEvaluatedPath: 'root > visible-action',
            },
          },
          {
            component: 'aiState',
            entityId: 20,
            data: {
              behavior: AIBehavior.IDLE,
              lastEvaluatedPath: 'root > hidden-action',
            },
          },
        ],
        componentsRemoved: [],
        entitiesAdded: [],
        entitiesRemoved: [],
      };

      const redacted = redactDeltaForClient(delta as any, { visibleEntityIds: [10] });

      const e10 = redacted.componentsSet.find((c) => c.entityId === 10);
      expect((e10?.data as any).lastEvaluatedPath).toBe('root > visible-action');

      const e20 = redacted.componentsSet.find((c) => c.entityId === 20);
      expect((e20?.data as any).lastEvaluatedPath).toBeUndefined();
    });
  });

  describe('Grid Serialization', () => {
    it('should perform a lossless round-trip for grid state', () => {
      grid.setTile(1, 1, { terrain: 'wall', walkable: false, transparent: false });
      grid.addEntity(100, 1, 1);
      grid.addItem(200, 1, 1);

      const serialized = serializeGrid(grid);
      const newGrid = deserializeGrid(serialized);

      expect(newGrid.width).toBe(10);
      expect(newGrid.height).toBe(10);
      expect(newGrid.getTile(1, 1)?.terrain).toBe('wall');
      expect(newGrid.getTile(1, 1)?.walkable).toBe(false);
      expect(Array.from(newGrid.getEntitiesAt(1, 1))).toContain(100);
      expect(Array.from(newGrid.getItemsAt(1, 1))).toContain(200);
      expect(serializeGrid(newGrid)).toEqual(serialized);
    });
  });
});
