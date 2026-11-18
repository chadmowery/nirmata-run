import fovData from './fov.json';
import { getActiveFovConfig, setActiveFovConfig, type FovConfig } from '@shared/fov-config';

setActiveFovConfig(fovData as FovConfig);

export type { FovConfig };

export function getFovConfig(): FovConfig {
  return getActiveFovConfig();
}

export function setFovConfig(config: FovConfig): void {
  setActiveFovConfig(config);
}
