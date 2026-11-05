import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { GameEvents } from '@/game/events/types';
import { Position } from '@shared/components/position';
import { Prop, SecurityLock, CorruptedNode } from '@shared/components/environment';
import { resolveTileInspection, resolvePropLore } from '@/rendering/tile-inspector';

describe('U12: Tactical Tooltip Hints and Dynamic Faction Lore', () => {
  let world: World<GameEvents>;
  let grid: Grid;
  let playerEntity: EntityId;

  beforeEach(() => {
    world = new World<GameEvents>(new EventBus<GameEvents>());
    grid = new Grid(20, 20);
    playerEntity = world.createEntity();
  });

  describe('Dynamic Faction Lore Resolution', () => {
    it('resolves faction-specific names and flavor text for workstations', () => {
      const traxusLore = resolvePropLore('workstation', 'traxus');
      expect(traxusLore.name).toBe('TRAXUS TERMINAL WORKSTATION');
      expect(traxusLore.flavorText).toContain('Traxus Heavy Industries');

      const cyberLore = resolvePropLore('workstation', 'cyberacme');
      expect(cyberLore.name).toBe('CYBERACME TERMINAL WORKSTATION');
      expect(cyberLore.flavorText).toContain('CyberAcme Systems');

      const sekiguchiLore = resolvePropLore('workstation', 'sekiguchi');
      expect(sekiguchiLore.name).toBe('SEKIGUCHI TERMINAL WORKSTATION');
      expect(sekiguchiLore.flavorText).toContain('Sekiguchi Genetics');
    });

    it('interpolates faction attribution for lockers, cabinets, and safes', () => {
      const locker = resolvePropLore('locker', 'nucaloric');
      expect(locker.flavorText).toContain('NuCaloric Energy Corp');

      const cabinet = resolvePropLore('cabinet', 'traxus');
      expect(cabinet.flavorText).toContain('Traxus Heavy Industries');

      const safe = resolvePropLore('encrypted_safe', 'cyberacme');
      expect(safe.flavorText).toContain('CyberAcme Systems');
    });

    it('adapts vault_door lore depending on whether Faraday shielding is active', () => {
      const standardDoor = resolvePropLore('vault_door', 'traxus', false);
      expect(standardDoor.name).toBe('TRAXUS SECURITY AIRLOCK');
      expect(standardDoor.subTitle).toBe('REINFORCED BLAST BULKHEAD');
      expect(standardDoor.flavorText).not.toContain('lead-lined Faraday');
      expect(standardDoor.flavorText).toContain('Traxus Heavy Industries');

      const faradayDoor = resolvePropLore('vault_door', 'traxus', true);
      expect(faradayDoor.name).toBe('TRAXUS REINFORCED AIRLOCK');
      expect(faradayDoor.subTitle).toBe('FARADAY PERIMETER BULKHEAD');
      expect(faradayDoor.flavorText).toContain('Dense lead-lined Faraday perimeter bulkhead');
    });
  });

  describe('Accurate Interaction Hints via resolveTileInspection', () => {
    it('provides accurate interaction hint for armed CorruptedNode warning that bump is blocked', () => {
      const propEntity = world.createEntity();
      world.addComponent(propEntity, Position, { x: 5, y: 5 });
      world.addComponent(propEntity, Prop, {
        propId: 'prop_corrupted_node_01',
        faction: 'traxus',
        propClass: 'workstation',
      });
      world.addComponent(propEntity, CorruptedNode, {
        isDisarmed: false,
        triggered: false,
        revealed: true,
        corruptionLevel: 2,
        trapType: 'thermal_dump',
      });

      const inspect = resolveTileInspection({
        world,
        grid,
        gx: 5,
        gy: 5,
        screenX: 100,
        screenY: 100,
        isVisibleInFov: true,
        isExplored: true,
        playerEntity,
        detailedFlavorTextEnabled: true,
      });

      expect(inspect).not.toBeNull();
      expect(inspect?.name).toBe('TRAXUS TERMINAL WORKSTATION');
      expect(inspect?.badge).toBe('CORRUPTED NODE [LVL 2]');
      expect(inspect?.interactionHint).toContain('Hazardous trap payload active');
      expect(inspect?.interactionHint).toContain('Bump blocked by trap safeguard');
      expect(inspect?.interactionHint).toContain('[E] to force bypass');
    });

    it('provides accurate interaction hint for locked props indicating keycard requirement or overclock', () => {
      const propEntity = world.createEntity();
      world.addComponent(propEntity, Position, { x: 6, y: 6 });
      world.addComponent(propEntity, Prop, {
        propId: 'prop_locked_safe_01',
        faction: 'cyberacme',
        propClass: 'encrypted_safe',
      });
      world.addComponent(propEntity, SecurityLock, {
        isLocked: true,
        keyIdRequired: 'access_key',
        overclockHeatCost: 35,
      });

      const inspect = resolveTileInspection({
        world,
        grid,
        gx: 6,
        gy: 6,
        screenX: 120,
        screenY: 120,
        isVisibleInFov: true,
        isExplored: true,
        playerEntity,
        detailedFlavorTextEnabled: true,
      });

      expect(inspect).not.toBeNull();
      expect(inspect?.name).toBe('SECURE HARDWARE VAULT');
      expect(inspect?.badge).toBe('ENCRYPTED / LOCKED');
      expect(inspect?.interactionHint).toContain('[BUMP] to attempt bypass with Keycard');
      expect(inspect?.interactionHint).toContain('[E] to overclock');
      expect(inspect?.interactionHint).toContain('Bump halts without key');
      expect(inspect?.flavorText).toContain('CyberAcme Systems');
    });
  });
});
