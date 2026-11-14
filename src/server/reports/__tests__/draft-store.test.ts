import { describe, it, expect, beforeEach } from 'vitest';
import { DraftStore } from '../draft-store';

describe('DraftStore', () => {
  let store: DraftStore;

  beforeEach(() => {
    store = new DraftStore();
  });

  it('saves and redeems a crash draft for the matching session', () => {
    const draft = store.save({
      sessionId: 'sess_123',
      fingerprint: '1122334455667788',
      preview: {
        errorName: 'TypeError',
        errorMessage: 'crash',
        actionType: 'MOVE',
        floor: 1,
        turn: 5,
        sealedManifest: [{ label: 'Player State', approxBytes: 100 }],
      },
      sealed: {
        errorName: 'TypeError',
        errorMessage: 'crash',
        runSeed: 42,
      },
    });

    expect(draft.draftId).toBeDefined();

    // Redeeming with wrong session returns null
    expect(store.redeem(draft.draftId, 'wrong_session')).toBeNull();

    // Redeeming with correct session returns draft
    const redeemed = store.redeem(draft.draftId, 'sess_123');
    expect(redeemed).toBeDefined();
    expect(redeemed?.sealed.runSeed).toBe(42);

    // Single-use: redeeming a second time returns null
    expect(store.redeem(draft.draftId, 'sess_123')).toBeNull();
  });

  it('expires drafts after 30 minutes', () => {
    const now = 10000000;
    const thirtyMin = 30 * 60 * 1000;

    const draft = store.save(
      {
        sessionId: 'sess_exp',
        fingerprint: 'exp_fingerprint',
        preview: {
          errorName: 'Error',
          errorMessage: 'exp',
          actionType: 'ATTACK',
          floor: 2,
          turn: 10,
          sealedManifest: [],
        },
        sealed: {
          errorName: 'Error',
          errorMessage: 'exp',
        },
      },
      now
    );

    // 10 minutes later: still valid
    expect(store.get(draft.draftId)).toBeDefined();

    // 31 minutes later: expired
    expect(store.redeem(draft.draftId, 'sess_exp', now + thirtyMin + 1)).toBeNull();
  });

  it('enforces per-session cap so a noisy session cannot evict another session draft (L-13)', () => {
    const victimDraft = store.save(
      {
        sessionId: 'sess_victim',
        fingerprint: 'fp_victim',
        preview: {
          errorName: 'Error',
          errorMessage: 'victim',
          actionType: 'MOVE',
          floor: 1,
          turn: 1,
          sealedManifest: [],
        },
        sealed: { errorName: 'Error', errorMessage: 'victim' },
      },
      1000
    );

    // Flood 60 drafts across a single noisy session + other sessions
    for (let i = 0; i < 10; i++) {
      store.save(
        {
          sessionId: 'sess_noisy',
          fingerprint: `fp_noisy_${i}`,
          preview: {
            errorName: 'Error',
            errorMessage: `noisy ${i}`,
            actionType: 'WAIT',
            floor: 1,
            turn: i,
            sealedManifest: [],
          },
          sealed: { errorName: 'Error', errorMessage: `noisy ${i}` },
        },
        2000 + i
      );
    }

    // Only 5 drafts retained for sess_noisy, and victim's draft stays intact
    expect(store.get(victimDraft.draftId)).toBeDefined();
  });
});
