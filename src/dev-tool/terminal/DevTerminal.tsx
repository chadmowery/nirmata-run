import React, { useState, useEffect, useRef } from 'react';
import { logger } from '@engine/utils/logger';
import { VAULT_MAX_SLOTS } from '@shared/vault';
import { gameStore } from '@/game/ui/store';
import type { DebugAPI } from '../debug/debug-api';
import { usePerfStore } from '../perf/perf-store';
import { perfCollector } from '../perf/perf-collector';

declare global {
  interface Window {
    __DEBUG__?: DebugAPI;
  }
}

interface TerminalLine {
  text: string;
  type: 'command' | 'output' | 'error';
}

export function DevTerminal() {
  const [isVisible, setIsVisible] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<TerminalLine[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const globalGrant = async (sessionId?: string) => {
        const sid =
          sessionId ||
          gameStore.getState().playerProfile?.sessionId ||
          window.localStorage?.getItem('nimrata_sessionId') ||
          'default-player-session';

        const res = await fetch('/api/admin/grant-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid }),
        });
        const data = await res.json();
        if (data.profile) {
          gameStore.getState().setPlayerProfile(data.profile);
        }
        logger.info(
          `[GLOBAL DEBUG] grantAll: ${data.result?.itemsGranted} items, scrap: ${data.wallet?.scrap}, flux: ${data.wallet?.flux}`,
          'DEBUG',
        );
        return data;
      };

      (window as unknown as { grantAll: typeof globalGrant }).grantAll = globalGrant;
      (window as unknown as { debugGrantAll: typeof globalGrant }).debugGrantAll = globalGrant;
      (window as unknown as { seedVault: typeof globalGrant }).seedVault = globalGrant;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on backtick (without shift)
      if (e.key === '`' && !e.shiftKey) {
        e.preventDefault();
        setIsVisible((prev) => !prev);
        return;
      }

      // Close on Escape if visible
      if (e.key === 'Escape' && isVisible) {
        e.preventDefault();
        setIsVisible(false);
        return;
      }

      // If visible, stop propagation so engine doesn't catch it
      if (isVisible) {
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim();
    setHistory((prev) => [...prev, { text: cmd, type: 'command' }]);
    setInput('');

    parseCommand(cmd);
  };

  const executeGrantAll = async () => {
    const sid =
      gameStore.getState().playerProfile?.sessionId ||
      (typeof window !== 'undefined'
        ? window.localStorage?.getItem('nimrata_sessionId') || 'default-player-session'
        : 'default-player-session');

    try {
      const response = await fetch('/api/admin/grant-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          gameStore.getState().setPlayerProfile(data.profile);
        }
        const { itemsGranted, vaultFull, scrapAdded, fluxAdded } = data.result;
        const lines: TerminalLine[] = [];
        if (itemsGranted > 0) {
          lines.push({
            text: `[OK] Granted ${itemsGranted} item(s) across all types to Vault (Total: ${data.vaultCount}/${VAULT_MAX_SLOTS})`,
            type: 'output',
          });
        }
        if (vaultFull) {
          lines.push({
            text: `[INFO] Vault reached max capacity (${data.vaultCount}/${VAULT_MAX_SLOTS}). Stopped granting items.`,
            type: 'output',
          });
        }
        lines.push({
          text: `[OK] Added ${scrapAdded} Scrap and ${fluxAdded} Flux to Wallet (Scrap: ${data.wallet.scrap}, Flux: ${data.wallet.flux})`,
          type: 'output',
        });
        setHistory((prev) => [...prev, ...lines]);
        return data;
      } else {
        const err = await response.json().catch(() => ({}));
        setHistory((prev) => [
          ...prev,
          { text: `[ERROR] Grant failed: ${err.error || response.statusText}`, type: 'error' },
        ]);
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          text: `[ERROR] Network error executing grant: ${err instanceof Error ? err.message : String(err)}`,
          type: 'error',
        },
      ]);
    }
  };

  const parseCommand = async (cmdStr: string) => {
    const args = cmdStr.split(' ');
    const cmd = args[0].toLowerCase();

    try {
      switch (cmd) {
        case '/grantall':
        case '/grant-all':
        case '/seedvault':
        case '/seed-vault':
        case '/debug-vault':
        case '/grant': {
          await executeGrantAll();
          break;
        }
        case '/heat':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /heat requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.setHeat(Number(args[1]) || 0);
          break;
        case '/panic':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /panic requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.triggerPanic(
            Number(args[1]) || 1,
            args[2] || 'low',
            args.slice(3).join(' ') || 'Manual Panic',
          );
          break;
        case '/hp':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /hp requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.setHp(Number(args[1]) || 100);
          break;
        case '/stability':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /stability requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.setStability(Number(args[1]) || 100);
          break;
        case '/status':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /status requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.status(args[1] || 'burning', Number(args[2]) || 5);
          break;
        case '/give':
          if (args[1] === 'vault' || args[1] === 'all') {
            await executeGrantAll();
          } else if (window.__DEBUG__) {
            if (args[1] === 'scrap') window.__DEBUG__.giveScrap(Number(args[2]) || 100);
            else if (args[1] === 'flux') window.__DEBUG__.giveFlux(Number(args[2]) || 10);
            else if (args[1] === 'blueprint') window.__DEBUG__.giveBlueprint(args[2]);
          } else {
            setHistory((prev) => [
              ...prev,
              {
                text: '[WARN] In-run /give [scrap|flux|blueprint] requires an active run session. Use /grant-all for persistent vault & currencies.',
                type: 'error',
              },
            ]);
          }
          break;
        case '/descend':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /descend requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.descend(Number(args[1]) || 1);
          break;
        case '/deadzone':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /deadzone requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.deadzone();
          break;
        case '/clearsessions':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /clearsessions requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.clearSessions();
          break;
        case '/show-map':
        case '/showmap':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /show-map requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.showMap();
          setHistory((prev) => [
            ...prev,
            { text: '[OK] Floor map fully exposed and fog of war cleared.', type: 'output' },
          ]);
          break;
        case '/debug-ai':
        case '/debugai':
          if (!window.__DEBUG__) {
            setHistory((prev) => [
              ...prev,
              { text: '[WARN] /debug-ai requires an active run session.', type: 'error' },
            ]);
            break;
          }
          window.__DEBUG__.debugAI(args[1]);
          setHistory((prev) => [
            ...prev,
            {
              text: `[OK] AI Debug telemetry toggled (${args[1] || 'approach_target'}). Use /debug-ai [approach_target|flee_from_target|kite_to_cover|pack_surround_cardinal]`,
              type: 'output',
            },
          ]);
          break;
        case '/perf': {
          const sub = args[1]?.toLowerCase();
          const store = usePerfStore.getState();
          if (!sub || sub === 'toggle') {
            store.toggleMode();
            setHistory((prev) => [
              ...prev,
              { text: `[OK] Performance monitor mode: ${usePerfStore.getState().mode}`, type: 'output' },
            ]);
          } else if (sub === 'mini') {
            store.setMode('MINI');
            setHistory((prev) => [...prev, { text: '[OK] Performance monitor set to MINI mode', type: 'output' }]);
          } else if (sub === 'standard') {
            store.setMode('STANDARD');
            setHistory((prev) => [...prev, { text: '[OK] Performance monitor set to STANDARD mode', type: 'output' }]);
          } else if (sub === 'full' || sub === 'expanded') {
            store.setMode('EXPANDED');
            setHistory((prev) => [...prev, { text: '[OK] Performance monitor set to EXPANDED mode', type: 'output' }]);
          } else if (sub === 'off') {
            store.setMode('OFF');
            setHistory((prev) => [...prev, { text: '[OK] Performance monitor disabled (OFF)', type: 'output' }]);
          } else if (sub === 'ghost') {
            store.toggleGhost();
            setHistory((prev) => [
              ...prev,
              { text: `[OK] Performance monitor Ghost mode: ${usePerfStore.getState().ghostMode ? 'ON' : 'OFF'}`, type: 'output' },
            ]);
          } else if (sub === 'snap' || sub === 'snapshot') {
            const snap = perfCollector.captureCurrentSnapshot();
            perfCollector.takeBaselineSnapshot(snap);
            setHistory((prev) => [
              ...prev,
              {
                text: `[OK] Baseline snapshot captured for floor ${snap.floor} (${snap.entityCount} entities, ${(snap.vramBytes / (1024 * 1024)).toFixed(1)}MB VRAM)`,
                type: 'output',
              },
            ]);
          } else if (sub === 'export') {
            const jsonStr = perfCollector.generateReportJson();
            if (typeof window !== 'undefined') {
              const blob = new Blob([jsonStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `nirmata-perf-telemetry-${Date.now()}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
            setHistory((prev) => [...prev, { text: '[OK] Performance telemetry JSON report downloaded', type: 'output' }]);
          } else {
            setHistory((prev) => [
              ...prev,
              { text: '[ERROR] Unknown /perf subcommand. Use: /perf [toggle|mini|standard|full|off|ghost|snap|export]', type: 'error' },
            ]);
          }
          break;
        }
        case '/close':
          setIsVisible(false);
          break;
        case '/list':
          setHistory((prev) => [
            ...prev,
            { text: 'AVAILABLE COMMANDS:', type: 'output' },
            {
              text: '  /grant-all (or /seedvault) - Gives 1 of every item type to vault (up to max slots) + 1000 of every currency',
              type: 'output',
            },
            { text: '  /heat [amount] - Set player heat', type: 'output' },
            {
              text: '  /panic [tier] [severity] [effect] - Trigger manual kernel panic',
              type: 'output',
            },
            { text: '  /hp [amount] - Set player health', type: 'output' },
            { text: '  /stability [amount] - Set player stability', type: 'output' },
            { text: '  /status [effect] [duration] - Apply status effect', type: 'output' },
            {
              text: '  /give [scrap|flux|blueprint|vault] [amount|id] - Grant currency or items',
              type: 'output',
            },
            {
              text: '  /descend [count] - Force floor transition (descends [count] floors)',
              type: 'output',
            },
            { text: '  /deadzone - Spawn deadzone at player position', type: 'output' },
            { text: '  /show-map - Reveal the entire floor map and clear fog of war', type: 'output' },
            { text: '  /debug-ai [mapType] - Toggle AI Dijkstra heatmap and telemetry overlay', type: 'output' },
            { text: '  /perf [toggle|mini|standard|full|off|ghost|snap|export] - Telemetry oscilloscope controls', type: 'output' },
            { text: '  /clearsessions - Clear all server sessions', type: 'output' },
            { text: '  /close - Close this terminal', type: 'output' },
            { text: '  /list - Show this list', type: 'output' },
          ]);
          break;
        default:
          setHistory((prev) => [
            ...prev,
            { text: `Unknown command: ${cmd}`, type: 'error' },
            { text: 'Type /list to see available commands.', type: 'output' },
          ]);
      }
    } catch (err) {
      logger.error('[DevTerminal] Error executing command:', 'UI', err);
      setHistory((prev) => [
        ...prev,
        { text: `EXEC_ERROR: ${err instanceof Error ? err.message : String(err)}`, type: 'error' },
      ]);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="dev-terminal-overlay">
      <div className="dev-terminal-backdrop" onClick={() => setIsVisible(false)} />

      <div className="dev-terminal-modal">
        {/* Header */}
        <div className="dev-terminal-header">
          <span>NIRMATA_RUN // AUTH_DEBUG_TERMINAL</span>
          <span>ESC OR ` TO CLOSE</span>
        </div>

        {/* Content Area */}
        <div className="dev-terminal-content">
          {/* History Scrollback */}
          <div className="dev-terminal-history">
            {history.length === 0 ? (
              <div style={{ color: 'rgba(0, 255, 65, 0.3)', fontStyle: 'italic' }}>
                No command history in current session...
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className={`dev-terminal-history-item type-${h.type}`}>
                  <span className="dev-terminal-history-index">
                    [{i.toString().padStart(3, '0')}]
                  </span>
                  <span className="dev-terminal-command">
                    {h.type === 'command' ? '> ' : ''}
                    {h.text}
                  </span>
                </div>
              ))
            )}
            <div ref={(el) => el?.scrollIntoView?.({ behavior: 'smooth' })} />
          </div>

          {/* Input Area */}
          <div className="dev-terminal-input-container">
            <span className="dev-terminal-prompt">&gt;</span>
            <form onSubmit={handleSubmit} style={{ flex: 1 }}>
              <input
                id="dev-console"
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="dev-terminal-input"
                placeholder="ENTER COMMAND (e.g. /list, /heat 100, /hp 50...)"
                autoComplete="off"
                spellCheck="false"
              />
            </form>
          </div>

          <div className="dev-terminal-footer">
            <span>
              SESSION_ID: {window.localStorage?.getItem('nimrata_sessionId')?.slice(0, 8) || 'ANON'}
            </span>
            <span>SYSTEM_READY: OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
