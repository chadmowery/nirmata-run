import { describe, it, expect } from 'vitest';
import vanguard from '../shared/templates/vanguard-v1.json';
import bastion from '../shared/templates/bastion-v1.json';
import ghost from '../shared/templates/ghost-v1.json';
import { createDefaultProfile } from '@shared/profile';
import { createEngineInstance } from '@/game/engine-factory';
import { FirmwareSlots, AbilityDef, RunInventory } from '@shared/components';

describe('Shell Starter Loadouts & Abilities', () => {
  it('all starter templates define correct starterLoadout lists', () => {
    expect(vanguard.starterLoadout).toEqual(['basic-strike', 'kinetic-link']);
    expect(bastion.starterLoadout).toEqual(['neural-spike']);
    expect(ghost.starterLoadout).toEqual(['ghost-pulse', 'logic-jam']);
  });

  it('createDefaultProfile pre-installs the specific starter abilities for each shell', () => {
    const profile = createDefaultProfile('starter-test-session');

    const vanguardItems = profile.installedItems.filter(
      (item) => item.shellId === 'vanguard-v1' && item.type === 'firmware',
    );
    expect(vanguardItems.map((i) => i.blueprintId)).toEqual(['basic-strike', 'kinetic-link']);

    const bastionItems = profile.installedItems.filter(
      (item) => item.shellId === 'bastion-v1' && item.type === 'firmware',
    );
    expect(bastionItems.map((i) => i.blueprintId)).toEqual(['neural-spike']);

    const ghostItems = profile.installedItems.filter(
      (item) => item.shellId === 'ghost-v1' && item.type === 'firmware',
    );
    expect(ghostItems.map((i) => i.blueprintId)).toEqual(['ghost-pulse', 'logic-jam']);

    // Check that all starter blueprints are unlocked in library
    const starterBlueprints = [
      'basic-strike',
      'kinetic-link',
      'neural-spike',
      'ghost-pulse',
      'logic-jam',
    ];
    const libraryIds = profile.blueprintLibrary.map((b) => b.blueprintId);
    for (const bp of starterBlueprints) {
      expect(libraryIds).toContain(bp);
    }
  });

  it('createEngineInstance equips starter abilities into FirmwareSlots from shellRecord starterLoadout', () => {
    const engine = createEngineInstance({
      width: 15,
      height: 15,
      seed: 'test-seed-1',
      shellRecord: {
        id: 'bastion-v1',
        archetypeId: 'bastion-v1',
        level: 1,
        currentStats: { speed: 80, stability: 120, armor: 3, maxHealth: 30 },
        portConfig: { maxFirmware: 1, maxAugment: 1, maxSoftware: 1 },
        starterLoadout: ['neural-spike'],
      },
    });

    const player = engine.playerId;
    const fwSlots = engine.world.getComponent(player, FirmwareSlots);
    expect(fwSlots).toBeDefined();
    expect(fwSlots?.equipped.length).toBe(1);

    const fwEntityId = fwSlots!.equipped[0];
    const ability = engine.world.getComponent(fwEntityId, AbilityDef);
    expect(ability).toBeDefined();
    expect(ability?.name).toBe('Neural_Spike.exe');
  });

  it('createEngineInstance equips starter abilities from profile installedItems', () => {
    const profile = createDefaultProfile('profile-engine-test');
    const engine = createEngineInstance({
      width: 15,
      height: 15,
      seed: 'test-seed-2',
      profile,
      shellRecord: {
        id: 'ghost-v1',
        archetypeId: 'ghost-v1',
        level: 1,
        currentStats: { speed: 110, stability: 80, armor: 0, maxHealth: 15 },
        portConfig: { maxFirmware: 2, maxAugment: 1, maxSoftware: 2 },
        starterLoadout: ['ghost-pulse', 'logic-jam'],
      },
    });

    const player = engine.playerId;
    const fwSlots = engine.world.getComponent(player, FirmwareSlots);
    expect(fwSlots).toBeDefined();
    expect(fwSlots?.equipped.length).toBe(2);

    const ability0 = engine.world.getComponent(fwSlots!.equipped[0], AbilityDef);
    const ability1 = engine.world.getComponent(fwSlots!.equipped[1], AbilityDef);
    expect(ability0?.name).toBe('GHOST_PULSE.exe');
    expect(ability1?.name).toBe('LOGIC_JAM.exe');
  });

  it('createEngineInstance successfully boots with player backpack items without schema validation errors', () => {
    const profile = createDefaultProfile('backpack-test-session');
    profile.installedItems.push(
      {
        entityId: 9901,
        blueprintId: 'bleed-v1',
        type: 'backpack',
        shellId: 'ghost-v1',
        isLegacy: false,
      },
      {
        entityId: 9902,
        blueprintId: 'health-potion',
        type: 'backpack',
        shellId: 'ghost-v1',
        isLegacy: false,
      },
    );

    const engine = createEngineInstance({
      width: 20,
      height: 20,
      seed: 'test-backpack-seed',
      profile,
      shellRecord: {
        id: 'ghost-v1',
        archetypeId: 'ghost-v1',
        level: 1,
        currentStats: { speed: 110, stability: 80, armor: 0, maxHealth: 15 },
        portConfig: { maxFirmware: 2, maxAugment: 1, maxSoftware: 2 },
        starterLoadout: ['ghost-pulse', 'logic-jam'],
      },
    });

    const player = engine.playerId;
    const inv = engine.world.getComponent(player, RunInventory);
    expect(inv).toBeDefined();
    expect(inv?.software.length).toBeGreaterThanOrEqual(1);
    const swItem = inv!.software[0];
    expect(swItem.templateId).toBe('bleed-v1');
    expect(swItem.pickedUpAtFloor).toBe(1);
    expect(swItem.pickedUpAtTimestamp).toBeGreaterThan(0);
  });
});
