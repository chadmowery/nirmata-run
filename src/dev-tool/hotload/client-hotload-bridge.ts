import type { ComponentDef } from '@engine/ecs/types';
import type { GameContext } from '@/game/types';
import type { RenderSystem } from '@/rendering/render-system';
import type { GameAudioSystem } from '@/game/audio/game-audio-system';
import { getAudioEngine, type SoundCueDef } from '@engine/audio';
import { registerSoundCue } from '@/game/audio/cue-registry';
import { setAmbianceConfig, type AmbianceConfig } from '@/game/config/ambiance';
import { COMPONENTS_REGISTRY } from '@shared/components';
import { FloorState } from '@shared/components/floor-state';
import { Shell } from '@shared/components/shell';
import { gameStore } from '@/game/ui/store';
import { syncEngineToStore } from '@/game/ui/sync-bridge';
import { GameState } from '@/game/states/types';
import { useDebugStore } from '@dev-tool/debug/debug-store';
import { useHotloadToastStore } from './toast-store';
import {
  HOTLOAD_BROADCAST_CHANNEL,
  type EnvOverridePayload,
  type GameHeartbeatPayload,
  type HotloadControlMessage,
  type HotloadEnvelope,
  type SessionHotloadPatch,
} from './types';

export interface HotloadBridgeDeps {
  getContext: () => GameContext | null;
  getRenderSystem: () => RenderSystem | null;
  getGameAudioSystem: () => GameAudioSystem | null;
}

const MAX_SEEN_ENVELOPES = 256;
const componentDefByKey = new Map<string, ComponentDef<unknown>>(
  COMPONENTS_REGISTRY.map((c) => [c.key, c as ComponentDef<unknown>]),
);

export class ClientHotloadBridge {
  private readonly deps: HotloadBridgeDeps;
  private channel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private readonly seenIds: string[] = [];
  private readonly seenIdSet = new Set<string>();
  private started = false;
  private handleChannelMessageBound: ((e: MessageEvent<HotloadControlMessage>) => void) | null = null;

