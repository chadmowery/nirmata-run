import {
  HOTLOAD_BROADCAST_CHANNEL,
  type GameHeartbeatPayload,
  type HotloadControlMessage,
  type HotloadDomain,
  type HotloadEnvelope,
  type HotloadMode,
} from './types';

let studioChannel: BroadcastChannel | null = null;
let sequence = 0;

const previewTimers = new Map<string, number>();
const pendingPreviewPayloads = new Map<string, { domain: HotloadDomain; targetId: string; payload: unknown }>();

function getStudioChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!studioChannel) {
    studioChannel = new BroadcastChannel(HOTLOAD_BROADCAST_CHANNEL);
  }
  return studioChannel;
}

function makeEnvelope<T>(
  mode: HotloadMode,
  domain: HotloadDomain,
  targetId: string,
  payload: T,
): HotloadEnvelope<T> {
  sequence += 1;
  return {
    id: `studio-${Date.now()}-${sequence}`,
    timestamp: Date.now(),
    mode,
    domain,
    targetId,
    payload,
  };
}

export function postHotloadMessage(msg: HotloadControlMessage): void {
  const ch = getStudioChannel();
  if (!ch) return;
  try {
    ch.postMessage(msg);
  } catch {
    // Ignore channel errors if closed
  }
}

/**
 * Throttles transient LIVE_SYNC PREVIEW emissions via rAF / 16ms–33ms window.
 */
export function postHotloadPreview<T>(
  domain: HotloadDomain,
  targetId: string,
  payload: T,
  minIntervalMs = 16,
): void {
  const key = `${domain}:${targetId}`;
  pendingPreviewPayloads.set(key, { domain, targetId, payload });
  if (previewTimers.has(key)) return;

  const schedule = () => {
    const timer = window.setTimeout(() => {
      previewTimers.delete(key);
      const latest = pendingPreviewPayloads.get(key);
      if (!latest) return;
      pendingPreviewPayloads.delete(key);
      postHotloadMessage({
        type: 'HOTLOAD',
        envelope: makeEnvelope('PREVIEW', latest.domain, latest.targetId, latest.payload),
      });
    }, minIntervalMs);
    previewTimers.set(key, timer);
  };

  if (typeof window !== 'undefined') {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => schedule());
    } else {
      schedule();
    }
  }
}

function clearPendingPreview(key: string): void {
  const pendingTimer = previewTimers.get(key);
  if (pendingTimer !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(pendingTimer);
    previewTimers.delete(key);
  }
  pendingPreviewPayloads.delete(key);
}

export function postHotloadCommit<T>(
  domain: HotloadDomain,
  targetId: string,
  payload: T,
  sessionPatches?: HotloadEnvelope<T>['sessionPatches'],
  envelopeId?: string,
): void {
  clearPendingPreview(`${domain}:${targetId}`);

  const envelope = makeEnvelope('COMMIT', domain, targetId, payload);
  if (envelopeId) {
    envelope.id = envelopeId;
  }
  if (sessionPatches) {
    envelope.sessionPatches = sessionPatches;
  }
  postHotloadMessage({ type: 'HOTLOAD', envelope });
}

export function postHotloadRevert<T>(
  domain: HotloadDomain,
  targetId: string,
  baselinePayload: T,
): void {
  clearPendingPreview(`${domain}:${targetId}`);

  postHotloadMessage({
    type: 'HOTLOAD',
    envelope: makeEnvelope('REVERT', domain, targetId, baselinePayload),
  });
}

export function requestShellSwitch(shellId: string, sessionId?: string): void {
  postHotloadMessage({ type: 'REQUEST_SHELL_SWITCH', shellId, sessionId });
}

export function requestAssetReload(themeId?: string): void {
  postHotloadMessage({ type: 'REQUEST_RELOAD_ASSETS', themeId });
}

export function subscribeStudioHeartbeats(
  onHeartbeat: (payload: GameHeartbeatPayload) => void,
): () => void {
  const ch = getStudioChannel();
  if (!ch) return () => {};

  const handleMessage = (event: MessageEvent<HotloadControlMessage>) => {
    const data = event.data;
    if (data && data.type === 'HEARTBEAT_ACK') {
      onHeartbeat(data.payload);
    }
  };

  ch.addEventListener('message', handleMessage);
  postHotloadMessage({ type: 'HEARTBEAT_PING', timestamp: Date.now() });
  const interval = window.setInterval(() => {
    postHotloadMessage({ type: 'HEARTBEAT_PING', timestamp: Date.now() });
  }, 2500);

  return () => {
    window.clearInterval(interval);
    ch.removeEventListener('message', handleMessage);
  };
}
