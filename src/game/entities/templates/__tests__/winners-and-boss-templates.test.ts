import { describe, it, expect } from 'vitest';
import { EntityRegistry } from '@engine/entity/registry';
import { registerGameTemplates } from '../../index';
import { AbilityDef, AugmentData, SoftwareDef } from '@shared/components';

import seedEaterTemplate from '../seed-eater.json';
import phasedOverdriveTemplate from '../phased-overdrive.json';
import neuralRecursionTemplate from '../neural-recursion.json';
import staticCollapseTemplate from '../static-collapse.json';
import voidEchoTemplate from '../void-echo.json';
import economy from '../economy.json';

describe("Winner's Items & Boss Templates", () => {
  it('validates seed-eater.json lootTable as Tier 3 with Tier 3 drops (DESIGN-06)', () => {
    const lootTable = (seedEaterTemplate as any).components.lootTable;
    expect(lootTable.tier).toBe(3);

    const dropTemplates = lootTable.drops.map((d: { template: string }) => d.template);
    expect(dropTemplates).toEqual([
      'bleed-v3',
      'vampire-v3',
      'auto-loader-v3',
      'rifle-v3',
      'armor-v3',
    ]);
  });

  it('validates all winner items referenced in economy.json exist and parse (DESIGN-07)', () => {
    const winnersItems = economy.winnersItems;
    expect(winnersItems).toEqual([
      'PHASED_OVERDRIVE',
      'NEURAL_RECURSION',
      'STATIC_COLLAPSE',
      'VOID_ECHO',
    ]);

    // PHASED_OVERDRIVE is Firmware
    const phasedAbility = (phasedOverdriveTemplate as any).components.abilityDef;
    const parsedPhased = AbilityDef.schema.parse(phasedAbility);
    expect(parsedPhased.name).toBe('PHASED_OVERDRIVE.exe');
    expect(parsedPhased.effectType).toBe('dash_attack');
    expect(parsedPhased.damageAmount).toBe(20);

    // NEURAL_RECURSION is Augment
    const neuralAugment = (neuralRecursionTemplate as any).components.augmentData;
    const parsedNeural = AugmentData.schema.parse(neuralAugment);
    expect(parsedNeural.name).toBe('NEURAL_RECURSION.arc');
    expect(parsedNeural.trigger.type).toBe('ON_ACTIVATION');

    // STATIC_COLLAPSE is Augment
    const staticAugment = (staticCollapseTemplate as any).components.augmentData;
    const parsedStatic = AugmentData.schema.parse(staticAugment);
    expect(parsedStatic.name).toBe('STATIC_COLLAPSE.arc');
    expect(parsedStatic.trigger.type).toBe('ON_KILL');

    // VOID_ECHO is Software
    const voidSoftware = (voidEchoTemplate as any).components.softwareDef;
    const parsedVoid = SoftwareDef.schema.parse(voidSoftware);
    expect(parsedVoid.name).toBe('Void_Echo.exe');
    expect(parsedVoid.effectType).toBe('dot');
    expect(parsedVoid.targetSlot).toBe('weapon');
  });

  it('registers all winner items in global EntityRegistry', () => {
    const registry = new EntityRegistry();
    registerGameTemplates(registry);

    for (const itemId of economy.winnersItems) {
      expect(registry.has(itemId)).toBe(true);
      const template = registry.get(itemId);
      expect(template).toBeDefined();
      expect(template?.name).toBe(itemId);
    }
  });
});
