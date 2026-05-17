import React from 'react';
import { describe, it } from 'vitest';
import { BackpackGrid } from './BackpackGrid';

describe('BackpackGrid', () => {
  it('renders', () => {
    (window as any).gameContext = {
      playerId: 1,
      world: {
        getComponent: () => ({ software: [], equipment: [], maxSlots: 15 }),
      },
    };
  });
});
