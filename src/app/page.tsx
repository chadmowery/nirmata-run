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
import { RunMode } from '@/shared/run-mode';
import { HUDOverlay } from '@/components/ui/HUDOverlay';
import { MainMenu } from '@/components/ui/MainMenu';
import { AnchorOverlay } from '@/components/ui/AnchorOverlay';
import { StaircaseOverlay } from '@/components/ui/StaircaseOverlay';
import { BSODScreen } from '@/components/ui/BSODScreen';
import { RunResultsScreen } from '@/components/ui/RunResultsScreen';
import { HubLayout } from '@/components/ui/hub/HubLayout';
import { GameContext } from '@/game/types';
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from '@/shared/constants';

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
      const store = gameStore.getState();
      const launchConfig = store.launchConfig;
      
      // 1. Init PixiJS
      const app = await initRenderer(canvasRef.current!);
      await loadAssets();

      let seed: string;
      let sessionId: string | undefined;
      let runMode: RunMode | undefined;

      if (launchConfig) {
        // Use pre-configured launch data from the Hub (Initialize Ritual)
        seed = launchConfig.seed;
        sessionId = launchConfig.sessionId;
        runMode = launchConfig.mode;
        console.log('[CLIENT] Using Hub launch configuration:', launchConfig);
      } else {
        // Fallback for legacy/direct play
        seed = `run-${Date.now()}`;
        const sessionResponse = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed,
            width: DEFAULT_GRID_WIDTH,
            height: DEFAULT_GRID_HEIGHT
          })
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          sessionId = sessionData.sessionId;
          console.log('[CLIENT] Server session initialized:', sessionId);
        } else {
          console.warn('[CLIENT] Failed to initialize server session. Falling back to local only.');
        }
      }

      // 2. Init Game Engine
      const context = createGame({
        gridWidth: DEFAULT_GRID_WIDTH,
        gridHeight: DEFAULT_GRID_HEIGHT,
        seed,
        sessionId,
        runMode
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
        getPlayerEntity: () => contextRef.current?.playerId || 0,
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

  // Effect 2: Destroy engine when returning to MainMenu or Hub to ensure a fresh session next time
  useEffect(() => {
    if ((status === GameState.MainMenu || status === GameState.Hub) && contextRef.current) {
      console.log('--- DESTROYING ENGINE (RETURN TO HUB/MENU) ---');
      destroyGame(contextRef.current);
      contextRef.current = null;
      // Reset run-specific stats but keep walletScrap
      gameStore.getState().resetRunStats();
    }
  }, [status]);

  // Effect 3: Full cleanup on component unmount
  useEffect(() => {
    return () => {
      if (contextRef.current) {
        console.log('--- DESTROYING ENGINE (UNMOUNT) ---');
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
        {status === GameState.Hub && (
          <HubLayout
            onLaunchComplete={() => gameStore.getState().setGameStatus(GameState.Playing)}
          />
        )}

        {(status === GameState.Playing || status === GameState.Paused || status === GameState.GameOver) && (
          <>
            {(status === GameState.Playing || status === GameState.Paused) && <HUDOverlay />}
            {anchorOverlayVisible && <AnchorOverlay />}
            {staircaseOverlayVisible && <StaircaseOverlay />}
            {bsodVisible && <BSODScreen />}
            {runResultsVisible && <RunResultsScreen />}
          </>
        )}
      </div>
    </main>
  );
}
