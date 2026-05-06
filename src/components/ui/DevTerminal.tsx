import React, { useState, useEffect, useRef } from 'react';

export function DevTerminal() {
  const [isVisible, setIsVisible] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on backtick
      if (e.key === '`') {
        e.preventDefault();
        setIsVisible(prev => !prev);
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
    setHistory(prev => [...prev, cmd]);
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
          window.__DEBUG__.descend();
          break;
        case '/deadzone':
          window.__DEBUG__.deadzone();
          break;
        case '/close':
          setIsVisible(false);
          break;
        default:
          console.warn(`[DevTerminal] Unknown command: ${cmd}`);
      }
    } catch (err) {
      console.error('[DevTerminal] Error executing command:', err);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute top-0 left-0 w-full bg-black/80 text-green-400 p-2 font-mono z-50 border-b border-green-500/50 backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,0,0.2)]">
      <div className="text-xs text-green-500/70 mb-1 flex justify-between">
        <span>NIRMATA DEBUG TERMINAL v1.0</span>
        <span>Press ` to close</span>
      </div>
      <div className="max-h-32 overflow-y-auto mb-2 space-y-1 text-sm">
        {history.slice(-5).map((h, i) => (
          <div key={i} className="opacity-70">&gt; {h}</div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center">
        <span className="mr-2 font-bold">&gt;</span>
        <input
          id="dev-console"
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-green-400 placeholder-green-700/50"
          placeholder="e.g. /heat 100, /give scrap 50, /panic 2"
          autoComplete="off"
        />
      </form>
    </div>
  );
}
