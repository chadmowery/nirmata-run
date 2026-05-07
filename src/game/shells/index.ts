import { ShellRegistry } from './shell-registry';
import vanguard from './templates/vanguard-v1.json';
import ghost from './templates/ghost-v1.json';
import bastion from './templates/bastion-v1.json';

/**
 * Global registry for Shell archetypes and records.
 */
export const globalShellRegistry = new ShellRegistry();

// Register starter shells
globalShellRegistry.register(vanguard as any);
globalShellRegistry.register(ghost as any);
globalShellRegistry.register(bastion as any);
