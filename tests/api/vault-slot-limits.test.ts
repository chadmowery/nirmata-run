import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as equipRoute } from '../../src/app/api/vault/equip-from-vault/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { globalShellRegistry } from '@/game/shells/server';
import { NextRequest } from 'next/server';

vi.mock('@/app/persistence/fs-profile-repository');

describe('Vault Equip Port Limit Enforcement (Phase 4)', () => {
  const sessionId = 'test-session';
  const shellId = 'vanguard-test';

  beforeEach(() => {
    vi.clearAllMocks();

    // Register a shell template with strict port limits: max 1 firmware, max 1 augment
    if (!globalShellRegistry.has(shellId)) {
      try {
        globalShellRegistry.createRecord(shellId, 'vanguard-v1');
      } catch {
        // Already created or using existing template
      }
    }

    const record = globalShellRegistry.get(shellId);
    if (record) {
      record.portConfig = {
        maxFirmware: 1,
        maxAugment: 1,
        maxSoftware: 2,
      };
    }
  });

  it('rejects equipping firmware when shell firmware port capacity is reached', async () => {
    vi.mocked(profileRepository.load).mockResolvedValue({
      sessionId,
      vault: [
        { entityId: 101, itemType: 'firmware', templateId: 'dash-v1' },
      ],
      installedItems: [
        { entityId: 1, type: 'firmware', shellId, blueprintId: 'overload-v1', isLegacy: false },
      ],
    } as any);

    const req = new NextRequest('http://localhost/api/vault/equip-from-vault', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        shellId,
        entityId: 101,
      }),
    });

    const res = await equipRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('Exceeded port capacity for firmware');
  });

  it('allows equipping when within port capacity limits', async () => {
    vi.mocked(profileRepository.load).mockResolvedValue({
      sessionId,
      vault: [
        { entityId: 102, itemType: 'augment', templateId: 'nanite-repair' },
      ],
      installedItems: [], // 0 augments installed, limit is 1
    } as any);

    const req = new NextRequest('http://localhost/api/vault/equip-from-vault', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        shellId,
        entityId: 102,
      }),
    });

    const res = await equipRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(profileRepository.save).toHaveBeenCalled();
  });
});
