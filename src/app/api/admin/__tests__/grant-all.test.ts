import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST } from '../grant-all/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { createDefaultProfile } from '@/shared/profile';
import { VAULT_MAX_SLOTS } from '@/shared/vault';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

describe('POST /api/admin/grant-all', () => {
  const sessionId = 'test-grant-all-session';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks in production environment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = new Request('http://localhost/api/admin/grant-all', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('populates vault up to capacity and gives 1000 of every currency', async () => {
    const mockProfile = createDefaultProfile(sessionId);
    mockProfile.wallet.scrap = 50;
    mockProfile.wallet.flux = 5;

    (profileRepository.load as any).mockResolvedValue(mockProfile);

    const req = new Request('http://localhost/api/admin/grant-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.itemsGranted).toBe(VAULT_MAX_SLOTS);
    expect(data.vaultCount).toBe(VAULT_MAX_SLOTS);
    expect(data.wallet.scrap).toBe(1050);
    expect(data.wallet.flux).toBe(1005);
    expect(profileRepository.save).toHaveBeenCalledTimes(1);
  });

  it('stops granting items when vault is already full, but still grants 1000 of every currency', async () => {
    const mockProfile = createDefaultProfile(sessionId);
    for (let i = 0; i < VAULT_MAX_SLOTS; i++) {
      mockProfile.vault.push({
        entityId: 900 + i,
        templateId: 'item',
        rarityTier: 'common',
        itemType: 'software',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now(),
      });
    }
    mockProfile.wallet.scrap = 100;
    mockProfile.wallet.flux = 20;

    (profileRepository.load as any).mockResolvedValue(mockProfile);

    const req = new Request('http://localhost/api/admin/grant-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.itemsGranted).toBe(0);
    expect(data.result.vaultFull).toBe(true);
    expect(data.vaultCount).toBe(VAULT_MAX_SLOTS);
    expect(data.wallet.scrap).toBe(1100);
    expect(data.wallet.flux).toBe(1020);
    expect(profileRepository.save).toHaveBeenCalledTimes(1);
  });
});
