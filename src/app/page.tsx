'use client';

import { useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createGame, destroyGame } from '@/game/setup';
import { loadAssets } from '@/rendering/assets';
import { initRenderer, destroyRenderer, getApp } from '@/rendering/renderer';
import { createRenderSystem } from '@/rendering/render-system';
import { createWorldContainer } from '@/rendering/layers';
import { createGameAudioSystem, GameAudioSystem } from '@/game/audio/game-audio-system';
import { getAudioEngine } from '@engine/audio';
import { getSoundCue, registerSoundCue } from '@/game/audio/cue-registry';
import { getAmbianceConfig, setAmbianceConfig } from '@/game/config/ambiance';
import { useStore } from 'zustand';
import { gameStore, getSavedAudioSettings } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import { RunMode } from '@/shared/run-mode';
import { logger } from '@engine/utils/logger';
import { HUDOverlay } from '@/components/ui/HUDOverlay';
import { MainMenu } from '@/components/ui/MainMenu';
import { AnchorOverlay } from '@/components/ui/AnchorOverlay';
import { StaircaseOverlay } from '@/components/ui/StaircaseOverlay';
import { BSODScreen } from '@/components/ui/BSODScreen';
import { RunResultsScreen } from '@/components/ui/RunResultsScreen';
import { AbortMissionDialog } from '@/components/ui/AbortMissionDialog';
import { SystemSettingsModal } from '@/components/ui/SystemSettingsModal';
import { HubLayout } from '@/components/ui/hub/HubLayout';
import { GameContext } from '@/game/types';
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, DEFAULT_SHELL_ID } from '@/shared/constants';

