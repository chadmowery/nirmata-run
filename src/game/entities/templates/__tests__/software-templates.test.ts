import { describe, it, expect } from 'vitest';
import { SoftwareDef } from '@shared/components/software-def';
import { RarityTier, RARITY_SCALE_FACTORS } from '@shared/components/rarity-tier';
import { Item } from '@shared/components/item';
import fs from 'fs';
import path from 'path';

const TEMPLATE_DIR = path.resolve(__dirname, '..');
const SOFTWARE_TYPES = ['bleed', 'auto-loader', 'vampire'];
const RARITY_TIERS = ['v0', 'v1', 'v2', 'v3'];
const TIER_MAP: Record<string, string> = { v0: 'v0.x', v1: 'v1.x', v2: 'v2.x', v3: 'v3.x' };

function loadTemplate(name: string) {
  const filePath = path.join(TEMPLATE_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('Software Templates', () => {
  for (const type of SOFTWARE_TYPES) {
    for (const rarity of RARITY_TIERS) {
      const templateName = `${type}-${rarity}`;
      describe(templateName, () => {
        it('softwareDef validates against schema', () => {
          const template = loadTemplate(templateName);
          const data = template.components.softwareDef;
          const parsed = SoftwareDef.schema.parse(data);
          expect(parsed.type).toBe(type);
        });

        it('rarityTier validates against schema', () => {
          const template = loadTemplate(templateName);
          const data = template.components.rarityTier;
          const parsed = RarityTier.schema.parse(data);
          expect(parsed.tier).toBe(TIER_MAP[rarity]);
        });

        it(`has correct scaleFactor for ${rarity}`, () => {
          const template = loadTemplate(templateName);
          const data = template.components.rarityTier;
          const expectedFactor = RARITY_SCALE_FACTORS[TIER_MAP[rarity] as keyof typeof RARITY_SCALE_FACTORS];
          expect(data.scaleFactor).toBe(expectedFactor);
        });

        it('has purchaseCost >= 0', () => {
          const template = loadTemplate(templateName);
          const data = template.components.softwareDef;
          expect(data.purchaseCost).toBeGreaterThanOrEqual(0);
        });

        it('item component validates against schema', () => {
          const template = loadTemplate(templateName);
          const data = template.components.item;
          Item.schema.parse(data);
        });
      });
    }
  }

  describe('rarity scaling rules', () => {
    it('v0.x scale=1.0, v1.x=1.5, v2.x=2.0, v3.x=3.0', () => {
        expect(RARITY_SCALE_FACTORS['v0.x']).toBe(1.0);
        expect(RARITY_SCALE_FACTORS['v1.x']).toBe(1.5);
        expect(RARITY_SCALE_FACTORS['v2.x']).toBe(2.0);
        expect(RARITY_SCALE_FACTORS['v3.x']).toBe(3.0);
    });

    it('v3.x templates have minFloor >= 10', () => {
      for (const type of SOFTWARE_TYPES) {
        const template = loadTemplate(`${type}-v3`);
        expect(template.components.rarityTier.minFloor).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe('slot restrictions', () => {
    it('Bleed and Auto-Loader target weapon slot', () => {
      const bleed = loadTemplate('bleed-v0');
      expect(bleed.components.softwareDef.targetSlot).toBe('weapon');
      
      const autoloader = loadTemplate('auto-loader-v0');
      expect(autoloader.components.softwareDef.targetSlot).toBe('weapon');
    });

    it('Vampire targets armor slot', () => {
      const vampire = loadTemplate('vampire-v0');
      expect(vampire.components.softwareDef.targetSlot).toBe('armor');
    });
  });

  describe('loot table compatibility', () => {
    it('template names match expected format for LootTable.drops[].template', () => {
      for (const type of SOFTWARE_TYPES) {
        for (const rarity of RARITY_TIERS) {
          const template = loadTemplate(`${type}-${rarity}`);
          // The template "name" field is used by EntityRegistry
          // The file name (without .json) is used by LootTable.drops[].template
          expect(template.name).toBe(`${type.replace('-', '_')}_${rarity}`);
        }
      }
    });
  });
});
