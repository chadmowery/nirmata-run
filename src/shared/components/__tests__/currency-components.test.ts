import { describe, it, expect } from 'vitest';
import { Wallet } from '../wallet';
import { CurrencyItem } from '../currency-item';

describe('Currency Components', () => {
  describe('Wallet', () => {
    it('validates a valid wallet data', () => {
      const validData = {
        scrap: 100,
        flux: 50,
        scrapCap: 10000,
        fluxCap: 1000,
      };
      expect(Wallet.schema.parse(validData)).toEqual(validData);
    });

    it('uses default values', () => {
      const data = Wallet.schema.parse({});
      expect(data.scrap).toBe(0);
      expect(data.flux).toBe(0);
      expect(data.scrapCap).toBe(10000);
      expect(data.fluxCap).toBe(1000);
    });

    it('rejects negative balances', () => {
      expect(() => Wallet.schema.parse({ scrap: -1 })).toThrow();
      expect(() => Wallet.schema.parse({ flux: -1 })).toThrow();
    });
  });

  describe('CurrencyItem', () => {
    it('validates a valid scrap item', () => {
      const data = { currencyType: 'scrap', amount: 15 };
      expect(CurrencyItem.schema.parse(data)).toEqual(expect.objectContaining(data));
    });

    it('validates a valid blueprint item', () => {
      const data = {
        currencyType: 'blueprint',
        amount: 1,
        blueprintId: 'Phase_Shift.sh',
        blueprintType: 'firmware'
      };
      expect(CurrencyItem.schema.parse(data)).toEqual(expect.objectContaining(data));
    });

    it('rejects invalid currency types', () => {
      expect(() => CurrencyItem.schema.parse({ currencyType: 'invalid', amount: 1 })).toThrow();
    });

    it('rejects amount less than 1', () => {
      expect(() => CurrencyItem.schema.parse({ currencyType: 'scrap', amount: 0 })).toThrow();
    });
  });
});
