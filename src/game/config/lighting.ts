import lightingData from './lighting.json';
import {
  getActiveLightingConfig,
  setActiveLightingConfig,
  type LightingConfig,
} from '@shared/lighting-config';

setActiveLightingConfig(lightingData as LightingConfig);

export type { LightingConfig };

export function getLightingConfig(): LightingConfig {
  return getActiveLightingConfig();
}

export function setLightingConfig(config: LightingConfig): void {
  setActiveLightingConfig(config);
}
