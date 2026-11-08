/**
 * Nirmata Runner — Sound Cue Registry
 * Loads declarative sound cues from sound-cues.json and provides typed O(1) lookups.
 */

import { SoundCueDef } from '@engine/audio';
import soundCuesRaw from './sound-cues.json';

const cuesMap = new Map<string, SoundCueDef>();

// Populate cues map
for (const rawCue of soundCuesRaw.cues) {
  cuesMap.set(rawCue.id, rawCue as SoundCueDef);
}

export function getSoundCue(cueId: string): SoundCueDef | undefined {
  return cuesMap.get(cueId);
}

export function registerSoundCue(cue: SoundCueDef): void {
  cuesMap.set(cue.id, cue);
}

export function getAllSoundCues(): SoundCueDef[] {
  return Array.from(cuesMap.values());
}
