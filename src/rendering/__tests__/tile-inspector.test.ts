import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../engine/ecs/world';
import { EventBus } from '../../engine/events/event-bus';
import { Grid } from '../../engine/grid/grid';
import { resolveTileInspection } from '../tile-inspector';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState } from '@shared/components/ai-state';
import { Health } from '@shared/components/health';
import { Prop, SecurityLock, Container } from '@shared/components/environment';
import { StaircaseMarker } from '@shared/components/staircase-marker';
import { AnchorMarker } from '@shared/components/anchor-marker';
import { Item } from '@shared/components/item';
import { gameStore } from '../../game/ui/store';

describe('resolveTileInspection', () => {
  let eventBus: EventBus<any>;
  let world: World<any>;
  let grid: Grid;
  let playerEntity: number;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new World(eventBus);
    grid = new Grid(20, 20);
    playerEntity = world.createEntity();
    gameStore.getState().resetRunStats();
  });

  it('returns null when tile coordinates are out of bounds', () => {
    const result = resolveTileInspection({
      world,
      grid,
      gx: -1,
      gy: 5,
      screenX: 100,
      screenY: 100,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: true,
    });
    expect(result).toBeNull();
  });

  it('returns null when tile is neither explored nor visible in FOV (fog of war)', () => {
    const result = resolveTileInspection({
      world,
      grid,
      gx: 5,
      gy: 5,
      screenX: 100,
      screenY: 100,
      isVisibleInFov: false,
      isExplored: false,
      playerEntity,
      detailedFlavorTextEnabled: true,
    });
    expect(result).toBeNull();
  });

  it('returns null for regular floor tiles when detailedFlavorTextEnabled is false', () => {
    const result = resolveTileInspection({
      world,
      grid,
      gx: 5,
      gy: 5,
      screenX: 100,
      screenY: 100,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });
    expect(result).toBeNull();
  });

  it('returns null for regular wall tiles when detailedFlavorTextEnabled is false', () => {
    grid.setTile(5, 5, { terrain: 'wall' });
    const result = resolveTileInspection({
      world,
      grid,
      gx: 5,
      gy: 5,
      screenX: 100,
      screenY: 100,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });
    expect(result).toBeNull();
  });

  it('returns detailed flavor text for wall tiles when detailedFlavorTextEnabled is true', () => {
    grid.setTile(5, 5, { terrain: 'wall' });
    const result = resolveTileInspection({
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

    expect(result).not.toBeNull();
    expect(result?.type).toBe('tile');
    expect(result?.name).toBe('REINFORCED PLASTEEL BULKHEAD');
    expect(result?.flavorText).toBeDefined();
    expect(result?.flavorText).toContain('Megacorp expansion');
  });

  it('returns detailed flavor text for floor tiles when detailedFlavorTextEnabled is true', () => {
    grid.setTile(5, 5, { terrain: 'floor' });
    const result = resolveTileInspection({
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

    expect(result).not.toBeNull();
    expect(result?.type).toBe('tile');
    expect(result?.name).toBe('SUB-DECK CONDUIT FLOORING');
    expect(result?.flavorText).toBeDefined();
  });

  it('inspects enemies when visible in FOV', () => {
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: 4, y: 4 });
    world.addComponent(enemy, Actor, { isPlayer: false });
    world.addComponent(enemy, AIState, {
      behavior: 'chase',
      sightRadius: 8,
      behaviorType: 'null_pointer',
    });
    world.addComponent(enemy, Health, { current: 5, max: 10, isAlive: true });

    const result = resolveTileInspection({
      world,
      grid,
      gx: 4,
      gy: 4,
      screenX: 200,
      screenY: 150,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('enemy');
    expect(result?.name).toBe('NULL-POINTER SPECTER');
    expect(result?.hp).toBe(5);
    expect(result?.maxHp).toBe(10);
    expect(result?.interactionHint).toContain('[BUMP] to execute melee attack');
  });

  it('does not reveal enemy when enemy tile is hidden in fog of war', () => {
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: 4, y: 4 });
    world.addComponent(enemy, Actor, { isPlayer: false });
    world.addComponent(enemy, Health, { current: 5, max: 10, isAlive: true });

    const result = resolveTileInspection({
      world,
      grid,
      gx: 4,
      gy: 4,
      screenX: 200,
      screenY: 150,
      isVisibleInFov: false,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });

    // Enemy should not be inspected through fog of war!
    expect(result).toBeNull();
  });

  it('inspects player chassis', () => {
    world.addComponent(playerEntity, Position, { x: 2, y: 2 });
    world.addComponent(playerEntity, Actor, { isPlayer: true });
    world.addComponent(playerEntity, Health, { current: 15, max: 20, isAlive: true });

    const result = resolveTileInspection({
      world,
      grid,
      gx: 2,
      gy: 2,
      screenX: 120,
      screenY: 120,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('player');
    expect(result?.name).toContain('CHASSIS');
    expect(result?.badge).toBe('ALLIED CHASSIS');
    expect(result?.interactionHint).toContain('[WASD]');
  });

  it('inspects interactive props like security lockers', () => {
    const prop = world.createEntity();
    world.addComponent(prop, Position, { x: 8, y: 8 });
    world.addComponent(prop, Prop, {
      propId: 'prop_locker_01',
      faction: 'traxus',
      propClass: 'locker',
      isSearched: false,
    });
    world.addComponent(prop, SecurityLock, {
      isLocked: true,
      keyIdRequired: 'traxus_key',
    });
    world.addComponent(prop, Container, {
      containerId: 'locker_container',
      capacity: 4,
    });

    const result = resolveTileInspection({
      world,
      grid,
      gx: 8,
      gy: 8,
      screenX: 300,
      screenY: 250,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('prop');
    expect(result?.name).toBe('REINFORCED CARGO LOCKER');
    expect(result?.badge).toBe('ENCRYPTED / LOCKED');
    expect(result?.interactionHint).toContain('[BUMP] to attempt bypass');
  });

  it('inspects staircase elevator conduits', () => {
    const stairs = world.createEntity();
    world.addComponent(stairs, Position, { x: 10, y: 10 });
    world.addComponent(stairs, StaircaseMarker, { targetFloor: 2 });

    const result = resolveTileInspection({
      world,
      grid,
      gx: 10,
      gy: 10,
      screenX: 400,
      screenY: 300,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('prop');
    expect(result?.name).toBe('SUB-LEVEL ELEVATOR SHAFT');
    expect(result?.subTitle).toContain('FLOOR 2');
    expect(result?.interactionHint).toContain('[SHIFT + .]');
  });

  it('inspects extraction stability anchors', () => {
    const anchor = world.createEntity();
    world.addComponent(anchor, Position, { x: 12, y: 12 });
    world.addComponent(anchor, AnchorMarker, { used: false });

    const result = resolveTileInspection({
      world,
      grid,
      gx: 12,
      gy: 12,
      screenX: 450,
      screenY: 350,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('prop');
    expect(result?.name).toBe('EXTRACTION STABILITY ANCHOR');
    expect(result?.badge).toBe('EXTRACTION READY');
    expect(result?.interactionHint).toContain('[E]');
  });

  it('inspects ground items and currencies', () => {
    const groundItem = world.createEntity();
    world.addComponent(groundItem, Position, { x: 6, y: 6 });
    world.addComponent(groundItem, Item, { name: 'Field Nanite Repair', description: 'Consumable nanite injector' });

    const result = resolveTileInspection({
      world,
      grid,
      gx: 6,
      gy: 6,
      screenX: 250,
      screenY: 200,
      isVisibleInFov: true,
      isExplored: true,
      playerEntity,
      detailedFlavorTextEnabled: false,
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe('item');
    expect(result?.name).toBe('Field Nanite Repair');
    expect(result?.interactionHint).toContain('[G] to pick up or transfer');
  });
});
