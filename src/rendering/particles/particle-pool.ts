import * as PIXI from 'pixi.js';
import type { Container, Sprite, Texture } from 'pixi.js';
import {
  MAX_MICRO_LIGHTS,
  MicroLightDescriptor,
  ParticleGbufferDescriptor,
  safeGetPixiExport,
} from '../lighting/types';
import { hexNumberToRgbNormalized, PooledParticleMode } from './presets';

export const DEFAULT_PARTICLE_POOL_CAPACITY = 512;
export const MICRO_LIGHT_CLUSTER_CELL_PX = 12;

export interface PooledParticleSlot {
  index: number;
  active: boolean;
  emitterId: number;
  mode: PooledParticleMode;
  sprite: Sprite | null;
  worldX: number;
  worldY: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  gravity: number;
  bounceFactor: number;
  bounceFloorY: number;
  ageMs: number;
  maxLifeMs: number;
  size: number;
  baseAlpha: number;
  colorHex: number;
  colorR: number;
  colorG: number;
  colorB: number;
  heightPx: number;
  shadowOpacity: number;
  microIntensity: number;
  microRadiusPx: number;
  orbitRadiusPx: number;
  orbitAngleRad: number;
  orbitSpeedRadPerMs: number;
}

export interface SpawnParticleParams {
  emitterId: number;
  mode: PooledParticleMode;
  worldX: number;
  worldY: number;
  vx: number;
  vy: number;
  gravity: number;
  bounceFactor: number;
  bounceFloorY: number;
  maxLifeMs: number;
  size: number;
  baseAlpha?: number;
  colorHex: number;
  heightPx: number;
  shadowOpacity: number;
  microIntensity: number;
  microRadiusPx: number;
  orbitRadiusPx?: number;
  orbitAngleRad?: number;
  orbitSpeedRadPerMs?: number;
}

interface MicroLightCluster {
  weightedX: number;
  weightedY: number;
  weightSum: number;
  intensitySum: number;
  colorR: number;
  colorG: number;
  colorB: number;
  maxRadiusPx: number;
}

function createEmptySlot(index: number): PooledParticleSlot {
  return {
    index,
    active: false,
    emitterId: 0,
    mode: 'emissive',
    sprite: null,
    worldX: 0,
    worldY: 0,
    originX: 0,
    originY: 0,
    vx: 0,
    vy: 0,
    gravity: 0,
    bounceFactor: 0,
    bounceFloorY: 0,
    ageMs: 0,
    maxLifeMs: 500,
    size: 2,
    baseAlpha: 0.9,
    colorHex: 0xffffff,
    colorR: 1,
    colorG: 1,
    colorB: 1,
    heightPx: 10,
    shadowOpacity: 0,
    microIntensity: 0,
    microRadiusPx: 0,
    orbitRadiusPx: 0,
    orbitAngleRad: 0,
    orbitSpeedRadPerMs: 0,
  };
}

export function createCircularParticleBuffer(size = 16): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const half = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const d = Math.hypot(dx, dy);
      const idx = (y * size + x) * 4;
      if (d >= 1.0) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      } else {
        // Smooth radial falloff matching G-Buffer circular particle disc
        const t = Math.max(0, Math.min(1, (1.0 - d) / 0.85));
        const smooth = t * t * (3 - 2 * t);
        const a = Math.round(smooth * 255);
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = a;
      }
    }
  }
  return data;
}

function createCircularParticleTexture(): Texture | null {
  try {
    const BufferSourceCtor = safeGetPixiExport<typeof PIXI.BufferImageSource>(
      PIXI,
      'BufferImageSource',
    );
    const TextureCtor = safeGetPixiExport<typeof PIXI.Texture>(PIXI, 'Texture');
    if (typeof BufferSourceCtor !== 'function' || typeof TextureCtor !== 'function') {
      return null;
    }
    const size = 16;
    const source = new BufferSourceCtor({
      resource: createCircularParticleBuffer(size),
      width: size,
      height: size,
      format: 'rgba8unorm',
      scaleMode: 'linear',
      addressMode: 'clamp-to-edge',
    });
    return new TextureCtor({ source });
  } catch {
    return null;
  }
}

export class ParticlePool {
  public readonly capacity: number;
  private readonly slots: PooledParticleSlot[];
  private readonly freeStack: number[];
  private readonly activeIndices: number[] = [];
  private readonly emitterCounts = new Map<number, number>();
  private readonly gbufferDescriptors: ParticleGbufferDescriptor[] = [];
  private readonly microLightDescriptors: MicroLightDescriptor[] = [];
  private readonly clusterPool: MicroLightCluster[] = [];
  private readonly clusterMap = new Map<number, MicroLightCluster>();

