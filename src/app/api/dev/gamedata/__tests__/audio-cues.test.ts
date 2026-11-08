import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getAudioCues, POST as postAudioCue } from '../audio-cues/route';
import {
  GET as getAudioCue,
  PUT as putAudioCue,
  DELETE as deleteAudioCue,
} from '../audio-cues/[name]/route';

vi.mock('@/server/security/env-gate', () => ({
  checkNonProductionOnly: vi.fn(() => null),
}));

const mockCuesData = {
  $schema: 'sound-cues',
  version: '1.0.0',
  cues: [
    {
      id: 'sfx_test_click',
      bus: 'sfx',
      mode: 'synth',
      baseVolume: 0.8,
      cooldownMs: 30,
      pitchVariance: 0.05,
      synth: {
        waveform: 'triangle',
        freqStart: 440,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.5,
        hold: 0.05,
        release: 0.1,
      },
    },
    {
      id: 'ui_test_hover',
      bus: 'ui',
      mode: 'synth',
      baseVolume: 0.6,
      cooldownMs: 10,
      pitchVariance: 0.02,
      synth: {
        waveform: 'sine',
        freqStart: 880,
        attack: 0.005,
        decay: 0.05,
        sustain: 0.1,
        hold: 0.01,
        release: 0.05,
      },
    },
  ],
};

let currentCuesState = JSON.parse(JSON.stringify(mockCuesData));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => JSON.stringify(currentCuesState)),
  },
  readFile: vi.fn(async () => JSON.stringify(currentCuesState)),
}));

vi.mock('../utils', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../utils');
  return {
    ...actual,
    atomicWrite: vi.fn(async (_path: string, data: typeof mockCuesData) => {
      currentCuesState = JSON.parse(JSON.stringify(data));
    }),
  };
});

