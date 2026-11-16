import type { FactionTheme, SectorCondition } from '@shared/components/environment';

export const HOTLOAD_BROADCAST_CHANNEL = 'nirmata:gamedata-hotload';

export type HotloadDomain =
  | 'entity'
  | 'mixin'
  | 'shell'
  | 'audioCue'
  | 'config:ambiance'
  | 'config:lighting'
  | 'config:fov'
  | 'config:economy'
  | 'config:depth'
  | 'config:loot'
  | 'spawnTable'
  | 'prefab'
  | 'aiTree'
  | 'tileset:animations'
  | 'assets:atlas'
  | 'env:override';

export type HotloadMode = 'PREVIEW' | 'COMMIT' | 'REVERT';

export interface SessionHotloadPatch {
  updatedEntities: Array<{
    entityId: number;
    componentsSet: Record<string, unknown>;
    componentsRemoved: string[];
  }>;
  gridWalkabilityUpdates?: Array<{
    x: number;
    y: number;
    walkable: boolean;
  }>;
  playerShellStatsChanged?: boolean;
}

export interface HotloadEnvelope<T = unknown> {
  id: string;
  timestamp: number;
  mode: HotloadMode;
  domain: HotloadDomain;
  targetId: string;
  payload: T;
  /** Included when server SessionManager reconciled active sessions on COMMIT */
  sessionPatches?: Record<string, SessionHotloadPatch>;
}

export interface EnvOverridePayload {
  factionTheme?: FactionTheme | string | null;
  sectorCondition?: SectorCondition | null;
  heatPercent?: number | null;
  stabilityPercent?: number | null;
}

export interface AssetsAtlasHotloadPayload {
  themeId: string;
  filesChanged: string[];
  version: number;
}

export interface TilesetAnimationHotloadPayload {
  themeId: string;
  animSetKey?: string;
  animations: Record<string, unknown>;
  propagateToThemes?: boolean;
}

export interface GameHeartbeatPayload {
  sessionId: string | null;
  floorNumber: number;
  shellId: string | null;
  gameStatus: string;
  timestamp: number;
}

export type HotloadControlMessage =
  | { type: 'HOTLOAD'; envelope: HotloadEnvelope }
  | { type: 'HEARTBEAT_PING'; timestamp: number }
  | { type: 'HEARTBEAT_ACK'; payload: GameHeartbeatPayload }
  | { type: 'REQUEST_SHELL_SWITCH'; shellId: string; sessionId?: string }
  | { type: 'REQUEST_RELOAD_ASSETS'; themeId?: string };

export interface HotloadToastEntry {
  id: string;
  domain: HotloadDomain;
  targetId: string;
  mode: HotloadMode;
  latencyMs: number;
  timestamp: number;
}
