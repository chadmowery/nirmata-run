import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, SCRAP_PER_FLUX } from '../compress/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { createDefaultProfile } from '@/shared/profile';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

describe('POST /api/economy/compress', () => {
  const sessionId = 'test-compress-session';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compresses 100 scrap into 1 flux', async () => {
    const profile = createDefaultProfile(sessionId);
    profile.wallet.scrap = 350;
    profile.wallet.flux = 10;
    (profileRepository.load as any).mockResolvedValue(profile);

    const req = new Request('http://localhost/api/economy/compress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, amount: 1 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.scrapCost).toBe(SCRAP_PER_FLUX);
    expect(data.fluxGained).toBe(1);
    expect(data.wallet.scrap).toBe(250);
    expect(data.wallet.flux).toBe(11);
    expect(profileRepository.save).toHaveBeenCalledTimes(1);
  });

  it('fails if scrap is insufficient', async () => {
    const profile = createDefaultProfile(sessionId);
    profile.wallet.scrap = 80;
    profile.wallet.flux = 10;
    (profileRepository.load as any).mockResolvedValue(profile);

    const req = new Request('http://localhost/api/economy/compress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, amount: 1 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Insufficient Scrap');
    expect(profileRepository.save).not.toHaveBeenCalled();
  });

  it('fails if flux is at cap', async () => {
    const profile = createDefaultProfile(sessionId);
    profile.wallet.scrap = 500;
    profile.wallet.flux = 1000;
    (profileRepository.load as any).mockResolvedValue(profile);

    const req = new Request('http://localhost/api/economy/compress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, amount: 1 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('Flux Cap Reached');
    expect(profileRepository.save).not.toHaveBeenCalled();
  });
});
