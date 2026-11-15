import type { Container, Sprite } from 'pixi.js';
import { AIBehaviorType } from '@shared/components/ai-state';
import { TILE_SIZE } from '../constants';
import { MicroLightDescriptor, ParticleGbufferDescriptor } from '../lighting/types';
import { DEFAULT_PARTICLE_POOL_CAPACITY, ParticlePool } from './particle-pool';
import {
  BurstSpawnConfig,
  PersistentEmitterPreset,
  createCryoSpillMistBurstConfig,
  createCryoSpillShardBurstConfig,
  createDamageBurstConfig,
  createEmpArcBurstConfig,
  createVentEmberBurstConfig,
  createVentSteamBurstConfig,
  getBehaviorColorHex,
  getPresetForBehavior,
  getPresetForProp,
} from './presets';

interface AttachedEmitter {
  id: number;
  preset: PersistentEmitterPreset;
  spawnTimerMs: number;
  phaseOffsetRad: number;
}

export interface ParticleTelemetry {
  activeEmitters: number;
  totalParticles: number;
  capacity: number;
  emissiveParticles: number;
  normalLitParticles: number;
  microLightClusters: number;
}

export class ParticleSystem {
  public readonly pool: ParticlePool;
  private readonly emitters = new WeakMap<Sprite, AttachedEmitter>();
  private readonly activeSprites = new Set<Sprite>();
  private nextEmitterId = 1;
  private latestGbufferParticles: ParticleGbufferDescriptor[] = [];
  private latestMicroLights: MicroLightDescriptor[] = [];

  constructor(capacity: number = DEFAULT_PARTICLE_POOL_CAPACITY) {
    this.pool = new ParticlePool(capacity);
  }

  public attachBehaviorEmitter(
    sprite: Sprite,
    behaviorType: AIBehaviorType,
    effectsLayer?: Container,
  ): void {
    if (effectsLayer) {
      this.pool.attachToLayer(effectsLayer);
    }
    if (this.emitters.has(sprite)) return;

    const preset = getPresetForBehavior(behaviorType);
    const id = this.nextEmitterId++;
    this.emitters.set(sprite, {
      id,
      preset,
      spawnTimerMs: 0,
      phaseOffsetRad: (id * 1.618) % (Math.PI * 2),
    });
    this.activeSprites.add(sprite);
  }

  public attachPropEmitter(
    sprite: Sprite,
    spriteKey: string,
    effectsLayer?: Container,
  ): boolean {
    const preset = getPresetForProp(spriteKey);
    if (!preset) return false;
    if (effectsLayer) {
      this.pool.attachToLayer(effectsLayer);
    }
    const existing = this.emitters.get(sprite);
    if (existing) {
      if (existing.preset.id === preset.id) return true;
      existing.preset = preset;
      return true;
    }

    const id = this.nextEmitterId++;
    this.emitters.set(sprite, {
      id,
      preset,
      spawnTimerMs: 0,
      phaseOffsetRad: (id * 2.094) % (Math.PI * 2),
    });
    this.activeSprites.add(sprite);
    return true;
  }

  public cleanupEmitter(sprite: Sprite): void {
    const state = this.emitters.get(sprite);
    if (!state) return;
    this.pool.releaseEmitterParticles(state.id);
    this.emitters.delete(sprite);
    this.activeSprites.delete(sprite);
  }

  public disposeAllEmitters(): void {
    for (const sprite of Array.from(this.activeSprites)) {
      this.cleanupEmitter(sprite);
    }
    this.pool.clearAll();
  }

  public update(deltaMs: number): void {
    const dt = Math.max(0, Math.min(100, deltaMs));

    for (const sprite of Array.from(this.activeSprites)) {
      if (sprite.destroyed) {
        this.cleanupEmitter(sprite);
        continue;
      }
      const state = this.emitters.get(sprite);
      if (!state) {
        this.activeSprites.delete(sprite);
        continue;
      }
      if (!sprite.visible || (sprite.alpha ?? 1) <= 0.01) {
        continue;
      }

      state.spawnTimerMs += dt;
      const preset = state.preset;
      if (state.spawnTimerMs >= preset.spawnIntervalMs) {
        state.spawnTimerMs = 0;
        if (this.pool.getEmitterActiveCount(state.id) < preset.maxActiveFromEmitter) {
          this.spawnFromPreset(sprite, state, preset);
        }
      }
    }

    this.pool.update(dt);
  }

