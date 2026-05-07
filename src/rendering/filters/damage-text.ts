import { Text, TextStyle, Container } from 'pixi.js';

interface DamageTextState {
  text: Text;
  life: number;
  maxLife: number;
}

let activeTexts: DamageTextState[] = [];

const TEXT_POOL = ['0xFF', 'NULL', 'ERR', 'SEGFAULT', 'NaN', 'VOID', '0x00', 'FATAL', 'STACK_OVF', 'DEADBEEF'];

/**
 * Spawns floating code fragments on enemy damage.
 */
export function spawnDamageText(x: number, y: number, effectsLayer: Container): void {
  const count = 1 + Math.floor(Math.random() * 2); // 1 or 2 fragments
  
  for (let i = 0; i < count; i++) {
    const fragment = TEXT_POOL[Math.floor(Math.random() * TEXT_POOL.length)];
    
    const style = new TextStyle({
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 10,
      fill: 0xFFFFFF,
      fontWeight: 'bold',
    });
    
    const text = new Text({ text: fragment, style });
    text.anchor.set(0.5);
    text.x = x + (Math.random() - 0.5) * 16;
    text.y = y - 8;
    text.alpha = 0.9;
    
    effectsLayer.addChild(text);
    
    activeTexts.push({
      text,
      life: 0,
      maxLife: 500,
    });
  }
}

/**
 * Updates all active damage text animations.
 */
export function updateDamageTexts(deltaMs: number): void {
  for (let i = activeTexts.length - 1; i >= 0; i--) {
    const state = activeTexts[i];
    state.life += deltaMs;
    
    if (state.life >= state.maxLife) {
      state.text.destroy();
      activeTexts.splice(i, 1);
      continue;
    }
    
    // Move upward and fade
    state.text.y -= 0.05 * deltaMs;
    state.text.alpha = 0.9 * (1 - state.life / state.maxLife);
  }
}

/**
 * Disposes all active damage texts.
 */
export function disposeDamageTexts(): void {
  activeTexts.forEach(state => state.text.destroy());
  activeTexts = [];
}
