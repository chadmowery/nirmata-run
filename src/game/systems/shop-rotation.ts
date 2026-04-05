import economyRaw from '../entities/templates/economy.json';
import { EconomyConfig } from '@shared/economy-types';

const economyConfig = economyRaw as unknown as EconomyConfig;

export interface ShopItem {
  templateId: string;
  name: string;
  rarity: string;
  price: number;
}

// Available Software templates for shop (up to v2.x per D-30)
const SHOP_SOFTWARE_POOL = [
  { templateId: 'bleed-v0', name: 'Bleed.exe v0', rarity: 'common', basePrice: 30 },
  { templateId: 'bleed-v1', name: 'Bleed.exe v1', rarity: 'uncommon', basePrice: 60 },
  { templateId: 'bleed-v2', name: 'Bleed.exe v2', rarity: 'rare', basePrice: 120 },
  { templateId: 'auto-loader-v0', name: 'Auto-Loader.msi v0', rarity: 'common', basePrice: 30 },
  { templateId: 'auto-loader-v1', name: 'Auto-Loader.msi v1', rarity: 'uncommon', basePrice: 60 },
  { templateId: 'auto-loader-v2', name: 'Auto-Loader.msi v2', rarity: 'rare', basePrice: 120 },
  { templateId: 'vampire-v0', name: 'Vampire.exe v0', rarity: 'common', basePrice: 30 },
  { templateId: 'vampire-v1', name: 'Vampire.exe v1', rarity: 'uncommon', basePrice: 60 },
  { templateId: 'vampire-v2', name: 'Vampire.exe v2', rarity: 'rare', basePrice: 120 },
];

/** Simple seeded PRNG (mulberry32) */
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generateShopStock(weekSeed: number): ShopItem[] {
  const rng = seededRandom(weekSeed);
  const stockSize = economyConfig.shop.stockSize;
  const pool = [...SHOP_SOFTWARE_POOL];
  const stock: ShopItem[] = [];

  for (let i = 0; i < stockSize && pool.length > 0; i++) {
    const index = Math.floor(rng() * pool.length);
    const item = pool.splice(index, 1)[0];
    stock.push({
      templateId: item.templateId,
      name: item.name,
      rarity: item.rarity,
      price: item.basePrice,
    });
  }

  return stock;
}
