import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachNeonEmitter, cleanupEmitter, _getColorForBehavior } from '../particle-emitters';
import { AIBehaviorType } from '../../../shared/components/ai-state';

// Mock PixiJS
vi.mock('pixi.js', () => {
  class MockGraphics {
    beginFill = vi.fn().mockReturnThis();
    drawRect = vi.fn().mockReturnThis();
    endFill = vi.fn().mockReturnThis();
    destroy = vi.fn();
    x = 0;
    y = 0;
    alpha = 1;
  }
  class MockContainer {
    addChild = vi.fn();
    destroy = vi.fn();
    x = 0;
    y = 0;
    visible = true;
  }
  class MockSprite {
    x = 100;
    y = 100;
    visible = true;
    alpha = 1;
    destroyed = false;
  }
  return {
    Graphics: MockGraphics,
    Container: MockContainer,
    Sprite: MockSprite,
  };
});

describe('Particle Emitters', () => {
  it('maps behaviors to correct neon colors', () => {
    expect(_getColorForBehavior(AIBehaviorType.NULL_POINTER)).toBe(0x00F0FF);
    expect(_getColorForBehavior(AIBehaviorType.FRAGMENTER)).toBe(0xFF0055);
    expect(_getColorForBehavior(AIBehaviorType.SYSTEM_ADMIN)).toBe(0xFFFFFF);
  });

  it('attaches emitter to sprite', () => {
    const sprite: any = { x: 0, y: 0, visible: true, alpha: 1 };
    const layer: any = { addChild: vi.fn() };
    attachNeonEmitter(sprite, AIBehaviorType.BASIC, layer);
    expect(layer.addChild).toHaveBeenCalled();
  });

  it('cleans up emitter', () => {
    const sprite: any = { x: 0, y: 0, visible: true, alpha: 1 };
    const layer: any = { addChild: vi.fn() };
    attachNeonEmitter(sprite, AIBehaviorType.BASIC, layer);
    cleanupEmitter(sprite);
    // Should not throw and should clean up internal state
  });
});
