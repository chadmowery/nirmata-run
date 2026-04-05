import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as launchRoute } from '../../../app/api/run-mode/launch/route';
import { POST as moveVaultRoute } from '../../../app/api/vault/move-to-vault/route';
import { createDefaultProfile } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { NextRequest } from 'next/server';

vi.mock('@/app/persistence/fs-profile-repository');
vi.mock('@/engine/session/SessionManager', () => ({
  sessionManager: {
    createSession: vi.fn()
  }
}));
vi.mock('@/game/engine-factory', () => ({
  createEngineInstance: vi.fn(() => ({
    world: {},
    grid: {},
    turnManager: {},
    eventBus: {},
    systems: {},
    playerId: 1
  }))
}));

describe('Run Lifecycle Integration', () => {
  const sessionId = 'test-session';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should go through launch -> extract (overflow) -> clear -> relaunch cycle', async () => {
    // 1. Initial State: Clean profile
    let profile = createDefaultProfile(sessionId);
    vi.mocked(profileRepository.load).mockImplementation(async (id) => {
      if (id === sessionId) return profile;
      return null;
    });
    vi.mocked(profileRepository.save).mockImplementation(async (p) => {
      profile = p;
    });

    // 2. Launch Run
    const launchReq = new NextRequest('http://localhost/api/run-mode/launch', {
      method: 'POST',
      body: JSON.stringify({ sessionId, mode: 'simulation' }),
    });
    const launchRes = await launchRoute(launchReq);
    expect(launchRes.status).toBe(200);

    // 3. Simulate Extraction with Overflow
    // (Manually update profile to simulate what RunEnder + Action API would do)
    profile.overflow.push({ entityId: 99 } as any);
    
    // 4. Try to launch AGAIN (should fail due to D-07 overflow block)
    const relaunchFailReq = new NextRequest('http://localhost/api/run-mode/launch', {
      method: 'POST',
      body: JSON.stringify({ sessionId, mode: 'simulation' }),
    });
    const relaunchFailRes = await launchRoute(relaunchFailReq);
    expect(relaunchFailRes.status).toBe(403);

    // 5. Move Overflow to Vault
    const moveReq = new NextRequest('http://localhost/api/vault/move-to-vault', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
    const moveRes = await moveVaultRoute(moveReq);
    expect(moveRes.status).toBe(200);
    const moveData = await moveRes.json();
    expect(moveData.moved).toBe(1);
    expect(profile.overflow.length).toBe(0);
    expect(profile.vault.length).toBe(1);

    // 6. Relaunch (should succeed now)
    const relaunchSuccessReq = new NextRequest('http://localhost/api/run-mode/launch', {
      method: 'POST',
      body: JSON.stringify({ sessionId, mode: 'simulation' }),
    });
    const relaunchSuccessRes = await launchRoute(relaunchSuccessReq);
    expect(relaunchSuccessRes.status).toBe(200);
  });
});
