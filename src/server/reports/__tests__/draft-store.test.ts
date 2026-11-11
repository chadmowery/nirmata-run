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
});