  private particleContainer: Container | null = null;
  private particleTexture: Texture | null = null;
  private ownedParticleTexture: Texture | null = null;
  private disposed = false;

  constructor(capacity: number = DEFAULT_PARTICLE_POOL_CAPACITY) {
    this.capacity = Math.max(1, capacity);
    this.slots = new Array<PooledParticleSlot>(this.capacity);
    this.freeStack = new Array<number>(this.capacity);

    for (let i = 0; i < this.capacity; i++) {
      this.slots[i] = createEmptySlot(i);
      this.freeStack[i] = this.capacity - 1 - i;
    }

    for (let i = 0; i < MAX_MICRO_LIGHTS * 2; i++) {
      this.clusterPool.push({
        weightedX: 0,
        weightedY: 0,
        weightSum: 0,
        intensitySum: 0,
        colorR: 0,
        colorG: 0,
        colorB: 0,
        maxRadiusPx: 0,
      });
    }
  }

  public get activeCount(): number {
    return this.activeIndices.length;
  }

  public getEmitterActiveCount(emitterId: number): number {
    return this.emitterCounts.get(emitterId) ?? 0;
  }

  public attachToLayer(effectsLayer: Container): void {
    if (this.disposed) return;
    if (!this.particleContainer) {
      const ContainerCtor = safeGetPixiExport<typeof PIXI.Container>(PIXI, 'Container');
      if (typeof ContainerCtor === 'function') {
        this.particleContainer = new ContainerCtor();
        this.particleContainer.label = 'pooledParticles';
      }
    }
    if (this.particleContainer && this.particleContainer.parent !== effectsLayer) {
      effectsLayer.addChild(this.particleContainer);
    }

    if (!this.particleTexture) {
      const circularTex = createCircularParticleTexture();
      if (circularTex) {
        this.ownedParticleTexture = circularTex;
        this.particleTexture = circularTex;
      } else {
        const TexNs = safeGetPixiExport<typeof PIXI.Texture>(PIXI, 'Texture');
        this.particleTexture = TexNs?.WHITE ?? TexNs?.EMPTY ?? ({ width: 4, height: 4 } as Texture);
      }
    }
  }

  private ensureSlotSprite(slot: PooledParticleSlot): Sprite | null {
    if (slot.sprite && !slot.sprite.destroyed) {
      return slot.sprite;
    }
    if (!this.particleContainer) return null;

    const SpriteCtor = safeGetPixiExport<typeof PIXI.Sprite>(PIXI, 'Sprite');
    if (typeof SpriteCtor !== 'function') return null;

    const sprite = new SpriteCtor(this.particleTexture ?? undefined);
    if (sprite.anchor?.set) {
      sprite.anchor.set(0.5);
    }
    sprite.visible = false;
    this.particleContainer.addChild(sprite);
    slot.sprite = sprite;
    return sprite;
  }

  public spawn(params: SpawnParticleParams): boolean {
    if (this.disposed || this.freeStack.length === 0) {
      return false;
    }

    const index = this.freeStack.pop()!;
    const slot = this.slots[index];
    const [r, g, b] = hexNumberToRgbNormalized(params.colorHex);

    slot.active = true;
    slot.emitterId = params.emitterId;
    slot.mode = params.mode;
    slot.worldX = params.worldX;
    slot.worldY = params.worldY;
    slot.originX = params.worldX;
    slot.originY = params.worldY;
    slot.vx = params.vx;
    slot.vy = params.vy;
    slot.gravity = params.gravity;
    slot.bounceFactor = params.bounceFactor;
    slot.bounceFloorY = params.bounceFloorY;
    slot.ageMs = 0;
    slot.maxLifeMs = Math.max(16, params.maxLifeMs);
    slot.size = Math.max(1, params.size);
    slot.baseAlpha = params.baseAlpha ?? (params.mode === 'emissive' ? 0.92 : 0.42);
    slot.colorHex = params.colorHex;
    slot.colorR = r;
    slot.colorG = g;
    slot.colorB = b;
    slot.heightPx = params.heightPx;
    slot.shadowOpacity = params.shadowOpacity;
    slot.microIntensity = params.microIntensity;
    slot.microRadiusPx = params.microRadiusPx;
    slot.orbitRadiusPx = params.orbitRadiusPx ?? 0;
    slot.orbitAngleRad = params.orbitAngleRad ?? 0;
    slot.orbitSpeedRadPerMs = params.orbitSpeedRadPerMs ?? 0;

    if (params.emitterId > 0) {
      this.emitterCounts.set(params.emitterId, (this.emitterCounts.get(params.emitterId) ?? 0) + 1);
    }

    const sprite = this.ensureSlotSprite(slot);
    if (sprite) {
      sprite.x = slot.worldX;
      sprite.y = slot.worldY;
      sprite.tint = slot.colorHex;
      sprite.alpha = slot.baseAlpha;
      sprite.visible = true;
      if (sprite.scale?.set) {
        const baseW = Math.max(1, this.particleTexture?.width ?? 16);
        const s = slot.size / baseW;
        sprite.scale.set(s, s);
      } else {
        sprite.width = slot.size;
        sprite.height = slot.size;
      }
    }

    this.activeIndices.push(index);
    return true;
  }