describe('Audio Cues Dev API Routes', () => {
  beforeEach(() => {
    currentCuesState = JSON.parse(JSON.stringify(mockCuesData));
    vi.clearAllMocks();
  });

  describe('GET /api/dev/gamedata/audio-cues', () => {
    it('returns list of cue items and full cue data', async () => {
      const res = await getAudioCues();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toEqual(['sfx_test_click', 'ui_test_hover']);
      expect(data.cues.length).toBe(2);
    });
  });

  describe('POST /api/dev/gamedata/audio-cues', () => {
    it('successfully creates a new sound cue', async () => {
      const newCue = {
        id: 'sfx_test_laser',
        bus: 'sfx',
        mode: 'synth',
        baseVolume: 0.7,
        cooldownMs: 50,
        pitchVariance: 0.08,
        synth: {
          waveform: 'sawtooth',
          freqStart: 1200,
          freqEnd: 300,
          attack: 0.01,
          decay: 0.15,
          sustain: 0.2,
          hold: 0.02,
          release: 0.1,
        },
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCue),
      });

      const res = await postAudioCue(req);
      expect(res.status).toBe(201);
      const resJson = await res.json();
      expect(resJson.success).toBe(true);
      expect(resJson.id).toBe('sfx_test_laser');
      expect(currentCuesState.cues.some((c: { id: string }) => c.id === 'sfx_test_laser')).toBe(true);
    });

    it('successfully creates a new sample-based sound cue without synth config', async () => {
      const sampleCue = {
        id: 'amb_custom_track',
        bus: 'ambiance',
        mode: 'sample',
        baseVolume: 0.85,
        cooldownMs: 0,
        pitchVariance: 0,
        loop: true,
        samplePath: '/assets/audio/ambiance/custom-track.ogg',
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleCue),
      });

      const res = await postAudioCue(req);
      expect(res.status).toBe(201);
      const resJson = await res.json();
      expect(resJson.success).toBe(true);
      expect(resJson.id).toBe('amb_custom_track');
      expect(
        currentCuesState.cues.some((c: { id: string }) => c.id === 'amb_custom_track'),
      ).toBe(true);
    });

    it('supports noise waveforms (noise_white) in subWaveform without validation errors', async () => {
      const noiseSubCue = {
        id: 'sfx_impact_crunch',
        bus: 'sfx',
        mode: 'synth',
        baseVolume: 0.75,
        cooldownMs: 40,
        pitchVariance: 0.05,
        synth: {
          waveform: 'triangle',
          freqStart: 300,
          subWaveform: 'noise_white',
          subMix: 0.4,
          attack: 0.01,
          decay: 0.1,
          sustain: 0,
          hold: 0,
          release: 0.05,
        },
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noiseSubCue),
      });

      const res = await postAudioCue(req);
      expect(res.status).toBe(201);
      expect(
        currentCuesState.cues.some((c: { id: string }) => c.id === 'sfx_impact_crunch'),
      ).toBe(true);
    });

    it('rejects cue creation if ID already exists (409 Conflict)', async () => {
      const dupCue = {
        id: 'sfx_test_click',
        bus: 'sfx',
        mode: 'synth',
        baseVolume: 0.5,
        cooldownMs: 20,
        pitchVariance: 0.02,
        synth: {
          waveform: 'sine',
          freqStart: 200,
          attack: 0.01,
          decay: 0.1,
          sustain: 0.5,
          hold: 0.05,
          release: 0.1,
        },
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dupCue),
      });

      const res = await postAudioCue(req);
      expect(res.status).toBe(409);
    });

    it('rejects invalid schema with 400 Bad Request', async () => {
      const invalidCue = {
        id: 'INVALID_CAPS_ID',
        bus: 'not-a-valid-bus',
        mode: 'invalid_mode',
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidCue),
      });

      const res = await postAudioCue(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/dev/gamedata/audio-cues/[name]', () => {
    it('returns cue if found', async () => {
      const req = new Request('http://localhost/api/dev/gamedata/audio-cues/sfx_test_click');
      const res = await getAudioCue(req, { params: Promise.resolve({ name: 'sfx_test_click' }) });
      expect(res.status).toBe(200);
      const cue = await res.json();
      expect(cue.id).toBe('sfx_test_click');
    });

    it('returns 404 if cue not found', async () => {
      const req = new Request('http://localhost/api/dev/gamedata/audio-cues/non_existent');
      const res = await getAudioCue(req, { params: Promise.resolve({ name: 'non_existent' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/dev/gamedata/audio-cues/[name]', () => {
    it('updates existing cue', async () => {
      const updatedCue = {
        ...mockCuesData.cues[0],
        baseVolume: 0.95,
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues/sfx_test_click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCue),
      });

      const res = await putAudioCue(req, { params: Promise.resolve({ name: 'sfx_test_click' }) });
      expect(res.status).toBe(200);
      const updated = currentCuesState.cues.find((c: { id: string }) => c.id === 'sfx_test_click');
      expect(updated.baseVolume).toBe(0.95);
    });

    it('returns 400 on ID mismatch', async () => {
      const mismatch = {
        ...mockCuesData.cues[0],
        id: 'wrong_id',
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues/sfx_test_click', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mismatch),
      });

      const res = await putAudioCue(req, { params: Promise.resolve({ name: 'sfx_test_click' }) });
      expect(res.status).toBe(400);
    });

    it('returns 404 if updating non-existent cue', async () => {
      const ghost = {
        ...mockCuesData.cues[0],
        id: 'ghost_cue',
      };

      const req = new Request('http://localhost/api/dev/gamedata/audio-cues/ghost_cue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ghost),
      });

      const res = await putAudioCue(req, { params: Promise.resolve({ name: 'ghost_cue' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/dev/gamedata/audio-cues/[name]', () => {
    it('deletes existing cue', async () => {
      const req = new Request('http://localhost/api/dev/gamedata/audio-cues/sfx_test_click', {
        method: 'DELETE',
      });

      const res = await deleteAudioCue(req, { params: Promise.resolve({ name: 'sfx_test_click' }) });
      expect(res.status).toBe(200);
      expect(currentCuesState.cues.some((c: { id: string }) => c.id === 'sfx_test_click')).toBe(false);
    });

    it('returns 404 if deleting non-existent cue', async () => {
      const req = new Request('http://localhost/api/dev/gamedata/audio-cues/non_existent', {
        method: 'DELETE',
      });

      const res = await deleteAudioCue(req, { params: Promise.resolve({ name: 'non_existent' }) });
      expect(res.status).toBe(404);
    });
  });
});
