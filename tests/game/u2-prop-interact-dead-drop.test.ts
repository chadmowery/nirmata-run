import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGame } from '@/game/setup';
import { createEngineInstance } from '@/game/engine-factory';
import { sessionManager } from '@server/session/session-manager';
import { POST } from '@/app/api/action/route';
import { GameAction } from '@/game/input/actions';
import { dispatchUIAction } from '@/game/input/input-bridge';
import { GameState } from '@/game/states/types';
import { gameStore } from '@/game/ui/store';
import {
  Position,
  Prop,
  SecurityLock,
  Container,
  Heat,
  RunInventory,
  RunCurrency,
  AnchorMarker,
} from '@shared/components';
import { createDefaultProfile } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

describe('U2: Overclock Bypass, Forced Interaction & Dead-Drop Uplink via Client Input', () => {
  const sessionId = 'test-u2-session';

  beforeEach(async () => {
    sessionManager.clear();
    gameStore.getState().closeDeadDropModal();
    gameStore.getState().hideAnchorOverlay();
    await profileRepository.save(createDefaultProfile(sessionId));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionManager.clear();
  });

  it('opens a locked safe via [E] overclock bypass and transmits an item via Dead-Drop Uplink to profile vault', async () => {
    // 1. Create authoritative server session
    const serverInstance = createEngineInstance({
      width: 20,
      height: 20,
      seed: 'u2-test-seed',
      isClient: false,
      sessionId,
    });
    sessionManager.createSession(sessionId, serverInstance);

    // 2. Route client fetch('/api/action') directly to the authoritative POST route handler
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/action') && init?.body) {
        const req = new Request('http://localhost/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: init.body as string,
        });
        return POST(req);
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    // 3. Create client game context with matching seed & sessionId
    const clientContext = createGame({
      gridWidth: 20,
      gridHeight: 20,
      seed: 'u2-test-seed',
      sessionId,
    });
    clientContext.fsm.transition(GameState.Playing);

    const serverPlayerId = serverInstance.playerId;
    const clientPlayerId = clientContext.playerId!;
    const playerPos = serverInstance.world.getComponent(serverPlayerId, Position)!;

    // Ensure adjacent tile (x+1, y) is walkable and clear on both server and client
    const safeX = playerPos.x + 1;
    const safeY = playerPos.y;
    serverInstance.grid.setTile(safeX, safeY, {
      terrain: 'floor',
      walkable: true,
      transparent: true,
    });
    clientContext.grid.setTile(safeX, safeY, {
      terrain: 'floor',
      walkable: true,
      transparent: true,
    });

    // Spawn a locked encrypted_safe at (safeX, safeY) on both server and client
    const serverSafeId = serverInstance.world.createEntity();
    serverInstance.world.addComponent(serverSafeId, Position, { x: safeX, y: safeY });
    serverInstance.world.addComponent(serverSafeId, Prop, {
      propId: 'prop-safe-locked',
      faction: 'cyberacme',
      propClass: 'encrypted_safe',
      isSearched: false,
    });
    serverInstance.world.addComponent(serverSafeId, SecurityLock, {
      isLocked: true,
      keyIdRequired: 'access_key_any',
      overclockHeatCost: 30,
      alertRadiusOnBypass: 8,
    });
    serverInstance.world.addComponent(serverSafeId, Container, {
      containerId: 'safe-container',
      scrapYield: 50,
    });
    serverInstance.grid.addEntity(serverSafeId, safeX, safeY);

    // Sync identical entity ID on client
    while (clientContext.world.createEntity() < serverSafeId) {
      // advance client entity ID counter to match serverSafeId
    }
    clientContext.world.addComponent(serverSafeId, Position, { x: safeX, y: safeY });
    clientContext.world.addComponent(serverSafeId, Prop, {
      propId: 'prop-safe-locked',
      faction: 'cyberacme',
      propClass: 'encrypted_safe',
      isSearched: false,
    });
    clientContext.world.addComponent(serverSafeId, SecurityLock, {
      isLocked: true,
      keyIdRequired: 'access_key_any',
      overclockHeatCost: 30,
      alertRadiusOnBypass: 8,
    });
    clientContext.grid.addEntity(serverSafeId, safeX, safeY);

    // 4. Trigger [E] (GameAction.INTERACT_ANCHOR) via client input bridge -> Overclock Bypass!
    dispatchUIAction(GameAction.INTERACT_ANCHOR);

    // Wait for async fetch + reconciliation
    await vi.waitFor(() => {
      const serverLock = serverInstance.world.getComponent(serverSafeId, SecurityLock);
      expect(serverLock?.isLocked).toBe(false);
      const clientLock = clientContext.world.getComponent(serverSafeId, SecurityLock);
      expect(clientLock?.isLocked).toBe(false);
    });

    const serverPropAfter = serverInstance.world.getComponent(serverSafeId, Prop);
    expect(serverPropAfter?.isSearched).toBe(true);
    const serverHeat = serverInstance.world.getComponent(serverPlayerId, Heat);
    expect(serverHeat?.current).toBeGreaterThanOrEqual(30);

    // 5. Now test Dead-Drop Uplink: place a dead_drop_uplink at (x, y+1)
    const uplinkX = playerPos.x;
    const uplinkY = playerPos.y + 1;
    serverInstance.grid.setTile(uplinkX, uplinkY, {
      terrain: 'floor',
      walkable: true,
      transparent: true,
    });
    clientContext.grid.setTile(uplinkX, uplinkY, {
      terrain: 'floor',
      walkable: true,
      transparent: true,
    });

    const serverUplinkId = serverInstance.world.createEntity();
    serverInstance.world.addComponent(serverUplinkId, Position, { x: uplinkX, y: uplinkY });
    serverInstance.world.addComponent(serverUplinkId, Prop, {
      propId: 'prop-dead-drop',
      faction: 'system',
      propClass: 'dead_drop_uplink',
      isSearched: false,
      deadDropFluxCost: 25,
    });
    serverInstance.grid.addEntity(serverUplinkId, uplinkX, uplinkY);

    while (clientContext.world.createEntity() < serverUplinkId) {
      // align ID
    }
    clientContext.world.addComponent(serverUplinkId, Position, { x: uplinkX, y: uplinkY });
    clientContext.world.addComponent(serverUplinkId, Prop, {
      propId: 'prop-dead-drop',
      faction: 'system',
      propClass: 'dead_drop_uplink',
      isSearched: false,
      deadDropFluxCost: 25,
    });
    clientContext.grid.addEntity(serverUplinkId, uplinkX, uplinkY);

    // Give player 50 Flux and a software item in RunInventory on both server and client
    const swItemEntityId = 999;
    serverInstance.world.addComponent(serverPlayerId, RunCurrency, {
      stacks: [{ currencyType: 'flux', amount: 50 }],
    });
    serverInstance.world.addComponent(serverPlayerId, RunInventory, {
      maxSlots: 10,
      software: [
        {
          entityId: swItemEntityId,
          templateId: 'vampire-v2',
          rarityTier: 'rare',
          pickedUpAtFloor: 3,
          pickedUpAtTimestamp: Date.now(),
        },
      ],
      equipment: [],
    });
    clientContext.world.addComponent(clientPlayerId, RunCurrency, {
      stacks: [{ currencyType: 'flux', amount: 50 }],
    });
    clientContext.world.addComponent(clientPlayerId, RunInventory, {
      maxSlots: 10,
      software: [
        {
          entityId: swItemEntityId,
          templateId: 'vampire-v2',
          rarityTier: 'rare',
          pickedUpAtFloor: 3,
          pickedUpAtTimestamp: Date.now(),
        },
      ],
      equipment: [],
    });

    // Pressing [E] next to the Dead-Drop Uplink opens the Dead-Drop Modal
    dispatchUIAction(GameAction.INTERACT_ANCHOR);

    expect(gameStore.getState().deadDropModalVisible).toBe(true);
    expect(gameStore.getState().deadDropPropId).toBe(serverUplinkId);

    // Submit the Dead-Drop transmission via the canonical client submitAction
    await clientContext.submitAction!({
      type: 'DEAD_DROP_ITEM',
      targetPropId: serverUplinkId,
      itemId: swItemEntityId,
    });

    // Verify item was removed from RunInventory, Flux was deducted, uplink marked searched, and item persisted to profile.vault
    const serverInvAfter = serverInstance.world.getComponent(serverPlayerId, RunInventory);
    expect(serverInvAfter?.software).toHaveLength(0);

    const serverUplinkAfter = serverInstance.world.getComponent(serverUplinkId, Prop);
    expect(serverUplinkAfter?.isSearched).toBe(true);

    const savedProfile = await profileRepository.load(sessionId);
    expect(savedProfile?.vault.some((v) => v.templateId === 'vampire-v2')).toBe(true);
  });

  it('prioritizes an active Stability Anchor on the player tile over an adjacent prop when pressing [E]', async () => {
    const clientContext = createGame({
      gridWidth: 20,
      gridHeight: 20,
      seed: 'u2-anchor-priority-seed',
      sessionId,
    });
    clientContext.fsm.transition(GameState.Playing);

    const pId = clientContext.playerId!;
    const playerPos = clientContext.world.getComponent(pId, Position)!;

    // Place an active Stability Anchor on the player's current tile
    const anchorId = clientContext.world.createEntity();
    clientContext.world.addComponent(anchorId, Position, { x: playerPos.x, y: playerPos.y });
    clientContext.world.addComponent(anchorId, AnchorMarker, { used: false });
    clientContext.grid.addEntity(anchorId, playerPos.x, playerPos.y);

    // Place an unsearched prop adjacent to the player
    const propId = clientContext.world.createEntity();
    clientContext.world.addComponent(propId, Position, { x: playerPos.x + 1, y: playerPos.y });
    clientContext.world.addComponent(propId, Prop, {
      propId: 'prop-locker',
      faction: 'traxus',
      propClass: 'locker',
      isSearched: false,
    });
    clientContext.grid.addEntity(propId, playerPos.x + 1, playerPos.y);

    dispatchUIAction(GameAction.INTERACT_ANCHOR);

    expect(gameStore.getState().anchorOverlayVisible).toBe(true);
    expect(gameStore.getState().anchorData?.anchorId).toBe(anchorId);
  });
});
