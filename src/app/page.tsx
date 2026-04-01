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
import { AnchorOverlay } from '@/components/ui/AnchorOverlay';
import { StaircaseOverlay } from '@/components/ui/StaircaseOverlay';
import { BSODScreen } from '@/components/ui/BSODScreen';
import { RunResultsScreen } from '@/components/ui/RunResultsScreen';
import { GameContext } from '@/game/types';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<GameContext | null>(null);
  const status = useStore(gameStore, (s) => s.gameStatus);
  const anchorOverlayVisible = useStore(gameStore, (s) => s.anchorOverlayVisible);
  const staircaseOverlayVisible = useStore(gameStore, (s) => s.staircaseOverlayVisible);
  const bsodVisible = useStore(gameStore, (s) => s.bsodVisible);
  const runResultsVisible = useStore(gameStore, (s) => s.runResultsVisible);
  const isInitializing = useRef(false);

  const showCanvas = status === GameState.Playing || status === GameState.Paused || status === GameState.GameOver;

  // Separate initialization logic into a named function
  async function start() {
    if (!canvasRef.current || isInitializing.current || contextRef.current) return;
    
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

  // Effect 1: Initialize engine when first reaching Playing state
  useEffect(() => {
    if (status === GameState.Playing && !contextRef.current && !isInitializing.current) {
      start();
    }
  }, [status]);

  // Effect 2: Cleanup only on component unmount
  useEffect(() => {
    return () => {
      if (contextRef.current) {
        console.log('--- DESTROYING ENGINE ---');
        destroyGame(contextRef.current);
        contextRef.current = null;
      }
      destroyRenderer();
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black font-mono">
      <div id="canvas-container">
        <canvas ref={canvasRef} className={showCanvas ? 'block' : 'hidden'} />
      </div>

      <div id="ui-root">
        {status === GameState.MainMenu && <MainMenu />}

        {(status === GameState.Playing || status === GameState.Paused) && (
          <>
            <HUDOverlay />
            {anchorOverlayVisible && <AnchorOverlay />}
            {staircaseOverlayVisible && <StaircaseOverlay />}
            {bsodVisible && <BSODScreen />}
            {runResultsVisible && <RunResultsScreen />}
          </>
        )}

        {status === GameState.GameOver && <GameOver />}
      </div>
    </main>
  );
}
