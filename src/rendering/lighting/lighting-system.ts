import * as PIXI from 'pixi.js';
import type { Container, Filter, Rectangle, Renderer, Sprite } from 'pixi.js';
import type { EntityId } from '@engine/ecs/types';
import type { World } from '@engine/ecs/world';
import { Position } from '@shared/components/position';
import { LightSource, type LightSourceData } from '@shared/components/light-source';
import type { FactionTheme, SectorCondition } from '@shared/components/environment';
import { TILE_SIZE, VIEWPORT_H, VIEWPORT_W } from '../constants';
import { SelectiveBloomFilter } from './bloom-filter';
import { DeferredLightFilter } from './deferred-light-filter';
import { GBufferPass } from './gbuffer-pass';
import {
  LightingTelemetry,
  MAX_MICRO_LIGHTS,
  MAX_PRIMARY_LIGHTS,
  MicroLightDescriptor,
  ParticleGbufferDescriptor,
  RenderLightDescriptor,
  SECTOR_CONDITION_VISUAL_PROFILES,
  TransientLightInstance,
  evaluateLightAnimation,
  parseHexColorNormalized,
  resolveFactionAmbientProfile,
  safeGetPixiExport,
} from './types';

export interface TransientLightSpawnParams {
  worldX: number;
  worldY: number;
  color: string;
  intensity: number;
  radiusPx: number;
  durationMs: number;
  heightPx?: number;
  falloff?: number;
  castsShadows?: boolean;
  isBeaconPing?: boolean;
}

export interface LightingUpdateContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  world: Pick<World<any>, 'query' | 'getComponent'>;
  worldContainer: Container;
  terrainLayer: Container;
  itemLayer: Container;
  entityLayer: Container;
  renderer?: Renderer;
  spriteMap: ReadonlyMap<EntityId, Sprite>;
  fovSet?: Set<string>;
  exploredSet?: Set<string>;
  gridWidth: number;
  gridHeight: number;
  deltaMs: number;
  enabled: boolean;
  particles?: ParticleGbufferDescriptor[];
  microLights?: MicroLightDescriptor[];
  extraPrimaryLights?: RenderLightDescriptor[];
  worldScreenFilters?: Filter[];
  playerEntityId?: EntityId;
  lightOverrides?: ReadonlyMap<EntityId, LightSourceData>;
}

/**
 * Coordinates the Deferred 2.5D Lighting Pipeline:
 * 1. Maintains the G-Buffer targets & bilinear FOV visibility mask (`GBufferPass`)
 * 2. Gathers entity `LightSource` components, procedural animations, and transient lights
 * 3. Drives `DeferredLightFilter` + `SelectiveBloomFilter` on `worldContainer`
 * 4. Composes smoothly with world Heat/Stability post-filters or cleanly bypasses when disabled
 */
export class LightingSystem {
  public readonly gbuffer: GBufferPass;
  private deferredFilter: DeferredLightFilter | null = null;
  private bloomFilter: SelectiveBloomFilter | null = null;

  private elapsedTimeSec = 0;
  private nextTransientId = 1;
  private activeFactionTheme: FactionTheme | string = 'cyberacme';
  private activeSectorCondition: SectorCondition | null = null;
  private readonly transientLights: TransientLightInstance[] = [];
  private readonly gatheredPrimaryLights: RenderLightDescriptor[] = [];
  private readonly gatheredMicroLights: MicroLightDescriptor[] = [];
  private readonly entityLightCandidates: Array<{ descriptor: RenderLightDescriptor; distSq: number }> = [];
  private readonly filterAreaRect: Rectangle | null = null;

  private lastEnabled = true;

  constructor(gridWidth: number = 80, gridHeight: number = 45) {
    this.gbuffer = new GBufferPass(gridWidth, gridHeight);
    const RectCtor = safeGetPixiExport<typeof PIXI.Rectangle>(PIXI, 'Rectangle');
    if (typeof RectCtor === 'function') {
      this.filterAreaRect = new RectCtor(0, 0, VIEWPORT_W, VIEWPORT_H);
    }

    try {
      const FilterCtor = safeGetPixiExport<typeof PIXI.Filter>(PIXI, 'Filter');
      const GlProg = safeGetPixiExport<typeof PIXI.GlProgram>(PIXI, 'GlProgram');
      if (
        typeof FilterCtor === 'function' &&
        typeof GlProg?.from === 'function' &&
        this.gbuffer.rtNormalSpec &&
        this.gbuffer.rtMaterialHeight
      ) {
        this.deferredFilter = new DeferredLightFilter(
          this.gbuffer.rtNormalSpec,
          this.gbuffer.rtMaterialHeight,
          this.gbuffer.fovMaskTexture,
        );
        this.bloomFilter = new SelectiveBloomFilter(this.gbuffer.rtMaterialHeight);
      }
    } catch {
      // Headless / mocked PixiJS test environments without Filter WebGL support
      this.deferredFilter = null;
      this.bloomFilter = null;
    }
  }