  constructor(deps: HotloadBridgeDeps) {
    this.deps = deps;
  }

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(HOTLOAD_BROADCAST_CHANNEL);
      this.handleChannelMessageBound = (e) => {
        this.onControlMessage(e.data);
      };
      this.channel.addEventListener('message', this.handleChannelMessageBound);
      this.sendHeartbeatAck();
    }

    if (typeof EventSource !== 'undefined') {
      const es = new EventSource('/api/dev/hotload/stream');
      this.eventSource = es;

      es.addEventListener('connected', () => {
        useHotloadToastStore.getState().setSseConnected(true);
      });

      es.addEventListener('hotload', (evt) => {
        try {
          const envelope = JSON.parse((evt as MessageEvent<string>).data) as HotloadEnvelope;
          this.handleEnvelope(envelope);
        } catch {
          // Ignore malformed SSE payload
        }
      });

      es.onerror = () => {
        useHotloadToastStore.getState().setSseConnected(false);
      };
    }
  }

  public destroy(): void {
    if (!this.started) return;
    this.started = false;

    if (this.channel && this.handleChannelMessageBound) {
      this.channel.removeEventListener('message', this.handleChannelMessageBound);
      this.channel.close();
    }
    this.channel = null;
    this.handleChannelMessageBound = null;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    useHotloadToastStore.getState().setSseConnected(false);
    useHotloadToastStore.getState().setLiveSyncActive(false);
  }

  private markSeen(id: string): boolean {
    if (this.seenIdSet.has(id)) return true;
    this.seenIdSet.add(id);
    this.seenIds.push(id);
    if (this.seenIds.length > MAX_SEEN_ENVELOPES) {
      const oldest = this.seenIds.shift();
      if (oldest) this.seenIdSet.delete(oldest);
    }
    return false;
  }

  private getCurrentHeartbeat(): GameHeartbeatPayload {
    const ctx = this.deps.getContext();
    const storeState = gameStore.getState();
    let floorNumber = 1;
    let shellId: string | null = storeState.launchConfig?.shellId ?? null;

    if (ctx && ctx.world) {
      const floorIds = ctx.world.query(FloorState);
      if (floorIds.length > 0) {
        const fs = ctx.world.getComponent(floorIds[0], FloorState);
        if (fs && typeof fs.currentFloor === 'number') {
          floorNumber = fs.currentFloor;
        }
      }
      if (typeof ctx.playerId === 'number' && ctx.world.entityExists(ctx.playerId)) {
        const shell = ctx.world.getComponent(ctx.playerId, Shell);
        if (shell?.archetypeId) {
          shellId = shell.archetypeId;
        }
      }
    }

    return {
      sessionId: ctx?.sessionId ?? storeState.launchConfig?.sessionId ?? null,
      floorNumber,
      shellId,
      gameStatus: storeState.gameStatus,
      timestamp: Date.now(),
    };
  }

  private sendHeartbeatAck(): void {
    if (!this.channel) return;
    try {
      this.channel.postMessage({
        type: 'HEARTBEAT_ACK',
        payload: this.getCurrentHeartbeat(),
      } satisfies HotloadControlMessage);
    } catch {
      // Ignore closed channel
    }
  }

  private onControlMessage(msg: HotloadControlMessage): void {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'HEARTBEAT_PING') {
      this.sendHeartbeatAck();
      return;
    }
    if (msg.type === 'HOTLOAD') {
      this.handleEnvelope(msg.envelope);
      return;
    }
    if (msg.type === 'REQUEST_SHELL_SWITCH') {
      void this.handleSwitchShellRequest(msg.shellId, msg.sessionId);
      return;
    }
    if (msg.type === 'REQUEST_RELOAD_ASSETS') {
      void this.handleReloadAssetsRequest(msg.themeId);
    }
  }

  private async handleSwitchShellRequest(shellId: string, targetSessionId?: string): Promise<void> {
    const ctx = this.deps.getContext();
    const sessionId = targetSessionId || ctx?.sessionId;
    if (!sessionId) return;
    try {
      const res = await fetch('/api/dev/hotload/switch-shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, shellId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.patch && ctx) {
          this.applySessionPatch(ctx, data.patch as SessionHotloadPatch);
        }
        this.sendHeartbeatAck();
      }
    } catch {
      // Ignore network errors
    }
  }

  private async handleReloadAssetsRequest(themeId?: string): Promise<void> {
    const assetsMod = (await import('@/rendering/assets')) as {
      hotReloadThemeAssets?: (theme: string, version: number) => Promise<void>;
    };
    const rs = this.deps.getRenderSystem() as (RenderSystem & {
      invalidateTilemap?: () => void;
      syncHotloadedSprites?: (ids?: number[]) => void;
    }) | null;
    if (assetsMod.hotReloadThemeAssets) {
      await assetsMod.hotReloadThemeAssets(themeId || 'default', Date.now());
    }
    rs?.invalidateTilemap?.();
    rs?.syncHotloadedSprites?.();
  }

  public async handleEnvelope(envelope: HotloadEnvelope): Promise<void> {
    if (!envelope || !envelope.id || this.markSeen(envelope.id)) {
      return;
    }

    const toastStore = useHotloadToastStore.getState();
    if (envelope.mode === 'PREVIEW') {
      toastStore.setLiveSyncActive(true);
    } else if (envelope.mode === 'REVERT' || envelope.mode === 'COMMIT') {
      toastStore.setLiveSyncActive(false);
    }

    const ctx = this.deps.getContext();
    const rs = this.deps.getRenderSystem();
    const audioSys = this.deps.getGameAudioSystem();

    // 1. Apply authoritative server session patches if present for the active session
    if (ctx && envelope.sessionPatches) {
      const patch = ctx.sessionId
        ? envelope.sessionPatches[ctx.sessionId]
        : Object.values(envelope.sessionPatches)[0];
      if (patch) {
        this.applySessionPatch(ctx, patch);
      }
    }

    // 2. Domain-specific runtime hooks
    switch (envelope.domain) {
      case 'audioCue': {
        const cue = envelope.payload as SoundCueDef;
        if (cue && cue.id) {
          registerSoundCue(cue);
          const engine = getAudioEngine() as ReturnType<typeof getAudioEngine> & {
            evictSampleBuffer?: (path: string) => void;
            hotUpdateCue?: (cue: SoundCueDef) => void;
          };
          if (cue.mode === 'sample' && cue.samplePath) {
            engine.evictSampleBuffer?.(cue.samplePath);
          }
          engine.hotUpdateCue?.(cue);
        }
        break;
      }

      case 'config:ambiance': {
        const cfg = envelope.payload as AmbianceConfig;
        if (cfg && cfg.scenes && cfg.depthBands) {
          setAmbianceConfig(cfg);
          const status = gameStore.getState().gameStatus;
          if (status === GameState.Playing || status === GameState.Paused) {
            let floorNum = 1;
            if (ctx) {
              const floorIds = ctx.world.query(FloorState);
              if (floorIds.length > 0) {
                floorNum = ctx.world.getComponent(floorIds[0], FloorState)?.currentFloor ?? 1;
              }
            }
            audioSys?.updateAmbianceForFloor(floorNum);
          } else {
            const cueId =
              status === GameState.Hub
                ? cfg.scenes.hub?.cueId || 'amb_hub_deck'
                : cfg.scenes.mainMenu?.cueId || 'amb_main_menu';
            const { getSoundCue } = await import('@/game/audio/cue-registry');
            const cue = getSoundCue(cueId);
            if (cue) getAudioEngine().playAmbianceCue(cue);
          }
        }
        break;
      }

      case 'config:lighting': {
        // Wired in HOTLOAD-04 via lighting config registry
        break;
      }

      case 'config:fov': {
        // Wired in HOTLOAD-04 via fov config registry
        const rsExt = rs as (RenderSystem & {
          invalidateFov?: () => void;
          invalidateTilemap?: () => void;
        }) | null;
        rsExt?.invalidateFov?.();
        rsExt?.invalidateTilemap?.();
        break;
      }

      case 'tileset:animations': {
        const payload = envelope.payload as {
          themeId?: string;
          animations?: Record<string, unknown>;
        };
        if (payload?.animations) {
          const { spriteAnimator } = await import('@/rendering/sprite-animator');
          const animatorExt = spriteAnimator as typeof spriteAnimator & {
            hotUpdateAnimations?: (themeId: string, anims: Record<string, unknown>) => void;
          };
          animatorExt.hotUpdateAnimations?.(payload.themeId || 'default', payload.animations);
        }
        break;
      }

      case 'assets:atlas': {
        const payload = envelope.payload as { themeId?: string; version?: number };
        const assetsMod = (await import('@/rendering/assets')) as {
          hotReloadThemeAssets?: (themeId: string, version: number) => Promise<void>;
        };
        if (assetsMod.hotReloadThemeAssets) {
          await assetsMod.hotReloadThemeAssets(
            payload?.themeId || 'default',
            payload?.version || Date.now(),
          );
          const rsExt = rs as (RenderSystem & {
            invalidateTilemap?: () => void;
            syncHotloadedSprites?: () => void;
          }) | null;
          rsExt?.invalidateTilemap?.();
          rsExt?.syncHotloadedSprites?.();
        }
        break;
      }

      case 'env:override': {
        const payload = envelope.payload as EnvOverridePayload;
        const rsExt = rs as (RenderSystem & {
          setEnvironmentOverride?: (override: EnvOverridePayload) => void;
        }) | null;
        rsExt?.setEnvironmentOverride?.(payload);
        if (payload.sectorCondition !== undefined && audioSys && ctx) {
          const floorIds = ctx.world.query(FloorState);
          const floorNum =
            floorIds.length > 0
              ? (ctx.world.getComponent(floorIds[0], FloorState)?.currentFloor ?? 1)
              : 1;
          audioSys.updateAmbianceForFloor(floorNum);
        }
        break;
      }

      case 'entity':
      case 'mixin':
      case 'shell': {
        // Presentation PREVIEW scrub (lights / sprites) when no server sessionPatch is present
        if (envelope.mode === 'PREVIEW' || envelope.mode === 'REVERT') {
          this.applyPresentationPreview(envelope);
        }
        break;
      }

      default:
        break;
    }

    // 3. Emit non-blocking telemetry toast & EventTimeline entry on COMMIT / REVERT
    if (envelope.mode === 'COMMIT' || envelope.mode === 'REVERT') {
      const latencyMs = Math.max(1, Date.now() - envelope.timestamp);
      toastStore.pushToast({
        id: envelope.id,
        domain: envelope.domain,
        targetId: envelope.targetId,
        mode: envelope.mode,
        latencyMs,
        timestamp: Date.now(),
      });
      useDebugStore
        .getState()
        .addTimelineEvent(
          `HOTLOAD_${envelope.mode}`,
          { domain: envelope.domain, targetId: envelope.targetId, latencyMs },
          'ui',
        );
    }
  }

  private applyPresentationPreview(envelope: HotloadEnvelope): void {
    const ctx = this.deps.getContext();
    const rs = this.deps.getRenderSystem() as (RenderSystem & {
      applyHotloadPreview?: (domain: string, targetId: string, payload: unknown) => void;
    }) | null;
    if (!ctx || !rs?.applyHotloadPreview) return;
    rs.applyHotloadPreview(envelope.domain, envelope.targetId, envelope.payload);
  }

  public applySessionPatch(ctx: GameContext, patch: SessionHotloadPatch): void {
    const { world, grid } = ctx;
    const touchedSpriteIds: number[] = [];

    for (const ent of patch.updatedEntities) {
      if (!world.entityExists(ent.entityId)) continue;

      for (const [compKey, compVal] of Object.entries(ent.componentsSet)) {
        const def = componentDefByKey.get(compKey);
        if (!def) continue;
        if (world.hasComponent(ent.entityId, def)) {
          world.patchComponent(ent.entityId, def, compVal as Record<string, unknown>);
        } else {
          world.addComponent(ent.entityId, def, compVal);
        }
        if (compKey === 'sprite' || compKey === 'shell') {
          touchedSpriteIds.push(ent.entityId);
        }
      }

      for (const compKey of ent.componentsRemoved) {
        const def = componentDefByKey.get(compKey);
        if (def && world.hasComponent(ent.entityId, def)) {
          world.removeComponent(ent.entityId, def);
        }
        if (compKey === 'sprite') {
          touchedSpriteIds.push(ent.entityId);
        }
      }
    }

    if (patch.gridWalkabilityUpdates) {
      for (const update of patch.gridWalkabilityUpdates) {
        if (grid.inBounds(update.x, update.y)) {
          grid.setTile(update.x, update.y, { walkable: update.walkable });
        }
      }
    }

    const rs = this.deps.getRenderSystem() as (RenderSystem & {
      applyHotloadSpriteUpdate?: (entityId: number) => void;
      invalidateFov?: () => void;
    }) | null;
    if (rs?.applyHotloadSpriteUpdate) {
      for (const id of touchedSpriteIds) {
        rs.applyHotloadSpriteUpdate(id);
      }
    }
    rs?.invalidateFov?.();

    const audioSys = this.deps.getGameAudioSystem() as (GameAudioSystem & {
      refreshHotloadedAudio?: () => void;
    }) | null;
    audioSys?.refreshHotloadedAudio?.();

    syncEngineToStore(ctx);
  }
}
