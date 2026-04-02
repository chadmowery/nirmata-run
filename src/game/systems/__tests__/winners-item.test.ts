import { describe, it, expect } from 'vitest';
import { getWinnersItem } from '../weekly-reset';
import economyConfig from '../../entities/templates/economy.json';

describe('Winners Item System', () => {
  it('cycles through winnersItems array', () => {
    const items = economyConfig.winnersItems;
    expect(getWinnersItem(0)).toBe(items[0]);
    expect(getWinnersItem(1)).toBe(items[1]);
    expect(getWinnersItem(items.length)).toBe(items[0]);
    expect(getWinnersItem(items.length + 1)).toBe(items[1]);
  });
});