  private spawnFromPreset(
    sprite: Sprite,
    state: AttachedEmitter,
    preset: PersistentEmitterPreset,
  ): void {
    const centerX = sprite.x + ((sprite.pivot?.x ?? 0) > 0 ? 0 : TILE_SIZE * 0.5);
    const centerY = sprite.y + ((sprite.pivot?.y ?? 0) > 0 ? 0 : TILE_SIZE * 0.5);

    const useSecondary =
      preset.secondaryMode !== undefined &&
      preset.secondaryChance !== undefined &&
      Math.random() < preset.secondaryChance;
    const mode = useSecondary && preset.secondaryMode ? preset.secondaryMode : preset.mode;

    let colorHex = preset.colorHex;
    if (preset.secondaryColorHex !== undefined && (useSecondary || Math.random() < 0.35)) {
      colorHex = preset.secondaryColorHex;
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = preset.speedMin + Math.random() * (preset.speedMax - preset.speedMin);
    const maxLifeMs = preset.lifeMinMs + Math.random() * (preset.lifeMaxMs - preset.lifeMinMs);
    const size = preset.sizeMin + Math.random() * (preset.sizeMax - preset.sizeMin);

    let spawnX = centerX + (Math.random() - 0.5) * preset.horizontalSpanPx;
    let spawnY = centerY + preset.verticalOffsetPx + (Math.random() - 0.5) * 10;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed + preset.upwardBias;

    // Special horizontal crackling between ceramic anode towers for capacitor bank
    if (preset.id === 'prop_capacitor_bank') {
      const fromLeft = Math.random() < 0.5;
      spawnX = centerX + (fromLeft ? -7 : 6) + (Math.random() - 0.5) * 2;
      spawnY = centerY + preset.verticalOffsetPx + (Math.random() - 0.5) * 3;
      vx = (fromLeft ? 1 : -1) * (0.045 + Math.random() * 0.03);
      vy = (Math.random() - 0.5) * 0.025;
    }

    const orbitAngleRad =
      preset.orbitRadiusPx > 0 ? state.phaseOffsetRad + Math.random() * Math.PI * 2 : 0;

    this.pool.spawn({
      emitterId: state.id,
      mode,
      worldX: spawnX,
      worldY: spawnY,
      vx: preset.orbitRadiusPx > 0 ? 0 : vx,
      vy: preset.orbitRadiusPx > 0 ? preset.upwardBias : vy,
      gravity: preset.gravity,
      bounceFactor: preset.bounceFactor,
      bounceFloorY: centerY + 13,
      maxLifeMs,
      size,
      baseAlpha: mode === 'emissive' ? 0.92 : 0.44,
      colorHex,
      heightPx: preset.heightPx,
      shadowOpacity: preset.shadowOpacity,
      microIntensity: mode === 'emissive' ? preset.microIntensity : 0,
      microRadiusPx: mode === 'emissive' ? preset.microRadiusPx : 0,
      orbitRadiusPx: preset.orbitRadiusPx,
      orbitAngleRad,
      orbitSpeedRadPerMs: preset.orbitSpeedRadPerMs,
    });
  }

  public spawnBurst(
    worldX: number,
    worldY: number,
    config: BurstSpawnConfig,
    effectsLayer?: Container,
  ): void {
    if (effectsLayer) {
      this.pool.attachToLayer(effectsLayer);
    }

    const scatter = config.scatterRadiusPx ?? 6;
    for (let i = 0; i < config.count; i++) {
      const t = config.count > 1 ? i / config.count : 0.5;
      const jitter = (Math.random() - 0.5) * 0.25;
      const angle = config.baseAngleRad + (t - 0.5 + jitter) * config.spreadRad;
      const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      const maxLifeMs = config.lifeMinMs + Math.random() * (config.lifeMaxMs - config.lifeMinMs);
      const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
      const colorHex =
        config.secondaryColorHex !== undefined && Math.random() < 0.4
          ? config.secondaryColorHex
          : config.colorHex;

      this.pool.spawn({
        emitterId: 0,
        mode: config.mode,
        worldX: worldX + (Math.random() - 0.5) * scatter,
        worldY: worldY + (Math.random() - 0.5) * scatter,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: config.gravity,
        bounceFactor: config.bounceFactor,
        bounceFloorY: worldY + 12,
        maxLifeMs,
        size,
        baseAlpha: config.mode === 'emissive' ? 0.95 : 0.46,
        colorHex,
        heightPx: config.heightPx,
        shadowOpacity: config.shadowOpacity,
        microIntensity: config.microIntensity,
        microRadiusPx: config.microRadiusPx,
      });
    }
  }

  public emitDamageBurst(
    worldX: number,
    worldY: number,
    impactAngleRad: number = 0,
    effectsLayer?: Container,
  ): void {
    this.spawnBurst(worldX, worldY, createDamageBurstConfig(impactAngleRad), effectsLayer);
  }

  public emitVentBurst(worldX: number, worldY: number, effectsLayer?: Container): void {
    this.spawnBurst(worldX, worldY, createVentSteamBurstConfig(), effectsLayer);
    this.spawnBurst(worldX, worldY, createVentEmberBurstConfig(), effectsLayer);
  }

  public emitCryoSpillBurst(worldX: number, worldY: number, effectsLayer?: Container): void {
    this.spawnBurst(worldX, worldY, createCryoSpillShardBurstConfig(), effectsLayer);
    this.spawnBurst(worldX, worldY, createCryoSpillMistBurstConfig(), effectsLayer);
  }

  public emitEmpArcBurst(worldX: number, worldY: number, effectsLayer?: Container): void {
    this.spawnBurst(worldX, worldY, createEmpArcBurstConfig(), effectsLayer);
  }

  public emitFirmwareBurst(
    worldX: number,
    worldY: number,
    abilityName?: string,
    effectsLayer?: Container,
  ): void {
    if (!abilityName) return;
    const upper = abilityName.toUpperCase();
    if (upper.includes('EMP') || upper.includes('OVERCLOCK') || upper.includes('SURGE')) {
      this.emitEmpArcBurst(worldX, worldY, effectsLayer);
      return;
    }
    this.spawnBurst(
      worldX,
      worldY,
      {
        mode: 'emissive',
        count: 14,
        colorHex: 0x00f0ff,
        secondaryColorHex: 0x38bdf8,
        speedMin: 0.04,
        speedMax: 0.085,
        spreadRad: Math.PI * 2,
        baseAngleRad: 0,
        lifeMinMs: 220,
        lifeMaxMs: 420,
        sizeMin: 2,
        sizeMax: 3.5,
        gravity: 0,
        bounceFactor: 0,
        heightPx: 14,
        shadowOpacity: 0,
        microIntensity: 1.1,
        microRadiusPx: 42,
        scatterRadiusPx: 8,
      },
      effectsLayer,
    );
  }

  public getLightingInputs(
    cameraX: number,
    cameraY: number,
    cameraZoom: number,
  ): {
    particles: ParticleGbufferDescriptor[];
    microLights: MicroLightDescriptor[];
  } {
    const res = this.pool.collectRenderDescriptors(cameraX, cameraY, cameraZoom);
    this.latestGbufferParticles = res.particles;
    this.latestMicroLights = res.microLights;
    return res;
  }

  public getTelemetry(): ParticleTelemetry {
    let emissiveParticles = 0;
    let normalLitParticles = 0;
    for (let i = 0; i < this.latestGbufferParticles.length; i++) {
      if (this.latestGbufferParticles[i].mode === 'emissive') {
        emissiveParticles++;
      } else {
        normalLitParticles++;
      }
    }

    return {
      activeEmitters: this.activeSprites.size,
      totalParticles: this.pool.activeCount,
      capacity: this.pool.capacity,
      emissiveParticles,
      normalLitParticles,
      microLightClusters: this.latestMicroLights.length,
    };
  }

  public destroy(): void {
    this.disposeAllEmitters();
    this.pool.destroy();
    this.latestGbufferParticles = [];
    this.latestMicroLights = [];
  }
}

export { getBehaviorColorHex };