  public releaseEmitterParticles(emitterId: number): void {
    for (let i = this.activeIndices.length - 1; i >= 0; i--) {
      const idx = this.activeIndices[i];
      const slot = this.slots[idx];
      if (slot.emitterId === emitterId) {
        this.deactivateAt(i);
      }
    }
    this.emitterCounts.delete(emitterId);
  }

  public clearAll(): void {
    for (let i = this.activeIndices.length - 1; i >= 0; i--) {
      this.deactivateAt(i);
    }
    this.emitterCounts.clear();
  }

  private deactivateAt(activeListPos: number): void {
    const idx = this.activeIndices[activeListPos];
    const slot = this.slots[idx];
    slot.active = false;
    if (slot.emitterId > 0) {
      const prev = this.emitterCounts.get(slot.emitterId) ?? 0;
      if (prev <= 1) {
        this.emitterCounts.delete(slot.emitterId);
      } else {
        this.emitterCounts.set(slot.emitterId, prev - 1);
      }
    }
    slot.emitterId = 0;
    if (slot.sprite && !slot.sprite.destroyed) {
      slot.sprite.visible = false;
    }

    const lastIdx = this.activeIndices.length - 1;
    if (activeListPos !== lastIdx) {
      this.activeIndices[activeListPos] = this.activeIndices[lastIdx];
    }
    this.activeIndices.pop();
    this.freeStack.push(idx);
  }

  public update(deltaMs: number): void {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(100, deltaMs));