  public setEnvironmentTheme(
    factionTheme?: FactionTheme | string | null,
    sectorCondition?: SectorCondition | null,
  ): void {
    this.activeFactionTheme = factionTheme ?? 'cyberacme';
    this.activeSectorCondition = sectorCondition ?? null;
  }

  public getEnvironmentTheme(): {
    factionTheme: string;
    sectorCondition: SectorCondition | null;
  } {
    return {
      factionTheme: this.activeFactionTheme,
      sectorCondition: this.activeSectorCondition,
    };
  }

  public updateFovMask(
    gridWidth: number,
    gridHeight: number,
    fovSet?: Set<string>,
    exploredSet?: Set<string>,
  ): void {
    this.gbuffer.updateFovMask(gridWidth, gridHeight, fovSet, exploredSet);
    if (this.deferredFilter && this.gbuffer.rtNormalSpec && this.gbuffer.rtMaterialHeight) {
      this.deferredFilter.updateTextures(
        this.gbuffer.rtNormalSpec,
        this.gbuffer.rtMaterialHeight,
        this.gbuffer.fovMaskTexture,
      );
    }
  }

  /**
   * Spawns a transient dynamic point light (muzzle flashes, hit sparks,
   * GHOST_PULSE reveals, EMP discharges, cryo bursts) that decays linearly over `durationMs`.
   */
  public spawnTransientLight(params: TransientLightSpawnParams): number {
    const id = this.nextTransientId++;
    this.transientLights.push({
      id,
      worldX: params.worldX,
      worldY: params.worldY,
      colorHex: params.color,
      colorRgb: parseHexColorNormalized(params.color),
      intensity: params.intensity,
      radiusPx: params.radiusPx,
      heightPx: params.heightPx ?? 16,
      falloff: params.falloff ?? 1.4,
      castsShadows: params.castsShadows ?? false,
      remainingMs: Math.max(1, params.durationMs),
      durationMs: Math.max(1, params.durationMs),
      isBeaconPing: params.isBeaconPing,
    });
    return id;
  }

  public clearTransientLights(): void {
    this.transientLights.length = 0;
  }

