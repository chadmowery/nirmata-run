'use client';

import { useEffect, useRef } from 'react';
import { createGame } from '@/game/setup';
import { initRenderer, destroyRenderer } from '@/rendering/renderer';
import { createRenderSystem } from '@/rendering/render-system';
import { createWorldContainer } from '@/rendering/layers';
import { HUDOverlay } from '@/components/ui/HUDOverlay';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !canvasRef.current) return;
    initialized.current = true;

    async function start() {
      // 1. Init PixiJS
      const app = await initRenderer(canvasRef.current!);
      
      // 2. Init Game Engine
      const context = createGame({
        gridWidth: 80,
        gridHeight: 45,
        seed: 'dungeon-run-1'
      });

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
      context.fsm.transition('PLAYING');
    }

    start();

    return () => {
      destroyRenderer();
      initialized.current = false;
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      <div id="canvas-container">
        <canvas ref={canvasRef} />
      </div>
      <div id="ui-root">
        <HUDOverlay />
      </div>
    </main>
  );
}
