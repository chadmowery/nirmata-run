import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  Heat,
  Stability,
  FloorState,
  Prop,
  Container,
  CorruptedNode,
  InteractPropIntent,
} from '@shared/components';
import { createHeatSystem } from '../../src/game/systems/heat';
import { createStabilitySystem, DEFAULT_STABILITY_CONFIG } from '../../src/game/systems/stability';
import { createPropInteractionSystem } from '../../src/game/systems/prop-interaction';
import { rollSectorCondition } from '../../src/game/generation/dungeon-generator';

describe('M5: Sector Conditions Systemic Effects', () => {
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
    world.addComponent(playerId, Heat, {
      current: 50,
      maxSafe: 100,
      baseDissipation: 10,
      ventPercentage: 0.5,
      isVenting: false,
    });
    world.addComponent(playerId, Stability, {
      current: 100,
      max: 100,
    });
    world.addComponent(playerId, FloorState, {
      currentFloor: 6,
      maxFloor: 15,
      runSeed: 'seed-m5',
      sectorCondition: 'NOMINAL',
    });
  });

  describe('THERMAL_SURGE', () => {
    it('halves passive heat dissipation in HeatSystem', () => {
      world.patchComponent(playerId, FloorState, { sectorCondition: 'THERMAL_SURGE' });
      const heatSystem = createHeatSystem(world, eventBus);
      heatSystem.init();

      // Base dissipation is 10. During THERMAL_SURGE, dissipation is 10 * 0.5 = 5.
      // Heat should drop from 50 to 45 instead of 40.
      heatSystem.dissipate(playerId);

      const heat = world.getComponent(playerId, Heat)!;
      expect(heat.current).toBe(45);
    });

    it('makes encrypted workstation access cost 0 Heat (free) during THERMAL_SURGE', () => {
      world.patchComponent(playerId, FloorState, { sectorCondition: 'THERMAL_SURGE' });
      const propId = world.createEntity();
      world.addComponent(propId, Prop, {
        propId: 'workstation_1',
        faction: 'cyberacme',
        propClass: 'workstation',
        isSearched: false,
        heatCostOnAccess: 10,
      });
      world.addComponent(propId, Position, { x: 5, y: 6 });
      world.addComponent(propId, Container, {
        containerId: 'workstation_container',
        storedLoot: [],
        itemEntityIds: [],
      });

      const propSystem = createPropInteractionSystem(world, grid, eventBus);
      propSystem.init();

      world.addComponent(playerId, InteractPropIntent, { targetPropId: propId });
      propSystem.update(world);

      const heat = world.getComponent(playerId, Heat)!;
      expect(heat.current).toBe(50); // 0 heat cost
    });
  });

  describe('OVERCLOCKED_GRID', () => {
    it('amplifies per-turn stability bleed by 1.25x in StabilitySystem', () => {
      world.patchComponent(playerId, FloorState, { sectorCondition: 'OVERCLOCKED_GRID' });
      const stabilitySystem = createStabilitySystem(world, eventBus, {
        ...DEFAULT_STABILITY_CONFIG,
        perTurnBleedBase: 4,
        perTurnBleedScale: 0,
      });
      stabilitySystem.init();

      // Normal bleed: 4. With 1.25x OVERCLOCKED_GRID multiplier: 4 * 1.25 = 5.
      // Stability should drop from 100 to 95.
      stabilitySystem.applyTurnBleed(playerId, 1);

      const stab = world.getComponent(playerId, Stability)!;
      expect(stab.current).toBe(95);
    });
  });

  describe('DARK_SUBNET', () => {
    it('halves acoustic alert radius to 6 when triggered', () => {
      world.patchComponent(playerId, FloorState, { sectorCondition: 'DARK_SUBNET' });

      // Add a distant enemy at distance 8 (would be alerted by radius 12, but ignored by radius 6)
      const enemyId = world.createEntity();
      world.addComponent(enemyId, Actor, { isPlayer: false });
      world.addComponent(enemyId, Position, { x: 5, y: 13 }); // distance = 8

      const propId = world.createEntity();
      world.addComponent(propId, Prop, {
        propId: 'trapped_node',
        faction: 'cyberacme',
        propClass: 'workstation',
        isSearched: false,
      });
      world.addComponent(propId, Position, { x: 5, y: 6 });
      world.addComponent(propId, CorruptedNode, {
        trapType: 'acoustic_alert',
        isDisarmed: false,
        triggered: false,
        revealed: false,
      });

      const propSystem = createPropInteractionSystem(world, grid, eventBus);
      propSystem.init();

      world.addComponent(playerId, InteractPropIntent, { targetPropId: propId });
      propSystem.update(world);

      // Enemy at distance 8 should NOT receive AlertIntent under DARK_SUBNET (radius 6)
      const alertIntent = world.getComponent(enemyId, 'alertIntent' as any);
      expect(alertIntent).toBeUndefined();
    });
  });

  describe('rollSectorCondition distribution', () => {
    it('returns NOMINAL below floor 6', () => {
      expect(rollSectorCondition(1, { random: () => 0.1 })).toBe('NOMINAL');
      expect(rollSectorCondition(5, { random: () => 0.1 })).toBe('NOMINAL');
    });

    it('guarantees active conditions on floor 6 matching thresholds', () => {
      expect(rollSectorCondition(6, { random: () => 0.2 })).toBe('THERMAL_SURGE');
      expect(rollSectorCondition(6, { random: () => 0.5 })).toBe('DARK_SUBNET');
      expect(rollSectorCondition(6, { random: () => 0.8 })).toBe('OVERCLOCKED_GRID');
    });
  });
});
