import { describe, it, expect } from 'vitest';
import { generateShopStock } from '../shop-rotation';

describe('Shop Rotation System', () => {
  it('generates stockSize (6) items', () => {
    const stock = generateShopStock(12345);
    expect(stock.length).toBe(6);
  });

  it('is deterministic for the same seed', () => {
    const stock1 = generateShopStock(55555);
    const stock2 = generateShopStock(55555);
    expect(stock1).toEqual(stock2);
  });

  it('is different for different seeds', () => {
    const stock1 = generateShopStock(11111);
    const stock2 = generateShopStock(22222);
    expect(stock1).not.toEqual(stock2);
  });

  it('does not contain legendary rarity (v3.x)', () => {
    const stock = generateShopStock(99999);
    for (const item of stock) {
      expect(item.rarity).not.toBe('legendary');
      expect(item.templateId).not.toContain('v3');
    }
  });
});
