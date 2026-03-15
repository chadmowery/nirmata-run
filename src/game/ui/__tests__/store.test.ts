import { describe, it, expect, beforeEach } from 'vitest';
import { gameStore } from '../store';
import { GameState } from '../../states/types';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    gameStore.setState({
      player: { hp: 0, maxHp: 0, xp: 0, level: 1, statuses: [] },
      messages: [],
      gameStatus: GameState.Loading,
      visibleEntities: [],
    });
  });

  it('should update player stats', () => {
    gameStore.getState().updatePlayerStats({ hp: 10, maxHp: 20, xp: 50, level: 2 });
    const state = gameStore.getState();
    expect(state.player.hp).toBe(10);
    expect(state.player.maxHp).toBe(20);
    expect(state.player.xp).toBe(50);
    expect(state.player.level).toBe(2);
  });

  it('should add messages', () => {
    gameStore.getState().addMessage('Hello world', 'info');
    const state = gameStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].text).toBe('Hello world');
    expect(state.messages[0].count).toBe(1);
  });

  it('should collapse identical consecutive messages', () => {
    gameStore.getState().addMessage('Ouch', 'combat');
    gameStore.getState().addMessage('Ouch', 'combat');
    gameStore.getState().addMessage('Ouch', 'combat');
    
    const state = gameStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].text).toBe('Ouch');
    expect(state.messages[0].count).toBe(3);
  });

  it('should not collapse different consecutive messages', () => {
    gameStore.getState().addMessage('Ouch', 'combat');
    gameStore.getState().addMessage('Critical!', 'combat');
    
    const state = gameStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].text).toBe('Critical!');
    expect(state.messages[1].text).toBe('Ouch');
  });

  it('should cap the message log at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      gameStore.getState().addMessage(`Message ${i}`, 'info');
    }
    
    const state = gameStore.getState();
    expect(state.messages).toHaveLength(50);
    expect(state.messages[0].text).toBe('Message 59');
  });

  it('should update game status', () => {
    gameStore.getState().setGameStatus(GameState.Playing);
    expect(gameStore.getState().gameStatus).toBe(GameState.Playing);
  });

  it('should update visible entities', () => {
    const enemies = [
      { id: 10, name: 'Orc', hp: 10, maxHp: 10 },
      { id: 11, name: 'Goblin', hp: 5, maxHp: 5 },
    ];
    gameStore.getState().setVisibleEntities(enemies);
    expect(gameStore.getState().visibleEntities).toEqual(enemies);
  });
});