const DevTerminal = dynamic(
  () => import('@dev-tool/terminal/DevTerminal').then((m) => m.DevTerminal),
  { ssr: false },
);

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<GameContext | null>(null);
  const status = useStore(gameStore, (s) => s.gameStatus);
  const anchorOverlayVisible = useStore(gameStore, (s) => s.anchorOverlayVisible);
  const staircaseOverlayVisible = useStore(gameStore, (s) => s.staircaseOverlayVisible);
  const bsodVisible = useStore(gameStore, (s) => s.bsodVisible);
  const runResultsVisible = useStore(gameStore, (s) => s.runResultsVisible);
  const abortDialogVisible = useStore(gameStore, (s) => s.abortDialogVisible);
  const isInitializing = useRef(false);
  const renderSystemRef = useRef<ReturnType<typeof createRenderSystem> | null>(null);
  const gameAudioSystemRef = useRef<GameAudioSystem | null>(null);
  const tickerCallbackRef = useRef<(() => void) | null>(null);

  const showCanvas =
    status === GameState.Playing || status === GameState.Paused || status === GameState.GameOver;

  // Separate initialization logic into a named function
  async function start() {
    if (!canvasRef.current || isInitializing.current || contextRef.current) return;

    isInitializing.current = true;
    try {
      logger.info('--- STARTING ENGINE ---', 'SYSTEM');
      const store = gameStore.getState();
      const launchConfig = store.launchConfig;

      // 1. Init PixiJS
      const app = await initRenderer(canvasRef.current!);
      await loadAssets();

      let seed: string;
      let sessionId: string | undefined;
      let runMode: RunMode | undefined;
      let shellId: string | undefined;
      let initialState = launchConfig?.initialState;

      const fallbackShellId = store.shellTemplates[store.selectedShellIndex]?.id || DEFAULT_SHELL_ID;

      if (launchConfig) {
        // Use pre-configured launch data from the Hub (Initialize Ritual)
        seed = launchConfig.seed;
        sessionId = launchConfig.sessionId;
        runMode = launchConfig.mode;
        shellId = launchConfig.shellId || fallbackShellId;
        logger.info(`Using Hub launch configuration: ${JSON.stringify(launchConfig)}`, 'NETWORK');
      } else {
        // Fallback for legacy/direct play
        shellId = fallbackShellId || DEFAULT_SHELL_ID;
        seed = `run-${Date.now()}`;
        const sessionResponse = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed,
            width: DEFAULT_GRID_WIDTH,
            height: DEFAULT_GRID_HEIGHT,
            shellId,
          }),
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          sessionId = sessionData.sessionId;
          initialState = sessionData.initialState;
          if (typeof window !== 'undefined' && sessionId) {
            window.localStorage?.setItem('nimrata_sessionId', sessionId);
          }
          logger.info(`Server session initialized: ${sessionId}`, 'NETWORK');
        } else {
          logger.warn(
            'Failed to initialize server session. Falling back to local only.',
            'NETWORK',
          );
        }
      }

      // 2. Init Game Engine
      const context = createGame({
        gridWidth: DEFAULT_GRID_WIDTH,
        gridHeight: DEFAULT_GRID_HEIGHT,
        seed,
        sessionId,
        runMode,
        shellId,
        profile: store.playerProfile || undefined,
        initialState,
      });
      contextRef.current = context;

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
      renderSystemRef.current = renderSystem;

      // Start rendering loop sync
      const tickerCallback = () => {
        renderSystem.renderSystem();
      };
      app.ticker.add(tickerCallback);
      tickerCallbackRef.current = tickerCallback;

      // 4. Init Audio System
      const gameAudioSystem = createGameAudioSystem({
        world: context.world,
        eventBus: context.eventBus,
        getPlayerEntity: () => contextRef.current?.playerId || 0,
        getGrid: () => context.grid,
      });
      gameAudioSystemRef.current = gameAudioSystem;
      gameAudioSystem.updateAmbianceForFloor(1);

      // 5. Start Game
      context.fsm.transition(GameState.Playing);

      // Focus management: ensure window is focused for input
      window.focus();
      logger.info('--- ENGINE READY ---', 'SYSTEM');
    } catch (error) {
      logger.error('CRITICAL: Game initialization failed', 'SYSTEM', { error });
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
      logger.info('--- DESTROYING ENGINE (RETURN TO HUB/MENU) ---', 'SYSTEM');

      // 1. Cleanup Render System
      if (renderSystemRef.current) {
        renderSystemRef.current.destroy();
        renderSystemRef.current = null;
      }

      // 2. Cleanup Audio System
      if (gameAudioSystemRef.current) {
        gameAudioSystemRef.current.destroy();
        gameAudioSystemRef.current = null;
      }

      // 3. Cleanup Ticker
      const app = getApp();
      if (app && tickerCallbackRef.current) {
        app.ticker.remove(tickerCallbackRef.current);
        tickerCallbackRef.current = null;

        // 3. Clear Stage - Important to remove the worldContainer
        app.stage.removeChildren();
      }

      // 4. Cleanup Game Engine
      destroyGame(contextRef.current);
      contextRef.current = null;

      // Reset run-specific stats but keep walletScrap
      gameStore.getState().resetRunStats();
      if (process.env.NODE_ENV === 'development') {
        import('@dev-tool/debug/debug-store').then(({ useDebugStore }) => {
          useDebugStore.getState().clearTimeline();
        });
      }
    }
  }, [status]);

  // Effect 0: Synchronize persisted audio settings into AudioEngine on mount
  useEffect(() => {
    const saved = getSavedAudioSettings();
    getAudioEngine().updateSettings(saved);
  }, []);

  // Effect 3: Full cleanup on component unmount
  useEffect(() => {
    return () => {
      logger.info('--- DESTROYING ENGINE (UNMOUNT) ---', 'SYSTEM');
      if (renderSystemRef.current) {
        renderSystemRef.current.destroy();
        renderSystemRef.current = null;
      }
      if (gameAudioSystemRef.current) {
        gameAudioSystemRef.current.destroy();
        gameAudioSystemRef.current = null;
      }
      if (contextRef.current) {
        destroyGame(contextRef.current);
        contextRef.current = null;
      }
      destroyRenderer();
      getAudioEngine().destroy();
    };
  }, []);

  // Effect 4: Background ambiance for MainMenu and Hub
  useEffect(() => {
    if (status !== GameState.MainMenu && status !== GameState.Hub) {
      return;
    }

    const engine = getAudioEngine();
    // Reset ambiance DSP state when entering MainMenu or Hub to avoid stuck low-pass or distortion
    engine.setAmbianceState({
      heatTier: 0,
      sectorCondition: null,
      isAnchorDucked: false,
      isPaused: false,
      cutoffMultiplier: 1.0,
      resonanceQ: 1.0,
    });

    const clientEngine = engine;

    const syncAndPlay = async () => {
      if (process.env.NODE_ENV === 'development') {
        try {
          const [configRes, cuesRes] = await Promise.all([
            fetch('/api/dev/gamedata/configs/ambiance').catch(() => null),
            fetch('/api/dev/gamedata/audio-cues').catch(() => null),
          ]);
          if (configRes && configRes.ok) {
            const config = await configRes.json();
            setAmbianceConfig(config);
          }
          if (cuesRes && cuesRes.ok) {
            const cuesData = await cuesRes.json();
            if (Array.isArray(cuesData.cues)) {
              for (const c of cuesData.cues) {
                registerSoundCue(c);
              }
            }
          }
        } catch {
          // Safe fallback to bundled config
        }
      }

      const ambianceConfig = getAmbianceConfig();

      if (status === GameState.MainMenu) {
        const cueId = ambianceConfig.scenes.mainMenu?.cueId || 'amb_main_menu';
        const cue = getSoundCue(cueId);
        if (cue) clientEngine.playAmbianceCue(cue);
      } else if (status === GameState.Hub) {
        const cueId = ambianceConfig.scenes.hub?.cueId || 'amb_hub_deck';
        const cue = getSoundCue(cueId);
        if (cue) clientEngine.playAmbianceCue(cue);
      }
    };

    syncAndPlay();
  }, [status]);

  // Effect 4b: Ambiance ducking when gameStatus enters or leaves Paused state
  useEffect(() => {
    if (status === GameState.Paused) {
      getAudioEngine().setAmbianceState({ isPaused: true });
    } else if (status === GameState.Playing) {
      getAudioEngine().setAmbianceState({ isPaused: false });
    }
  }, [status]);

  // Effect 5: Autoplay unlock on first user gesture
  useEffect(() => {
    const unlock = () => {
      const engine = getAudioEngine();
      engine.init();
      engine.resume?.();
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
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

        {(status === GameState.Playing ||
          status === GameState.Paused ||
          status === GameState.GameOver) && (
          <>
            {(status === GameState.Playing || status === GameState.Paused) && <HUDOverlay />}
            {anchorOverlayVisible && <AnchorOverlay />}
            {staircaseOverlayVisible && <StaircaseOverlay />}
            {abortDialogVisible && <AbortMissionDialog />}
            {bsodVisible && <BSODScreen />}
            {runResultsVisible && <RunResultsScreen />}
          </>
        )}

        <SystemSettingsModal />

        {process.env.NODE_ENV === 'development' && <DevTerminal />}
      </div>
    </main>
  );
}
