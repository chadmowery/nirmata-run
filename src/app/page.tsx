'use client';

import { useRef, useEffect } from 'react';
import { createGame, destroyGame } from '@/game/setup';
import { loadAssets } from '@/rendering/assets';
import { initRenderer, destroyRenderer } from '@/rendering/renderer';
import { createRenderSystem } from '@/rendering/render-system';
import { createWorldContainer } from '@/rendering/layers';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import { HUDOverlay } from '@/components/ui/HUDOverlay';
import { MainMenu } from '@/components/ui/MainMenu';
import { GameOver } from '@/components/ui/GameOver';
import { GameContext } from '@/game/types';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<GameContext | null>(null);
  const status = useStore(gameStore, (s) => s.gameStatus);
  const isInitializing = useRef(false);

  useEffect(() => {
    // Only start engine if we are in Playing state and not already initialized
    if (status !== GameState.Playing || contextRef.current || !canvasRef.current || isInitializing.current) return;

    async function start() {
      isInitializing.current = true;
      try {
        console.log('--- STARTING ENGINE ---');
        // 1. Init PixiJS
        const app = await initRenderer(canvasRef.current!);
        await loadAssets();

        // 1.5 Get Session from Server
        const seed = `run-${Date.now()}`;
        const sessionResponse = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed,
            width: 80,
            height: 45
          })
        });

        let sessionId: string | undefined;
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          sessionId = sessionData.sessionId;
          console.log('[CLIENT] Server session initialized:', sessionId);
        } else {
          console.warn('[CLIENT] Failed to initialize server session. Falling back to local only.');
        }

        // 2. Init Game Engine
        const context = createGame({
          gridWidth: 80,
          gridHeight: 45,
          seed,
          sessionId
        });
        contextRef.current = context;
        // Expose for debugging
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).gameContext = context;

        // 3. Init Render System
        const layers = createWorldContainer();
        app.stage.addChild(layers.worldContainer);

        const renderSystem = createRenderSystem({
          app,
          layers,
          world: context.world,
          eventBus: context.eventBus,
          getGrid: () => context.grid,
          getPlayerEntity: () => context.playerId!,
          lightPasses: (x: number, y: number) => context.grid.isTransparent(x, y),
        });

        renderSystem.init();

        // Start rendering loop sync
        app.ticker.add(() => {
          renderSystem.renderSystem();
        });

        // 4. Start Game
        context.fsm.transition(GameState.Playing);

        // Focus management: ensure window is focused for input
        window.focus();
        console.log('--- ENGINE READY ---');
      } catch (error) {
        console.error('CRITICAL: Game initialization failed:', error);
      } finally {
        isInitializing.current = false;
      }
    }

    start();

    return () => {
      if (contextRef.current) {
        console.log('--- DESTROYING ENGINE ---');
        destroyGame(contextRef.current);
        contextRef.current = null;
      }
      destroyRenderer();
    };
  }, [status]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black font-mono">
      <div id="canvas-container">
        <canvas ref={canvasRef} className={status === GameState.Playing ? 'block' : 'hidden'} />
      </div>

      <div id="ui-root">
        {status === GameState.MainMenu && <MainMenu />}

        {status === GameState.Playing && <HUDOverlay />}

        {status === GameState.GameOver && <GameOver />}
      </div>
    </main>
  );
}