  /**
   * Advances animations, decays transient lights, gathers visible light descriptors,
   * captures G-Buffers, uploads lighting uniforms, and assigns worldContainer filters.
   */
  public update(ctx: LightingUpdateContext): void {
    const dtMs = Math.max(0, ctx.deltaMs);
    this.elapsedTimeSec += dtMs / 1000;
    this.lastEnabled = ctx.enabled;

    // 1. Update transient lights
    for (let i = this.transientLights.length - 1; i >= 0; i--) {
      this.transientLights[i].remainingMs -= dtMs;
      if (this.transientLights[i].remainingMs <= 0) {
        this.transientLights.splice(i, 1);
      }
    }

    const camX = ctx.worldContainer.x ?? 0;
    const camY = ctx.worldContainer.y ?? 0;
    const camZoom = ctx.worldContainer.scale?.x ?? 1;

    // 2. Gather primary lights from ECS entities with LightSource + Position
    const primary = this.gatheredPrimaryLights;
    primary.length = 0;
    const micro = this.gatheredMicroLights;
    micro.length = 0;

    const baseFilters = ctx.worldScreenFilters ?? [];
    if (!ctx.enabled) {
      ctx.worldContainer.filterArea = undefined;
      ctx.worldContainer.filters = baseFilters.length > 0 ? baseFilters : null;
      return;
    }

    const invZoom = 1 / Math.max(0.05, camZoom);
    const playerPos =
      ctx.playerEntityId !== undefined
        ? ctx.world.getComponent(ctx.playerEntityId, Position)
        : undefined;
    const refWorldX = playerPos
      ? playerPos.x * TILE_SIZE + TILE_SIZE * 0.5
      : (VIEWPORT_W * 0.5 - camX) * invZoom;
    const refWorldY = playerPos
      ? playerPos.y * TILE_SIZE + TILE_SIZE * 0.5
      : (VIEWPORT_H * 0.5 - camY) * invZoom;

    let playerDescriptor: RenderLightDescriptor | null = null;
    const candidates = this.entityLightCandidates;
    candidates.length = 0;

    const entities = ctx.world.query(Position, LightSource);
    for (let i = 0; i < entities.length; i++) {
      const entityId = entities[i];
      const light = ctx.lightOverrides?.get(entityId) ?? ctx.world.getComponent(entityId, LightSource);
      const pos = ctx.world.getComponent(entityId, Position);
      if (!light || light.enabled === false || !pos || light.intensity <= 0 || light.radius <= 0) continue;

      const isPlayer = ctx.playerEntityId !== undefined && entityId === ctx.playerEntityId;
      const sprite = ctx.spriteMap.get(entityId);
      if (sprite && sprite.visible === false && !isPlayer) continue;

      // Skip explored out-of-FOV props/entities so they do not starve MAX_PRIMARY_LIGHTS (HIGH-01)
      if (!isPlayer && ctx.fovSet && ctx.fovSet.size > 0 && !ctx.fovSet.has(`${pos.x},${pos.y}`)) {
        continue;
      }

      const evalResult = evaluateLightAnimation(light, this.elapsedTimeSec, (entityId % 17) * 0.19);
      const effectiveIntensity = light.intensity * evalResult.intensityMultiplier;
      if (effectiveIntensity <= 0.005) continue;

      // Prefer visual sprite position so point lights glide seamlessly during move tweens!
      const pivotX = sprite?.pivot?.x ?? 0;
      const pivotY = sprite?.pivot?.y ?? 0;
      const worldX =
        (sprite
          ? sprite.x + (pivotX === 0 ? TILE_SIZE * 0.5 : 0)
          : pos.x * TILE_SIZE + TILE_SIZE * 0.5) + (light.offsetX ?? 0);
      const worldY =
        (sprite
          ? sprite.y + (pivotY === 0 ? TILE_SIZE * 0.5 : 0)
          : pos.y * TILE_SIZE + TILE_SIZE * 0.5) + (light.offsetY ?? 0);

      const screenX = worldX * camZoom + camX;
      const screenY = worldY * camZoom + camY;
      const radiusScreen = light.radius * camZoom;

      // Frustum cull offscreen lights cleanly
      if (
        screenX + radiusScreen < 0 ||
        screenX - radiusScreen > VIEWPORT_W ||
        screenY + radiusScreen < 0 ||
        screenY - radiusScreen > VIEWPORT_H
      ) {
        continue;
      }

      const descriptor: RenderLightDescriptor = {
        screenX,
        screenY,
        radiusPx: light.radius,
        intensity: effectiveIntensity,
        colorRgb: evalResult.colorRgb,
        heightPx: light.height,
        falloff: light.falloff,
        castsShadows: light.castsShadows,
        isBeaconPing: false,
        ...(light.animation?.type === 'RADAR_SWEEP'
          ? { sweepAngleRad: evalResult.angleOffsetRad }
          : {}),
      };

      if (isPlayer) {
        playerDescriptor = descriptor;
      } else {
        const dx = worldX - refWorldX;
        const dy = worldY - refWorldY;
        candidates.push({ descriptor, distSq: dx * dx + dy * dy });
      }
    }

    // Priority order within MAX_PRIMARY_LIGHTS:
    // 1. Player Shell aura, 2. Transient VFX lights, 3. Closest in-FOV entity lights, 4. Beacons
    if (playerDescriptor && primary.length < MAX_PRIMARY_LIGHTS) {
      primary.push(playerDescriptor);
    }

    for (let i = 0; i < this.transientLights.length && primary.length < MAX_PRIMARY_LIGHTS; i++) {
      const tl = this.transientLights[i];
      const fade = Math.max(0, Math.min(1, tl.remainingMs / tl.durationMs));
      const screenX = tl.worldX * camZoom + camX;
      const screenY = tl.worldY * camZoom + camY;
      primary.push({
        screenX,
        screenY,
        radiusPx: tl.radiusPx,
        intensity: tl.intensity * fade,
        colorRgb: tl.colorRgb,
        heightPx: tl.heightPx,
        falloff: tl.falloff,
        castsShadows: tl.castsShadows,
        isBeaconPing: Boolean(tl.isBeaconPing),
      });
    }

    if (primary.length + candidates.length > MAX_PRIMARY_LIGHTS) {
      candidates.sort((a, b) => a.distSq - b.distSq);
    }
    for (let i = 0; i < candidates.length && primary.length < MAX_PRIMARY_LIGHTS; i++) {
      primary.push(candidates[i].descriptor);
    }

    // Add system-injected extra primary lights (e.g. DARK_SUBNET unsearched prop beacons)
    if (ctx.extraPrimaryLights) {
      for (
        let i = 0;
        i < ctx.extraPrimaryLights.length && primary.length < MAX_PRIMARY_LIGHTS;
        i++
      ) {
        primary.push(ctx.extraPrimaryLights[i]);
      }
    }

    // 3. Gather clustered particle micro-lights (LIGHT-05)
    if (ctx.microLights) {
      for (let i = 0; i < ctx.microLights.length && micro.length < MAX_MICRO_LIGHTS; i++) {
        micro.push(ctx.microLights[i]);
      }
    }

    if (!this.deferredFilter) {
      ctx.worldContainer.filters = baseFilters.length > 0 ? baseFilters : null;
      return;
    }

    // 4. Capture G-Buffer passes & bind screen filter chain: [DeferredLight, Bloom, ...screenEffects]
    this.gbuffer.capture(ctx.renderer, ctx.worldContainer, {
      terrainLayer: ctx.terrainLayer,
      itemLayer: ctx.itemLayer,
      entityLayer: ctx.entityLayer,
      particles: ctx.particles,
    });

    const factionProfile = resolveFactionAmbientProfile(this.activeFactionTheme);
    const condProfile = this.activeSectorCondition
      ? SECTOR_CONDITION_VISUAL_PROFILES[this.activeSectorCondition]
      : null;

    this.deferredFilter.uploadUniforms({
      cameraX: camX,
      cameraY: camY,
      cameraZoom: camZoom,
      gridWidth: ctx.gridWidth,
      gridHeight: ctx.gridHeight,
      timeSec: this.elapsedTimeSec,
      ambientRgb: factionProfile.rgb,
      ambientIntensity: factionProfile.intensity * (condProfile?.ambientScale ?? 1.0),
      shadowTintRgb: condProfile?.shadowTintRgb ?? factionProfile.rgb,
      conditionTintRgb: condProfile?.tintRgb ?? [1, 1, 1],
      floorPulseAmp: this.activeSectorCondition === 'THERMAL_SURGE' ? 0.28 : 0.0,
      floorPulseRgb: condProfile?.floorPulseRgb ?? [1.0, 0.3, 0.0],
      primaryLights: primary,
      microLights: micro,
    });

    if (this.gbuffer.rtNormalSpec && this.gbuffer.rtMaterialHeight) {
      this.deferredFilter.updateTextures(
        this.gbuffer.rtNormalSpec,
        this.gbuffer.rtMaterialHeight,
        this.gbuffer.fovMaskTexture,
      );
      this.bloomFilter?.setMaterialTexture(this.gbuffer.rtMaterialHeight);
    }

    const pipeline: Filter[] = [this.deferredFilter];
    if (this.bloomFilter) {
      pipeline.push(this.bloomFilter);
    }
    for (const f of baseFilters) {
      if (f !== this.deferredFilter && f !== this.bloomFilter) {
        pipeline.push(f);
      }
    }

    if (this.filterAreaRect) {
      const invZoom = 1 / Math.max(0.05, camZoom);
      this.filterAreaRect.x = -camX * invZoom;
      this.filterAreaRect.y = -camY * invZoom;
      this.filterAreaRect.width = VIEWPORT_W * invZoom;
      this.filterAreaRect.height = VIEWPORT_H * invZoom;
      ctx.worldContainer.filterArea = this.filterAreaRect;
    }
    ctx.worldContainer.filters = pipeline;
  }

  public getPrimaryLights(): readonly RenderLightDescriptor[] {
    return this.gatheredPrimaryLights;
  }

  public getTelemetry(): LightingTelemetry {
    const { width, height } = this.gbuffer.fovDimensions;
    let shadowCasters = 0;
    for (let i = 0; i < this.gatheredPrimaryLights.length; i++) {
      if (this.gatheredPrimaryLights[i].castsShadows) shadowCasters++;
    }
    return {
      enabled: this.lastEnabled,
      primaryLightCount: this.gatheredPrimaryLights.length,
      microLightCount: this.gatheredMicroLights.length,
      shadowCasterLightCount: shadowCasters,
      gbufferQuads: this.gbuffer.quadCount,
      activeFactionTheme: this.activeFactionTheme,
      activeSectorCondition: this.activeSectorCondition,
      fovGridWidth: width,
      fovGridHeight: height,
    };
  }

  public destroy(): void {
    this.transientLights.length = 0;
    this.gatheredPrimaryLights.length = 0;
    this.gatheredMicroLights.length = 0;
    this.deferredFilter?.destroy(true);
    this.bloomFilter?.destroy(true);
    this.gbuffer.destroy();
  }
}
