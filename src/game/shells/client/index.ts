import { ShellRegistry } from '../server/shell-registry';
import vanguard from '../shared/templates/vanguard-v1.json';
import ghost from '../shared/templates/ghost-v1.json';
import bastion from '../shared/templates/bastion-v1.json';

export const globalShellRegistry = new ShellRegistry();
globalShellRegistry.register(vanguard);
globalShellRegistry.register(ghost);
globalShellRegistry.register(bastion);
