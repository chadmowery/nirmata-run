import React, { useState, useEffect, useRef } from 'react';

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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on backtick (without shift)
      if (e.key === '`' && !e.shiftKey) {
        e.preventDefault();
        setIsVisible(prev => !prev);
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
    setHistory(prev => [...prev, { text: cmd, type: 'command' }]);
    setInput('');
    
    parseCommand(cmd);
  };

  const parseCommand = (cmdStr: string) => {
    if (!window.__DEBUG__) {
      console.warn('[DevTerminal] window.__DEBUG__ is not available.');
      return;
    }

    const args = cmdStr.split(' ');
    const cmd = args[0].toLowerCase();

    try {
      switch (cmd) {
        case '/heat':
          window.__DEBUG__.setHeat(Number(args[1]) || 0);
          break;
        case '/panic':
          window.__DEBUG__.triggerPanic(
            Number(args[1]) || 1,
            args[2] || 'low',
            args.slice(3).join(' ') || 'Manual Panic'
          );
          break;
        case '/hp':
          window.__DEBUG__.setHp(Number(args[1]) || 100);
          break;
        case '/stability':
          window.__DEBUG__.setStability(Number(args[1]) || 100);
          break;
        case '/status':
          window.__DEBUG__.status(args[1] || 'burning', Number(args[2]) || 5);
          break;
        case '/give':
          if (args[1] === 'scrap') window.__DEBUG__.giveScrap(Number(args[2]) || 100);
          else if (args[1] === 'flux') window.__DEBUG__.giveFlux(Number(args[2]) || 10);
          else if (args[1] === 'blueprint') window.__DEBUG__.giveBlueprint(args[2]);
          break;
        case '/descend':
          window.__DEBUG__.descend(Number(args[1]) || 1);
          break;
        case '/deadzone':
          window.__DEBUG__.deadzone();
          break;
        case '/clearsessions':
          window.__DEBUG__.clearSessions();
          break;
        case '/close':
          setIsVisible(false);
          break;
        case '/list':
          setHistory(prev => [
            ...prev,
            { text: 'AVAILABLE COMMANDS:', type: 'output' },
            { text: '  /heat [amount] - Set player heat', type: 'output' },
            { text: '  /panic [tier] [severity] [effect] - Trigger manual kernel panic', type: 'output' },
            { text: '  /hp [amount] - Set player health', type: 'output' },
            { text: '  /stability [amount] - Set player stability', type: 'output' },
            { text: '  /status [effect] [duration] - Apply status effect', type: 'output' },
            { text: '  /give [scrap|flux|blueprint] [amount|id] - Grant currency or items', type: 'output' },
            { text: '  /descend [count] - Force floor transition (descends [count] floors)', type: 'output' },
            { text: '  /deadzone - Spawn deadzone at player position', type: 'output' },
            { text: '  /clearsessions - Clear all server sessions', type: 'output' },
            { text: '  /close - Close this terminal', type: 'output' },
            { text: '  /list - Show this list', type: 'output' },
          ]);
          break;
        default:
          setHistory(prev => [
            ...prev,
            { text: `Unknown command: ${cmd}`, type: 'error' },
            { text: 'Type /list to see available commands.', type: 'output' }
          ]);
      }
    } catch (err) {
      console.error('[DevTerminal] Error executing command:', err);
      setHistory(prev => [...prev, { text: `EXEC_ERROR: ${err instanceof Error ? err.message : String(err)}`, type: 'error' }]);
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
                  <span className="dev-terminal-history-index">[{i.toString().padStart(3, '0')}]</span>
                  <span className="dev-terminal-command">
                    {h.type === 'command' ? '> ' : ''}
                    {h.text}
                  </span>
                </div>
              ))
            )}
            <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
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
            <span>SESSION_ID: {window.localStorage.getItem('nimrata_sessionId')?.slice(0,8) || 'ANON'}</span>
            <span>SYSTEM_READY: OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
