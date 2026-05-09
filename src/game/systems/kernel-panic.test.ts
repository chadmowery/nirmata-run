import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Phase } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import { Heat, Shell, HeatData, ShellData } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { createKernelPanicSystem } from './kernel-panic';
import { createStatusEffectSystem } from './status-effects';

describe('KernelPanicSystem', () => {
  let world: World<GameplayEvents>;
  let eventBus: EventBus<GameplayEvents>;
  let statusEffectSystem: ReturnType<typeof createStatusEffectSystem>;
  let kernelPanicSystem: ReturnType<typeof createKernelPanicSystem>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    statusEffectSystem = createStatusEffectSystem(world, eventBus);
    kernelPanicSystem = createKernelPanicSystem(world, eventBus);
    
    statusEffectSystem.init();
    kernelPanicSystem.init();
    
    // Spy on eventBus.emit
    vi.spyOn(eventBus, 'emit');
  });

  const createHeatData = (overrides: Partial<HeatData> = {}) => ({
    current: 0,
    maxSafe: 100,
    baseDissipation: 5,
    ventPercentage: 0.5,
    isVenting: false,
    ...overrides,
  });

  const createShellData = (overrides: Partial<ShellData> = {}) => ({
    archetypeId: 'test-shell',
    speed: 100,
    stability: 10,
    armor: 1,
    maxHealth: 100,
    ...overrides,
  });

  it('checkOverclock returns null when Heat <= maxSafe', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 80, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 10 }));

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result).toBeNull();
  });

  it('checkOverclock selects tier 1 (HUD_GLITCH) for Heat 110% of maxSafe', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 110, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.tier).toBe(1);
    expect(result?.effectName).toBe('HUD_GLITCH');
    expect(result?.effectApplied).toBe(true);
    expect(eventBus.emit).toHaveBeenCalledWith('STATUS_EFFECT_APPLIED', expect.objectContaining({ entityId, effectName: 'HUD_GLITCH' }));
    
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('checkOverclock selects tier 2 (INPUT_LAG) for Heat 130% of maxSafe', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 130, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.tier).toBe(2);
    expect(result?.effectName).toBe('INPUT_LAG');
    
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('checkOverclock selects tier 3 (FIRMWARE_LOCK) for Heat 150% of maxSafe', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 150, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.tier).toBe(3);
    expect(result?.effectName).toBe('FIRMWARE_LOCK');
    
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('checkOverclock selects tier 4 (CRITICAL_REBOOT) for Heat 170% of maxSafe', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 170, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.tier).toBe(4);
    expect(result?.effectName).toBe('CRITICAL_REBOOT');
    
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('Stability reduces effective chance', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 110, maxSafe: 100 })); // Tier 1: 0.15 baseChance
    world.addComponent(entityId, Shell, createShellData({ stability: 10 })); // -0.10 chance -> 0.05 effective

    // Mock Math.random to 0.10 (above 0.05 effective chance)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.10);

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.effectApplied).toBe(false);

    // Mock Math.random to 0.04 (below 0.05 effective chance)
    randomSpy.mockReturnValue(0.04);
    const result2 = kernelPanicSystem.checkOverclock(entityId);
    expect(result2?.effectApplied).toBe(true);

    randomSpy.mockRestore();
  });

  it('High stability can reduce chance to 0', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 110, maxSafe: 100 })); // Tier 1: 0.15 baseChance
    world.addComponent(entityId, Shell, createShellData({ stability: 15 })); // -0.15 chance -> 0 effective

    vi.spyOn(Math, 'random').mockReturnValue(0); // Even at 0, it should fail if effective chance is 0 (or strictly less than)

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.effectApplied).toBe(false);

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('CRITICAL_REBOOT forces Heat to 0', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 170, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    kernelPanicSystem.checkOverclock(entityId);
    const heat = world.getComponent(entityId, Heat);
    expect(heat?.current).toBe(0);
    expect(eventBus.emit).toHaveBeenCalledWith('HEAT_CHANGED', expect.objectContaining({ newHeat: 0 }));

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('CRITICAL_REBOOT applies status effect with duration 3', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 170, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    kernelPanicSystem.checkOverclock(entityId);
    expect(eventBus.emit).toHaveBeenCalledWith('STATUS_EFFECT_APPLIED', expect.objectContaining({ entityId, effectName: 'CRITICAL_REBOOT', duration: 3 }));

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('checkOverclock emits KERNEL_PANIC_TRIGGERED event when roll succeeds', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 110, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    kernelPanicSystem.checkOverclock(entityId);
    expect(eventBus.emit).toHaveBeenCalledWith('KERNEL_PANIC_TRIGGERED', expect.objectContaining({ entityId, tier: 1, effectName: 'HUD_GLITCH', severity: 'minor' }));

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('checkOverclock does NOT apply effect when roll fails', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 110, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0.99); // Force failure

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.effectApplied).toBe(false);
    expect(eventBus.emit).not.toHaveBeenCalledWith('STATUS_EFFECT_APPLIED', expect.anything());

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('registers to Phase.CLEANUP', () => {
    const registerSpy = vi.spyOn(world, 'registerSystem');
    kernelPanicSystem.init();
    expect(registerSpy).toHaveBeenCalledWith(Phase.CLEANUP, expect.any(Function));
  });

  it('triggers checkOverclock on Phase.CLEANUP when heat is above maxSafe', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 110, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success
    
    kernelPanicSystem.init();
    world.executeSystems(Phase.CLEANUP);

    expect(eventBus.emit).toHaveBeenCalledWith('KERNEL_PANIC_TRIGGERED', expect.objectContaining({
      entityId,
      effectName: 'HUD_GLITCH'
    }));

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('does NOT trigger checkOverclock on Phase.CLEANUP when heat <= maxSafe', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 80, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success if it were called
    
    kernelPanicSystem.init();
    world.executeSystems(Phase.CLEANUP);

    expect(eventBus.emit).not.toHaveBeenCalledWith('KERNEL_PANIC_TRIGGERED', expect.anything());

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('it correctly selects tier 1 for heat just above 100%', () => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Heat, createHeatData({ current: 100.5, maxSafe: 100 }));
    world.addComponent(entityId, Shell, createShellData({ stability: 0 }));

    vi.spyOn(Math, 'random').mockReturnValue(0); // Force success

    const result = kernelPanicSystem.checkOverclock(entityId);
    expect(result?.tier).toBe(1);
    expect(result?.effectName).toBe('HUD_GLITCH');

    vi.spyOn(Math, 'random').mockRestore();
  });
});
