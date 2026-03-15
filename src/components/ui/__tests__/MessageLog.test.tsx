import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageLog } from '../MessageLog';
import { gameStore } from '@/game/ui/store';
import React from 'react';

describe('MessageLog', () => {
  it('renders messages from store', () => {
    gameStore.setState({
      messages: [
        { id: '1', text: 'You hit the orc', count: 1, type: 'combat' },
        { id: '2', text: 'Health is low!', count: 2, type: 'error' },
      ],
    });

    render(<MessageLog />);

    expect(screen.getByText('You hit the orc')).toBeDefined();
    expect(screen.getByText('Health is low!')).toBeDefined();
    expect(screen.getByText('(x2)')).toBeDefined();
  });
});