    for (let i = this.activeIndices.length - 1; i >= 0; i--) {
      const slot = this.slots[this.activeIndices[i]];
      slot.ageMs += dt;
      if (slot.ageMs >= slot.maxLifeMs) {
        this.deactivateAt(i);
        continue;
      }

      if (slot.orbitRadiusPx > 0 && slot.orbitSpeedRadPerMs !== 0) {
        slot.orbitAngleRad += slot.orbitSpeedRadPerMs * dt;
        slot.originY += slot.vy * dt;
        slot.worldX = slot.originX + Math.cos(slot.orbitAngleRad) * slot.orbitRadiusPx;
        slot.worldY = slot.originY + Math.sin(slot.orbitAngleRad) * slot.orbitRadiusPx * 0.65;
      } else {
        slot.vy += slot.gravity * dt;
        slot.worldX += slot.vx * dt;
        slot.worldY += slot.vy * dt;
        if (slot.bounceFactor > 0 && slot.worldY > slot.bounceFloorY) {
          slot.worldY = slot.bounceFloorY;
          slot.vy = -Math.abs(slot.vy) * slot.bounceFactor;
          slot.vx *= 0.72;
        }
      }

      const lifeRemaining = 1 - slot.ageMs / slot.maxLifeMs;
      if (slot.sprite && !slot.sprite.destroyed) {
        slot.sprite.x = slot.worldX;
        slot.sprite.y = slot.worldY;
        slot.sprite.alpha = slot.baseAlpha * lifeRemaining;
      }
    }
  }

  /**
   * Builds reusable G-Buffer particle descriptors and spatially clustered `uMicroLights[64]`
   * without allocating heap arrays per frame.
   */
  public collectRenderDescriptors(
    cameraX: number,
    cameraY: number,
    cameraZoom: number,
  ): {
    particles: ParticleGbufferDescriptor[];
    microLights: MicroLightDescriptor[];
  } {
    this.gbufferDescriptors.length = 0;
    this.microLightDescriptors.length = 0;
    this.clusterMap.clear();
    let clusterPoolCursor = 0;

    for (let i = 0; i < this.activeIndices.length; i++) {
      const slot = this.slots[this.activeIndices[i]];
      const lifeRemaining = Math.max(0, 1 - slot.ageMs / slot.maxLifeMs);
      const alpha = slot.baseAlpha * lifeRemaining;
      if (alpha <= 0.01) continue;

      this.gbufferDescriptors.push({
        worldX: slot.worldX,
        worldY: slot.worldY,
        size: slot.size,
        colorRgb: [slot.colorR, slot.colorG, slot.colorB],
        alpha,
        mode: slot.mode,
        heightPx: slot.heightPx,
        shadowOpacity: slot.shadowOpacity,
      });

      if (slot.mode === 'emissive' && slot.microIntensity > 0 && slot.microRadiusPx > 0) {
        const effIntensity = slot.microIntensity * lifeRemaining;
        if (effIntensity <= 0.02) continue;

        const cx = Math.floor(slot.worldX / MICRO_LIGHT_CLUSTER_CELL_PX);
        const cy = Math.floor(slot.worldY / MICRO_LIGHT_CLUSTER_CELL_PX);
        const cellKey = (cx + 4096) * 8192 + (cy + 4096);

        let cluster = this.clusterMap.get(cellKey);
        if (!cluster) {
          if (clusterPoolCursor < this.clusterPool.length) {
            cluster = this.clusterPool[clusterPoolCursor++];
          } else {
            cluster = {
              weightedX: 0,
              weightedY: 0,
              weightSum: 0,
              intensitySum: 0,
              colorR: 0,
              colorG: 0,
              colorB: 0,
              maxRadiusPx: 0,
            };
            this.clusterPool.push(cluster);
            clusterPoolCursor++;
          }
          cluster.weightedX = 0;
          cluster.weightedY = 0;
          cluster.weightSum = 0;
          cluster.intensitySum = 0;
          cluster.colorR = 0;
          cluster.colorG = 0;
          cluster.colorB = 0;
          cluster.maxRadiusPx = 0;
          this.clusterMap.set(cellKey, cluster);
        }

        cluster.weightedX += slot.worldX * effIntensity;
        cluster.weightedY += slot.worldY * effIntensity;
        cluster.weightSum += effIntensity;
        cluster.intensitySum = Math.min(2.6, cluster.intensitySum + effIntensity * 0.72);
        cluster.colorR += slot.colorR * effIntensity;
        cluster.colorG += slot.colorG * effIntensity;
        cluster.colorB += slot.colorB * effIntensity;
        if (slot.microRadiusPx > cluster.maxRadiusPx) {
          cluster.maxRadiusPx = slot.microRadiusPx;
        }
      }
    }

    for (const cluster of this.clusterMap.values()) {
      const wSum = Math.max(0.0001, cluster.weightSum);
      const wx = cluster.weightedX / wSum;
      const wy = cluster.weightedY / wSum;
      const r = Math.min(1.5, cluster.colorR / wSum);
      const g = Math.min(1.5, cluster.colorG / wSum);
      const b = Math.min(1.5, cluster.colorB / wSum);

      this.microLightDescriptors.push({
        screenX: wx * cameraZoom + cameraX,
        screenY: wy * cameraZoom + cameraY,
        radiusPx: cluster.maxRadiusPx,
        intensity: cluster.intensitySum,
        colorRgb: [r, g, b],
      });
    }

    if (this.microLightDescriptors.length > MAX_MICRO_LIGHTS) {
      this.microLightDescriptors.sort((a, b) => b.intensity - a.intensity);
      this.microLightDescriptors.length = MAX_MICRO_LIGHTS;
    }

    return {
      particles: this.gbufferDescriptors,
      microLights: this.microLightDescriptors,
    };
  }

  public destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearAll();
    for (const slot of this.slots) {
      if (slot.sprite && !slot.sprite.destroyed) {
        slot.sprite.destroy();
      }
      slot.sprite = null;
    }
    if (this.particleContainer && !this.particleContainer.destroyed) {
      this.particleContainer.destroy({ children: true });
    }
    if (this.ownedParticleTexture && !this.ownedParticleTexture.destroyed) {
      this.ownedParticleTexture.destroy(true);
    }
    this.ownedParticleTexture = null;
    this.particleTexture = null;
    this.particleContainer = null;
    this.clusterMap.clear();
  }
}
