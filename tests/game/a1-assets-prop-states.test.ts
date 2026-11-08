import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { Position } from '@shared/components/position';
import { SpriteComponent } from '@shared/components/sprite';
import { Heat } from '@shared/components/heat';
import { Stability } from '@shared/components/stability';
import {
  Prop,
  SecurityLock,
  Container,
  InteractPropIntent,
} from '@shared/components/environment';
import { RunInventory, RunCurrency } from '@shared/components/run-inventory';
import { createPropInteractionSystem } from '@/game/systems/prop-interaction';
import itemAccessKeyTemplate from '@/game/entities/templates/item-access-key.json';

describe('A1: Asset and Sprite State Transitions', () => {
  const rootDir = process.cwd();

  it('A1.1: item-access-key.json uses item_access_key sprite key instead of item_flux', () => {
    const spriteKey =
      itemAccessKeyTemplate.components?.sprite?.key ||
      (itemAccessKeyTemplate as any).overrides?.sprite?.key;
    expect(spriteKey).toBe('item_access_key');
  });

  it('A1.2: prop interaction transitions sprite keys upon unlock and search', () => {
    const bus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(bus);
    const grid = new Grid(20, 20);
    const system = createPropInteractionSystem(world, grid, bus);
    system.init();

    const actor = world.createEntity();
    world.addComponent(actor, Position, { x: 5, y: 5 });
    world.addComponent(actor, Heat, {
      current: 0,
      maxSafe: 100,
      baseDissipation: 5,
      ventPercentage: 0.5,
      isVenting: false,
    });
    world.addComponent(actor, Stability, { current: 50, max: 100 });
    world.addComponent(actor, RunCurrency, {
      stacks: [{ currencyType: 'flux', amount: 50 }],
    });
    world.addComponent(actor, RunInventory, {
      software: [],
      equipment: [
        {
          entityId: 999,
          templateId: 'item-access-key',
          rarityTier: 'rare',
          pickedUpAtFloor: 1,
          pickedUpAtTimestamp: Date.now(),
        },
      ],
      maxSlots: 10,
    });

    // 1. Vault Door Key Unlock
    const vaultDoor = world.createEntity();
    world.addComponent(vaultDoor, Position, { x: 5, y: 6 });
    world.addComponent(vaultDoor, Prop, {
      propId: 'vault_door_1',
      propClass: 'vault_door',
      faction: 'traxus',
      isSearched: false,
    });
    world.addComponent(vaultDoor, SecurityLock, { isLocked: true, keyIdRequired: 'access_key' });
    world.addComponent(vaultDoor, SpriteComponent, { key: 'prop_vault_door_locked' });

    world.addComponent(actor, InteractPropIntent, {
      targetPropId: vaultDoor,
      forceOverride: false,
    });

    system.update(world);

    const vaultSprite = world.getComponent(vaultDoor, SpriteComponent);
    expect(vaultSprite?.key).toBe('prop_vault_door');
    const lock = world.getComponent(vaultDoor, SecurityLock);
    expect(lock?.isLocked).toBe(false);

    // 2. Reality Stabilizer Engagement
    const stabilizer = world.createEntity();
    world.addComponent(stabilizer, Position, { x: 5, y: 4 });
    world.addComponent(stabilizer, Prop, {
      propId: 'stabilizer_1',
      propClass: 'reality_stabilizer',
      faction: 'system',
      isSearched: false,
    });
    world.addComponent(stabilizer, SpriteComponent, { key: 'prop_stabilizer_active' });

    world.addComponent(actor, InteractPropIntent, {
      targetPropId: stabilizer,
      forceOverride: false,
    });

    system.update(world);

    const stabSprite = world.getComponent(stabilizer, SpriteComponent);
    expect(stabSprite?.key).toBe('prop_stabilizer');
    const stabProp = world.getComponent(stabilizer, Prop);
    expect(stabProp?.isSearched).toBe(true);

    // 3. Cooling Vent Engagement
    const vent = world.createEntity();
    world.addComponent(vent, Position, { x: 4, y: 5 });
    world.addComponent(vent, Prop, {
      propId: 'vent_1',
      propClass: 'cooling_vent',
      faction: 'traxus',
      isSearched: false,
    });
    world.addComponent(vent, SpriteComponent, { key: 'prop_cooling_vent_ready' });

    world.addComponent(actor, InteractPropIntent, {
      targetPropId: vent,
      forceOverride: false,
    });

    system.update(world);

    const ventSprite = world.getComponent(vent, SpriteComponent);
    expect(ventSprite?.key).toBe('prop_cooling_vent');

    // 4. Container (Locker, Biocabinet, Workstation) Search
    const locker = world.createEntity();
    world.addComponent(locker, Position, { x: 6, y: 5 });
    world.addComponent(locker, Prop, {
      propId: 'locker_1',
      propClass: 'locker',
      faction: 'traxus',
      isSearched: false,
    });
    world.addComponent(locker, Container, {
      containerId: 'locker_container',
      storedLoot: [],
      itemEntityIds: [],
    });
    world.addComponent(locker, SpriteComponent, { key: 'prop_locker_closed' });

    world.addComponent(actor, InteractPropIntent, {
      targetPropId: locker,
      forceOverride: false,
    });

    system.update(world);

    const lockerSprite = world.getComponent(locker, SpriteComponent);
    expect(lockerSprite?.key).toBe('prop_locker');

    const biocabinet = world.createEntity();
    world.addComponent(biocabinet, Position, { x: 5, y: 6 });
    world.addComponent(biocabinet, Prop, {
      propId: 'biocabinet_1',
      propClass: 'cabinet',
      faction: 'sekiguchi',
      isSearched: false,
    });
    world.addComponent(biocabinet, Container, {
      containerId: 'biocabinet_container',
      storedLoot: [],
      itemEntityIds: [],
    });
    world.addComponent(biocabinet, SpriteComponent, { key: 'prop_biocabinet_full' });

    world.addComponent(actor, InteractPropIntent, {
      targetPropId: biocabinet,
      forceOverride: false,
    });

    system.update(world);

    const bioSprite = world.getComponent(biocabinet, SpriteComponent);
    expect(bioSprite?.key).toBe('prop_biocabinet');

    system.dispose();
  });

  it('A1.3: public/assets/tiles/previews does not exist in production public directory', () => {
    const publicPreviewsPath = path.join(rootDir, 'public/assets/tiles/previews');
    expect(fs.existsSync(publicPreviewsPath)).toBe(false);

    // Confirm previews exist in docs/visual-design/previews
    const docsPreviewsPath = path.join(rootDir, 'docs/visual-design/previews');
    expect(fs.existsSync(docsPreviewsPath)).toBe(true);
    const files = fs.readdirSync(docsPreviewsPath).filter((f) => f.endsWith('.png'));
    expect(files.length).toBeGreaterThan(15);
  });

  it('A1.5: tileset.json contains prop_safe aliases and 32x32 frames', () => {
    const tilesetJsonPath = path.join(rootDir, 'public/assets/tileset.json');
    const raw = fs.readFileSync(tilesetJsonPath, 'utf-8');
    const json = JSON.parse(raw);

    expect(json.frames['prop_safe']).toBeDefined();
    expect(json.frames['prop_safe_open']).toBeDefined();
    expect(json.frames['item_access_key']).toBeDefined();
    expect(json.frames['prop_safe'].frame.w).toBe(32);
    expect(json.frames['prop_safe'].frame.h).toBe(32);
  });
});
