import { ShellRegistry } from './shell-registry';
import striker from './templates/striker-v1.json';
import bastion from './templates/bastion-v1.json';
import signal from './templates/signal-v1.json';

/**
 * Global registry for Shell archetypes and records.
 */
export const globalShellRegistry = new ShellRegistry();

// Register starter shells
globalShellRegistry.register(striker);
globalShellRegistry.register(bastion);
globalShellRegistry.register(signal);
