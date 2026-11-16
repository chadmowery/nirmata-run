import { describe, it, expect } from 'vitest';
import { Phase } from '@engine/ecs/types';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  Shell,
  SpriteComponent,
  MoveIntent,
  AttackIntent,
  InteractPropIntent,
  FirmwareIntent,
  Health,
  Energy,
} from '@shared/components';
import { createEngineInstance } from '@/game/engine-factory';
import { createClientEngine } from '@client/game/client-engine-factory';
import { GameAction } from '@/game/input/actions';
import { createShellDirectionSystem } from '../shell-direction';
import { createMovementSystem } from '../movement';
import { createECSWorldDelta } from '@shared/ecs-delta';
import { serializeWorld, serializeGrid } from '@shared/serialization';
import { applyStateDelta } from '@shared/reconciliation';
import { TurnPhase } from '@engine/turn/types';
import { diff } from 'json-diff-ts';
import bastionTemplate from '@/game/shells/shared/templates/bastion-v1.json';
import vanguardTemplate from '@/game/shells/shared/templates/vanguard-v1.json';
import ghostTemplate from '@/game/shells/shared/templates/ghost-v1.json';

describe('Directional Bastion Shell Sprites', () => {
  it('loads bastion-v1-south when the player picks the bastion shell', () => {
    const engine = createEngineInstance({
      width: 15,
      height: 15,
      seed: 'bastion-load-test',
      shellRecord: {
        id: 'bastion-v1',
        archetypeId: 'bastion-v1',
        level: 1,
        currentStats: { ...bastionTemplate.baseStats },
        portConfig: { ...bastionTemplate.basePorts },
        starterLoadout: bastionTemplate.starterLoadout,
        sprite: bastionTemplate.sprite,
      },
    });

    const playerSprite = engine.world.getComponent(engine.playerId, SpriteComponent);
    expect(playerSprite?.key).toBe('bastion-v1-south');
  });

  it('keeps vanguard and ghost shells on their non-directional base sprites', () => {
    const vanguardEngine = createEngineInstance({
      width: 15,
      height: 15,
      seed: 'vanguard-load-test',
      shellRecord: {
        id: 'vanguard-v1',
        archetypeId: 'vanguard-v1',
        level: 1,
        currentStats: { ...vanguardTemplate.baseStats },
        portConfig: { ...vanguardTemplate.basePorts },
        sprite: vanguardTemplate.sprite,
      },
    });
    expect(vanguardEngine.world.getComponent(vanguardEngine.playerId, SpriteComponent)?.key).toBe(
      'player_vanguard',
    );

    const ghostEngine = createEngineInstance({
      width: 15,
      height: 15,
      seed: 'ghost-load-test',
      shellRecord: {
        id: 'ghost-v1',
        archetypeId: 'ghost-v1',
        level: 1,
        currentStats: { ...ghostTemplate.baseStats },
        portConfig: { ...ghostTemplate.basePorts },
        sprite: ghostTemplate.sprite,
      },
    });
    expect(ghostEngine.world.getComponent(ghostEngine.playerId, SpriteComponent)?.key).toBe(
      'player_ghost',
    );
  });

  it('swaps bastion sprite to match each cardinal direction selected, even when bumping a wall', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(5, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const isWall = x === 0 || y === 0 || x === 4 || y === 4;
        grid.setTile(x, y, {
          terrain: isWall ? 'wall' : 'floor',
          walkable: !isWall,
          transparent: !isWall,
        });
      }
    }

    const shellDirection = createShellDirectionSystem(world);
    const movement = createMovementSystem(world, grid, eventBus, false);
    shellDirection.init();
    movement.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 2, y: 2 });
    world.addComponent(playerId, Shell, {
      archetypeId: 'bastion-v1',
      speed: 80,
      stability: 10,
      armor: 3,
      maxHealth: 25,
    });
    world.addComponent(playerId, SpriteComponent, { key: 'bastion-v1-south' });
    grid.addEntity(playerId, 2, 2);

    // Move North -> bastion-v1-north
    world.addComponent(playerId, MoveIntent, { dx: 0, dy: -1 });
    world.executeSystems(Phase.ACTION);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-north');
    expect(world.getComponent(playerId, Position)).toEqual({ x: 2, y: 1 });

    // Move West -> bastion-v1-west
    world.addComponent(playerId, MoveIntent, { dx: -1, dy: 0 });
    world.executeSystems(Phase.ACTION);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-west');
    expect(world.getComponent(playerId, Position)).toEqual({ x: 1, y: 1 });

    // Bump West into wall at x=0 -> stays at (1, 1), still faces west
    world.addComponent(playerId, MoveIntent, { dx: -1, dy: 0 });
    world.executeSystems(Phase.ACTION);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-west');
    expect(world.getComponent(playerId, Position)).toEqual({ x: 1, y: 1 });

    // Bump North into wall at y=0 -> stays at (1, 1), swaps to north
    world.addComponent(playerId, MoveIntent, { dx: 0, dy: -1 });
    world.executeSystems(Phase.ACTION);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-north');
    expect(world.getComponent(playerId, Position)).toEqual({ x: 1, y: 1 });

    // Move East -> bastion-v1-east
    world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
    world.executeSystems(Phase.ACTION);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-east');
    expect(world.getComponent(playerId, Position)).toEqual({ x: 2, y: 1 });

    // Move South -> bastion-v1-south
    world.addComponent(playerId, MoveIntent, { dx: 0, dy: 1 });
    world.executeSystems(Phase.ACTION);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-south');
    expect(world.getComponent(playerId, Position)).toEqual({ x: 2, y: 2 });
  });

  it('swaps bastion sprite for AttackIntent, InteractPropIntent, and FirmwareIntent targets', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const shellDirection = createShellDirectionSystem(world);

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Shell, {
      archetypeId: 'bastion-v1',
      speed: 80,
      stability: 10,
      armor: 3,
      maxHealth: 25,
    });
    world.addComponent(playerId, SpriteComponent, { key: 'bastion-v1-south' });

    const enemyId = world.createEntity();
    world.addComponent(enemyId, Position, { x: 6, y: 5 }); // East of player

    world.addComponent(playerId, AttackIntent, { targetId: enemyId });
    shellDirection.update(world);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-east');
    world.removeComponent(playerId, AttackIntent);

    const propId = world.createEntity();
    world.addComponent(propId, Position, { x: 5, y: 4 }); // North of player
    world.addComponent(playerId, InteractPropIntent, { targetPropId: propId, forceOverride: false });
    shellDirection.update(world);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-north');
    world.removeComponent(playerId, InteractPropIntent);

    world.addComponent(playerId, FirmwareIntent, {
      actorId: playerId,
      slotIndex: 0,
      targetX: 2,
      targetY: 5, // West of player
    });
    shellDirection.update(world);
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-west');
  });

  it('predicts directional sprite swap on client and reconciles server delta cleanly', () => {
    const serverEngine = createEngineInstance({
      width: 25,
      height: 25,
      seed: 'bastion-sync-test',
      shellRecord: {
        id: 'bastion-v1',
        archetypeId: 'bastion-v1',
        level: 1,
        currentStats: { ...bastionTemplate.baseStats },
        portConfig: { ...bastionTemplate.basePorts },
        starterLoadout: bastionTemplate.starterLoadout,
        sprite: bastionTemplate.sprite,
      },
    });
    serverEngine.turnManager.start();

    // Ensure open floor tiles around player for clean movement
    const pPos = serverEngine.world.getComponent(serverEngine.playerId, Position)!;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = pPos.x + dx;
        const ty = pPos.y + dy;
        if (serverEngine.grid.inBounds(tx, ty)) {
          serverEngine.grid.setTile(tx, ty, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
    }

    const clientEngine = createClientEngine({
      width: 25,
      height: 25,
      playerId: serverEngine.playerId,
    });
    applyStateDelta(clientEngine.world, clientEngine.grid, clientEngine.turnManager, clientEngine.eventBus, {
      type: 'FULL',
      world: serializeWorld(serverEngine.world, { redactForClient: true }),
      grid: serializeGrid(serverEngine.grid),
      playerId: serverEngine.playerId,
      turnNumber: serverEngine.turnManager.getTurnNumber(),
      phase: TurnPhase.AWAIT_INPUT,
      events: [],
    });

    expect(
      clientEngine.world.getComponent(serverEngine.playerId, SpriteComponent)?.key,
    ).toBe('bastion-v1-south');

    // Client predicts MOVE_EAST
    clientEngine.turnManager.submitAction(GameAction.MOVE_EAST);
    expect(
      clientEngine.world.getComponent(serverEngine.playerId, SpriteComponent)?.key,
    ).toBe('bastion-v1-east');

    // Server executes MOVE_EAST and sends delta
    const oldWorld = serializeWorld(serverEngine.world);
    const oldGrid = serializeGrid(serverEngine.grid);
    serverEngine.turnManager.submitAction(GameAction.MOVE_EAST);
    const newWorld = serializeWorld(serverEngine.world);
    const newGrid = serializeGrid(serverEngine.grid);

    const worldDelta = createECSWorldDelta(oldWorld, newWorld, { redactForClient: true });
    const gridDelta = diff(oldGrid, newGrid);

    applyStateDelta(clientEngine.world, clientEngine.grid, clientEngine.turnManager, clientEngine.eventBus, {
      type: 'DELTA',
      worldDelta,
      grid: gridDelta,
      playerId: serverEngine.playerId,
      turnNumber: serverEngine.turnManager.getTurnNumber(),
      events: [],
    });

    expect(
      clientEngine.world.getComponent(serverEngine.playerId, SpriteComponent)?.key,
    ).toBe('bastion-v1-east');

    // Non-bastion entity does not swap
    const npcId = serverEngine.world.createEntity();
    serverEngine.world.addComponent(npcId, Actor, { isPlayer: false });
    serverEngine.world.addComponent(npcId, Health, { current: 10, max: 10, isAlive: true });
    serverEngine.world.addComponent(npcId, Energy, { current: 1000, speed: 100, threshold: 1000 });
    serverEngine.world.addComponent(npcId, Position, { x: 2, y: 2 });
    serverEngine.world.addComponent(npcId, SpriteComponent, { key: 'enemy_null_pointer' });
    serverEngine.world.addComponent(npcId, MoveIntent, { dx: 1, dy: 0 });
    serverEngine.systems.shellDirection?.update(serverEngine.world);
    expect(serverEngine.world.getComponent(npcId, SpriteComponent)?.key).toBe(
      'enemy_null_pointer',
    );
  });

  it('uses configurable directionalSprites and defaultDirection from ShellRecord at spawn and during movement', () => {
    const customEngine = createEngineInstance({
      width: 25,
      height: 25,
      seed: 'custom-dir-shell',
      shellRecord: {
        id: 'vanguard-custom',
        archetypeId: 'vanguard-v1',
        level: 1,
        currentStats: { speed: 120, stability: 5, armor: 2, maxHealth: 20 },
        portConfig: { maxFirmware: 2, maxAugment: 1, maxSoftware: 2 },
        sprite: 'player_vanguard',
        defaultDirection: 'east',
        directionalSprites: {
          north: 'custom_vg_n',
          east: 'custom_vg_e',
          south: 'custom_vg_s',
          west: 'custom_vg_w',
        },
      },
    });

    const initialSprite = customEngine.world.getComponent(customEngine.playerId, SpriteComponent);
    expect(initialSprite?.key).toBe('custom_vg_e');

    customEngine.world.addComponent(customEngine.playerId, MoveIntent, { dx: 0, dy: -1 });
    customEngine.systems.shellDirection?.update(customEngine.world);
    expect(customEngine.world.getComponent(customEngine.playerId, SpriteComponent)?.key).toBe(
      'custom_vg_n',
    );

    customEngine.world.addComponent(customEngine.playerId, MoveIntent, { dx: -1, dy: 0 });
    customEngine.systems.shellDirection?.update(customEngine.world);
    expect(customEngine.world.getComponent(customEngine.playerId, SpriteComponent)?.key).toBe(
      'custom_vg_w',
    );
  });
});
